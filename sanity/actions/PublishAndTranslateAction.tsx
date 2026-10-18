import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Card, Flex, Spinner, Stack, Text } from '@sanity/ui';
import { CheckmarkCircleIcon, PublishIcon, TranslateIcon, WarningOutlineIcon } from '@sanity/icons';
import { useClient, useDocumentOperation, type DocumentActionComponent } from 'sanity';
import {
  isFrenchPost,
  STALE_JOB_MS,
  TRANSLATION_LANGS,
  translationJobId,
  type TranslationJob,
} from '@/lib/journal/translate/job';

const API_VERSION = '2026-01-01';

const LANG_LABEL = { en: 'English', ru: 'Русский' } as const;

/**
 * « Publish + generate EN & RU » — remplace le Publish natif sur un article
 * FRANÇAIS du journal (demande Alexandre, 2026-10-18 : la traduction est
 * obligatoire à la publication). Il n'existe donc plus de Publish simple sur
 * un article français ; les traductions gardent le Publish natif.
 *
 * Deux temps : le Publish natif (`original`, avec sa validation et son
 * raccourci clavier), PUIS, une fois le brouillon absorbé, l'écriture de la
 * demande de traduction (`lib/journal/translate/job.ts`). Attendre le
 * Publish compte : le traducteur lit la version PUBLIÉE.
 *
 * Sans rien à publier (article déjà publié, ou dernière demande en erreur),
 * l'action devient « Generate EN & RU versions » et ne fait que la demande.
 *
 * Les traductions arrivent en BROUILLONS (décision du 2026-10-18) ; la
 * fenêtre suit l'avancement en écoutant la demande.
 */
export function createPublishAndTranslateAction(original: DocumentActionComponent): DocumentActionComponent {
  const PublishAndTranslateAction: DocumentActionComponent = (props) => {
    const nativeResult = original(props);
    const { id, type, draft, published } = props;
    const { patch } = useDocumentOperation(id, type);
    const baseClient = useClient({ apiVersion: API_VERSION });
    const client = useMemo(() => baseClient.withConfig({ perspective: 'raw' }), [baseClient]);
    const jobId = translationJobId(id);

    const [job, setJob] = useState<TranslationJob | null>(null);
    const [phase, setPhase] = useState<'idle' | 'publishing' | 'requesting'>('idle');
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

    const request = async () => {
      setPhase('requesting');
      setRequestError(null);
      try {
        const doc: TranslationJob = {
          _id: jobId,
          _type: 'translationJob',
          post: id,
          status: 'requested',
          requestedAt: new Date().toISOString(),
        };
        await client.createOrReplace(doc);
        setJob(doc);
      } catch (err) {
        setRequestError(err instanceof Error ? err.message : 'Erreur réseau inconnue.');
      } finally {
        setPhase('idle');
      }
    };

    // Publish natif lancé : la demande part quand le brouillon a été absorbé.
    const requested = useRef(false);
    useEffect(() => {
      if (phase !== 'publishing' || draft || !published || requested.current) return;
      requested.current = true;
      void request();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, draft, published]);

    if (!isFrenchPost(draft ?? published) || !nativeResult) return nativeResult;

    const since = job ? Date.now() - Date.parse(job.startedAt ?? job.requestedAt) : Infinity;
    const busy =
      phase !== 'idle' || (!!job && (job.status === 'requested' || job.status === 'running') && since < STALE_JOB_MS);
    const somethingToPublish = !!draft;

    return {
      ...nativeResult,
      label: busy
        ? 'Translating…'
        : somethingToPublish
          ? 'Publish + generate EN & RU'
          : 'Generate EN & RU versions',
      icon: somethingToPublish ? PublishIcon : TranslateIcon,
      // Rien à publier : l'action reste disponible pour (re)générer — sauf si l'article n'a jamais été publié.
      disabled: busy || (somethingToPublish ? nativeResult.disabled : !published),
      title: somethingToPublish
        ? 'Publie l’article français, puis écrit ses versions anglaise et russe en brouillons, à relire avant de les publier.'
        : 'Réécrit les brouillons anglais et russe depuis la version publiée. Les versions déjà en ligne ne bougent pas avant leur propre Publish.',
      onHandle: () => {
        setDialogOpen(true);
        requested.current = false;
        if (somethingToPublish) {
          setPhase('publishing');
          // Première publication : l'heure départage les articles du même jour (`lib/journal/articles.ts`).
          if (!draft?.publishedAt && !published?.publishedAt) patch.execute([{ set: { publishedAt: new Date().toISOString() } }]);
          nativeResult.onHandle?.();
        } else void request();
      },
      dialog: dialogOpen && {
        type: 'dialog',
        header: 'Versions anglaise et russe',
        onClose: () => setDialogOpen(false),
        content: <JobProgress phase={phase} job={job} requestError={requestError} />,
      },
    };
  };
  PublishAndTranslateAction.action = 'publish';
  PublishAndTranslateAction.displayName = 'PublishAndTranslateAction';
  return PublishAndTranslateAction;
}

function JobProgress({
  phase,
  job,
  requestError,
}: {
  phase: 'idle' | 'publishing' | 'requesting';
  job: TranslationJob | null;
  requestError: string | null;
}) {
  if (requestError) return <Line tone="critical" text={`La demande n’a pas pu être écrite : ${requestError}`} />;
  if (phase === 'publishing') return <Line tone="busy" text="Publication de l’article français…" />;
  if (phase === 'requesting' || !job) return <Line tone="busy" text="Envoi de la demande de traduction…" />;

  const waiting = job.status === 'requested';
  return (
    <Stack space={4}>
      {waiting && <Line tone="busy" text="Demande envoyée, le traducteur démarre…" />}
      {TRANSLATION_LANGS.map((lang) => {
        const r = job.results?.[lang];
        if (r?.error) return <Line key={lang} tone="critical" text={`${LANG_LABEL[lang]} : ${r.error}`} />;
        if (r?.draftId)
          return <Line key={lang} tone="positive" text={`${LANG_LABEL[lang]} : brouillon prêt — /${lang}/${r.slug}/`} />;
        if (job.status === 'running') return <Line key={lang} tone="busy" text={`${LANG_LABEL[lang]} : traduction en cours (1 à 3 min)…`} />;
        return null;
      })}
      {job.status === 'error' && job.error && !TRANSLATION_LANGS.some((l) => job.results?.[l]?.error) && (
        <Line tone="critical" text={job.error} />
      )}
      <Card padding={3} radius={2} tone="transparent" border>
        <Text size={1} muted>
          {job.status === 'done'
            ? 'Les deux traductions sont en brouillon dans Journal → Articles. Relis-les, puis publie chacune : le blog se met à jour 3 à 4 minutes après.'
            : job.status === 'error'
              ? 'Rien n’a été publié. Relance avec « Generate EN & RU versions » ; si l’erreur revient, elle est dans le journal du VPS.'
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
