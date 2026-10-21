import { useEffect, useMemo, useState } from 'react';
import { Box, Card, Flex, Spinner, Stack, Text } from '@sanity/ui';
import { CheckmarkCircleIcon, TranslateIcon, WarningOutlineIcon } from '@sanity/icons';
import { useClient, useDocumentOperation, type DocumentActionComponent } from 'sanity';
import {
  isFrenchPost,
  jobLangs,
  STALE_JOB_MS,
  TRANSLATION_LANGS,
  translationJobId,
  type TranslationJob,
  type TranslationLang,
  type TranslationResult,
} from '@/lib/journal/translate/job';

const API_VERSION = '2026-01-01';

const LANG_LABEL = { en: 'English', ru: 'Русский' } as const;
const LANG_NAME = { en: 'anglais', ru: 'russe' } as const;

/**
 * Le Publish NATIF d'un article français, plus une seule chose : la première
 * publication pose `publishedAt`, qui départage les articles du même jour
 * (`lib/journal/articles.ts`). Validation, raccourci et état désactivé sont
 * ceux du Publish natif.
 *
 * Publier ne traduit plus (demande Alexandre, 2026-10-18 au soir) : il veut
 * relire le français EN LIGNE avant de payer une traduction. Celle-ci est un
 * geste à part, `createGenerateTranslationsAction`.
 */
export function createDatedPublishAction(original: DocumentActionComponent): DocumentActionComponent {
  const DatedPublishAction: DocumentActionComponent = (props) => {
    const nativeResult = original(props);
    const { id, type, draft, published } = props;
    const { patch } = useDocumentOperation(id, type);
    if (!nativeResult || !isFrenchPost(draft ?? published)) return nativeResult;
    return {
      ...nativeResult,
      onHandle: () => {
        // Seulement s'il n'existe AUCUNE version publiée : un article publié
        // avant ce champ qu'on republie le recevait à l'heure de la retouche,
        // et doublait les articles plus récents (2026-10-19).
        if (!published && !draft?.publishedAt) patch.execute([{ set: { publishedAt: new Date().toISOString() } }]);
        nativeResult.onHandle?.();
      },
    };
  };
  DatedPublishAction.action = 'publish';
  DatedPublishAction.displayName = 'DatedPublishAction';
  return DatedPublishAction;
}

const langsTag = (langs: readonly TranslationLang[]) => langs.map((l) => l.toUpperCase()).join(' & ');
const langsName = (langs: readonly TranslationLang[]) => langs.map((l) => LANG_NAME[l]).join(' et ');
const sameLangs = (a: readonly TranslationLang[], b: readonly TranslationLang[]) =>
  a.length === b.length && a.every((l) => b.includes(l));

/**
 * « Generate EN & RU », « Generate EN », « Generate RU » — sur un article
 * FRANÇAIS déjà publié, écrit la demande de traduction
 * (`lib/journal/translate/job.ts`) que le VPS exécute, pour les seules
 * langues du bouton. Trois gestes et non une fenêtre à cases (demande
 * Alexandre, 2026-10-21 : souvent, l'anglais seul suffit) : le choix reste à
 * deux clics, comme avant.
 *
 * Le traducteur lit la version PUBLIÉE et ne retraduit que ce qui a changé
 * depuis la dernière traduction (`lib/journal/translate/incremental.ts`).
 * Les traductions arrivent en BROUILLONS ; la fenêtre suit l'avancement en
 * écoutant la demande. Une seule demande par article : tant qu'elle tourne,
 * les trois boutons sont grisés.
 */
export function createGenerateTranslationsAction(langs: readonly TranslationLang[]): DocumentActionComponent {
  const tag = langsTag(langs);
  const GenerateTranslationsAction: DocumentActionComponent = (props) => {
    const { id, draft, published } = props;
    const baseClient = useClient({ apiVersion: API_VERSION });
    const client = useMemo(() => baseClient.withConfig({ perspective: 'raw' }), [baseClient]);
    const jobId = translationJobId(id);

    const [job, setJob] = useState<TranslationJob | null>(null);
    const [requesting, setRequesting] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);

    // La demande en cours, lue puis écoutée : c'est elle qui fait avancer la fenêtre.
    useEffect(() => {
      let alive = true;
      client.getDocument<TranslationJob>(jobId).then((doc) => alive && setJob(doc ?? null), () => undefined);
      const sub = client.listen<TranslationJob>('*[_id == $id]', { id: jobId }, { includeResult: true }).subscribe((event) => {
        if (event.type === 'mutation') setJob((event.result as TranslationJob | undefined) ?? null);
      });
      return () => {
        alive = false;
        sub.unsubscribe();
      };
    }, [client, jobId]);

    if (!isFrenchPost(draft ?? published)) return null;

    const request = async () => {
      setRequesting(true);
      setRequestError(null);
      try {
        const doc: TranslationJob = {
          _id: jobId,
          _type: 'translationJob',
          post: id,
          langs: [...langs],
          status: 'requested',
          requestedAt: new Date().toISOString(),
        };
        await client.createOrReplace(doc);
        setJob(doc);
      } catch (err) {
        setRequestError(err instanceof Error ? err.message : 'Erreur réseau inconnue.');
      } finally {
        setRequesting(false);
      }
    };

    const since = job ? Date.now() - Date.parse(job.startedAt ?? job.requestedAt) : Infinity;
    const jobBusy = !!job && (job.status === 'requested' || job.status === 'running') && since < STALE_JOB_MS;
    const mine = requesting || (jobBusy && sameLangs(jobLangs(job), langs));
    const others = langs.length === 1 ? `Les autres langues ne bougent pas. ` : '';

    return {
      label: mine ? `Translating ${tag}…` : `Generate ${tag}`,
      icon: TranslateIcon,
      disabled: requesting || jobBusy || !published,
      title: !published
        ? 'Publie d’abord l’article : c’est la version en ligne qui est traduite.'
        : jobBusy && !mine
          ? `Une traduction (${langsTag(jobLangs(job))}) est déjà en cours pour cet article.`
          : draft
            ? `Attention : ce brouillon n’est pas publié, il ne sera PAS traduit — seule la version en ligne l’est. ${others}Seuls les passages modifiés depuis la dernière traduction partent au traducteur.`
            : `Met à jour le brouillon ${langs.length > 1 ? 'anglais et russe' : langs[0] === 'en' ? 'anglais' : 'russe'}. ${others}Seuls les passages modifiés depuis la dernière traduction partent au traducteur ; les versions déjà en ligne ne bougent pas avant leur propre Publish.`,
      onHandle: () => {
        setDialogOpen(true);
        void request();
      },
      dialog: dialogOpen && {
        type: 'dialog',
        header: langs.length > 1 ? 'Versions anglaise et russe' : langs[0] === 'en' ? 'Version anglaise' : 'Version russe',
        onClose: () => setDialogOpen(false),
        content: (
          <JobProgress requesting={requesting} job={job} requestError={requestError} unpublishedDraft={!!draft} />
        ),
      },
    };
  };
  GenerateTranslationsAction.displayName = `GenerateTranslationsAction(${tag})`;
  return GenerateTranslationsAction;
}

/** Dans le menu de Publish, dans cet ordre : les deux, puis chacune. */
export const GENERATE_TRANSLATIONS_ACTIONS = [
  createGenerateTranslationsAction(TRANSLATION_LANGS),
  ...TRANSLATION_LANGS.map((lang) => createGenerateTranslationsAction([lang])),
];

function resultLine(lang: keyof typeof LANG_LABEL, r: TranslationResult) {
  if (r.unchanged) return `${LANG_LABEL[lang]} : déjà à jour, rien n’a été retraduit.`;
  const detail =
    r.translated !== undefined && r.reused ? ` (${r.translated} passage(s) traduit(s), ${r.reused} repris tels quels)` : '';
  return `${LANG_LABEL[lang]} : brouillon prêt — /${lang}/${r.slug}/${detail}`;
}

function JobProgress({
  requesting,
  job,
  requestError,
  unpublishedDraft,
}: {
  requesting: boolean;
  job: TranslationJob | null;
  requestError: string | null;
  unpublishedDraft: boolean;
}) {
  if (requestError) return <Line tone="critical" text={`La demande n’a pas pu être écrite : ${requestError}`} />;
  if (requesting || !job) return <Line tone="busy" text="Envoi de la demande de traduction…" />;

  const waiting = job.status === 'requested';
  const langs = jobLangs(job);
  return (
    <Stack space={4}>
      {unpublishedDraft && (
        <Line tone="critical" text="Le brouillon français n’est pas publié : la traduction part de la version en ligne." />
      )}
      {waiting && <Line tone="busy" text="Demande envoyée, le traducteur démarre…" />}
      {langs.map((lang) => {
        const r = job.results?.[lang];
        if (r?.error) return <Line key={lang} tone="critical" text={`${LANG_LABEL[lang]} : ${r.error}`} />;
        if (r?.draftId) return <Line key={lang} tone="positive" text={resultLine(lang, r)} />;
        if (job.status === 'running') return <Line key={lang} tone="busy" text={`${LANG_LABEL[lang]} : traduction en cours…`} />;
        return null;
      })}
      {job.status === 'error' && job.error && !langs.some((l) => job.results?.[l]?.error) && (
        <Line tone="critical" text={job.error} />
      )}
      <Card padding={3} radius={2} tone="transparent" border>
        <Text size={1} muted>
          {job.status === 'done'
            ? `${langs.length > 1 ? 'Les traductions mises à jour sont' : `La version en ${langsName(langs)} est`} en brouillon dans Journal → Articles. Relis, puis publie : le blog se met à jour 3 à 4 minutes après.`
            : job.status === 'error'
              ? `Rien n’a été publié. Relance « Generate ${langsTag(langs)} » ; si l’erreur revient, elle est dans le journal du VPS.`
              : 'Tu peux fermer cette fenêtre : la traduction continue sur le serveur et les brouillons apparaîtront seuls.'}
        </Text>
      </Card>
    </Stack>
  );
}

function Line({ tone, text }: { tone: 'busy' | 'positive' | 'critical'; text: string }) {
  return (
    <Flex gap={3} align="center">
      <Box>
        {tone === 'busy' ? (
          <Spinner muted />
        ) : (
          <Text size={2}>{tone === 'positive' ? <CheckmarkCircleIcon /> : <WarningOutlineIcon />}</Text>
        )}
      </Box>
      <Text size={1}>{text}</Text>
    </Flex>
  );
}
