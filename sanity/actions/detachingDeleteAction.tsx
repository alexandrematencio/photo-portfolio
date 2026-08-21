import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Box, Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui';
import { TrashIcon, UnlinkIcon } from '@sanity/icons';
import {
  useClient,
  useDocumentOperation,
  type DocumentActionComponent,
  type DocumentActionProps,
} from 'sanity';

/**
 * Fabrique d'actions « Supprimer » qui DÉTACHENT les références avant de
 * supprimer. Instanciée pour `photo` (DeletePhotoAction) et `series`
 * (DeleteSeriesAction) — la mécanique est la même, seuls les libellés changent.
 *
 * **Pourquoi.** Sanity refuse de supprimer un document tant qu'un document
 * publié le référence (référence forte), et le « Delete all versions anyway »
 * natif ne détache rien — il échoue avec une erreur de mutation. Une photo
 * présente dans `series.photoOrder` / `series.coverPhoto` /
 * `siteSettings.curation`, une série présente dans `photo.series[]` /
 * `siteSettings.seriesOrder`, étaient donc insupprimables depuis le Studio.
 *
 * **Ce que ça fait** :
 * 1. À l'ouverture du dialogue, fetch de TOUS les documents référents
 *    (perspective `raw` : les brouillons aussi, sinon un futur Publish
 *    ressusciterait une référence morte).
 * 2. Scan GÉNÉRIQUE de chaque référent pour localiser les références (aucune
 *    liste de champs codée en dur : un futur champ référençant une photo ou une
 *    série sera détaché sans modifier ce fichier).
 * 3. Au clic : UNE transaction qui détache tout, puis la suppression via
 *    l'opération native du Studio (toast + navigation gérés par elle).
 *
 * **Ce que ça ne fait PAS** : supprimer les documents référents. Détacher une
 * série de `photo.series[]` laisse le tableau vide — la photo bascule dans
 * « Sans série » et reste dans « Toutes » (le filtre « sans série » du projet
 * est `!defined(series) || count(series) == 0`, cf. CLAUDE.md §11.2 : un
 * tableau vide EST défini).
 */

const API_VERSION = '2026-01-01';

type ReferringDoc = {
  _id: string;
  _type: string;
  title?: string;
  [key: string]: unknown;
};

/** Détachement à opérer sur un document référent. */
type DetachPlan = {
  docId: string;
  isDraft: boolean;
  docType: string;
  docTitle: string;
  /** Chemins `unset` Sanity (ex. `photoOrder[_ref=="X"]`, `coverPhoto`). */
  unsetPaths: string[];
  /** Champs racine touchés — pour l'affichage. */
  fields: string[];
};

export type DetachingDeleteConfig = {
  /** En-tête du dialogue. */
  header: string;
  /** Nom de repli quand le document n'a pas de titre (« cette photo »). */
  fallbackTitle: string;
  /** Suite de phrase après « X », quand des références existent. */
  introWithRefs: string;
  /** Suite de phrase après « X », quand aucune référence n'existe. */
  introWithoutRefs: string;
  /** Réassurance affichée sous la liste des détachements. */
  note: string;
};

const REFERRING_QUERY = /* groq */ `*[references($id)]`;

/**
 * Champs connus → libellé de ce que le détachement implique. Les clés ne se
 * chevauchent pas entre les deux sens de suppression (rien ne référence une
 * série via `photoOrder`, ni une photo via `series`), d'où une seule table.
 */
const FIELD_LABELS: Record<string, string> = {
  coverPhoto:
    'photo de couverture — le site retombera sur la première photo de la série',
  photoOrder: 'retirée de l’ordre des photos',
  curation: 'retirée de la curation de la home',
  series:
    'retirée de cette série — la photo reste dans « Toutes » et dans ses autres séries',
  seriesOrder: 'retirée de l’ordre des séries de la page /series',
};

const TYPE_LABELS: Record<string, string> = {
  series: 'Série',
  siteSettings: 'Réglages du site',
  photo: 'Photo',
};

/** Au-delà, on résume au lieu de dérouler (une série peut avoir 40 photos). */
const MAX_TITLES_SHOWN = 8;

function isReferenceTo(value: unknown, id: string): value is { _ref: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { _ref?: unknown })._ref === id
  );
}

/**
 * Parcourt un document et collecte les chemins `unset` de toute référence vers
 * `id`. Un item de tableau qui EST la référence → `chemin[_ref=="id"]` (retire
 * aussi les doublons d'un coup) ; une référence portée par un champ → le chemin
 * du champ ; un objet imbriqué dans un tableau → item ciblé par `_key`.
 */
function collectUnsetPaths(
  node: unknown,
  id: string,
  path: string,
  out: string[]
): void {
  if (Array.isArray(node)) {
    if (node.some((item) => isReferenceTo(item, id))) {
      out.push(`${path}[_ref=="${id}"]`);
    }
    for (const item of node) {
      if (isReferenceTo(item, id)) continue;
      if (typeof item === 'object' && item !== null) {
        const key = (item as { _key?: string })._key;
        // Sans _key on ne peut pas cibler l'item de façon stable — on l'ignore
        // plutôt que de risquer un chemin faux (cas absent de nos schémas).
        if (key) collectUnsetPaths(item, id, `${path}[_key=="${key}"]`, out);
      }
    }
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('_')) continue;
    const childPath = path ? `${path}.${key}` : key;
    if (isReferenceTo(value, id)) {
      out.push(childPath);
    } else {
      collectUnsetPaths(value, id, childPath, out);
    }
  }
}

function buildPlan(doc: ReferringDoc, targetId: string): DetachPlan | null {
  const unsetPaths: string[] = [];
  collectUnsetPaths(doc, targetId, '', unsetPaths);
  if (unsetPaths.length === 0) return null;
  const isDraft = doc._id.startsWith('drafts.');
  return {
    docId: doc._id,
    isDraft,
    docType: doc._type,
    docTitle:
      doc._type === 'siteSettings'
        ? 'Réglages du site'
        : (typeof doc.title === 'string' && doc.title) || doc._id,
    unsetPaths,
    fields: [...new Set(unsetPaths.map((p) => p.split(/[.[]/, 1)[0]))],
  };
}

/** Un bloc par TYPE de document référent, plutôt qu'une carte par document. */
type PlanGroup = {
  docType: string;
  titles: string[];
  fields: string[];
};

function groupPlans(plans: DetachPlan[]): PlanGroup[] {
  // Une même série peut apparaître en publié ET en brouillon : une seule ligne
  // à l'écran (les deux variantes sont patchées quand même).
  const byBaseId = new Map<string, DetachPlan>();
  for (const plan of plans) {
    const baseId = plan.docId.replace(/^drafts\./, '');
    const existing = byBaseId.get(baseId);
    // La variante publiée porte l'état de référence qui bloque : priorité.
    if (!existing || (existing.isDraft && !plan.isDraft)) {
      byBaseId.set(baseId, plan);
    }
  }
  const groups = new Map<string, PlanGroup>();
  for (const plan of byBaseId.values()) {
    const group = groups.get(plan.docType) ?? {
      docType: plan.docType,
      titles: [],
      fields: [],
    };
    group.titles.push(plan.docTitle);
    for (const field of plan.fields) {
      if (!group.fields.includes(field)) group.fields.push(field);
    }
    groups.set(plan.docType, group);
  }
  return [...groups.values()];
}

function DeleteDialogContent({
  config,
  title,
  plans,
  loading,
  loadError,
  busy,
  error,
  disabledReason,
  onConfirm,
  onCancel,
}: {
  config: DetachingDeleteConfig;
  title: string;
  plans: DetachPlan[] | null;
  loading: boolean;
  loadError: string | null;
  busy: boolean;
  error: string | null;
  disabledReason: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const groups = useMemo(() => (plans ? groupPlans(plans) : []), [plans]);
  const hasRefs = groups.length > 0;

  return (
    <Stack space={4}>
      {loading && (
        <Flex align="center" gap={2} padding={3}>
          <Spinner muted />
          <Text size={1} muted>
            Recherche des documents liés…
          </Text>
        </Flex>
      )}

      {loadError && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>Vérification impossible : {loadError}</Text>
        </Card>
      )}

      {!loading && !loadError && !hasRefs && (
        <Text size={1}>
          « {title} » {config.introWithoutRefs}
        </Text>
      )}

      {!loading && !loadError && hasRefs && (
        <>
          <Text size={1}>
            « {title} » {config.introWithRefs}
          </Text>
          <Stack space={2}>
            {groups.map((group) => (
              <Card key={group.docType} padding={3} radius={2} tone="caution">
                <Flex align="flex-start" justify="space-between" gap={3}>
                  <Stack space={3} style={{ flex: 1, minWidth: 0 }}>
                    <Stack space={2}>
                      {group.fields.map((field) => (
                        <Flex key={field} align="center" gap={2}>
                          <UnlinkIcon />
                          <Text size={1}>
                            {FIELD_LABELS[field] ?? `champ « ${field} » détaché`}
                          </Text>
                        </Flex>
                      ))}
                    </Stack>
                    <Text size={0} muted>
                      {group.titles.slice(0, MAX_TITLES_SHOWN).join(' · ')}
                      {group.titles.length > MAX_TITLES_SHOWN &&
                        ` · + ${group.titles.length - MAX_TITLES_SHOWN} autres`}
                    </Text>
                  </Stack>
                  <Badge mode="outline">
                    {group.titles.length}{' '}
                    {TYPE_LABELS[group.docType] ?? group.docType}
                  </Badge>
                </Flex>
              </Card>
            ))}
          </Stack>
          <Text size={0} muted>
            {config.note}
          </Text>
        </>
      )}

      {error && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{error}</Text>
        </Card>
      )}

      <Flex gap={2} justify="flex-end">
        <Button mode="ghost" text="Annuler" disabled={busy} onClick={onCancel} />
        <Box>
          <Button
            icon={TrashIcon}
            tone="critical"
            text={
              hasRefs
                ? 'Détacher les liens et supprimer'
                : 'Supprimer définitivement'
            }
            disabled={busy || loading || !!loadError || !!disabledReason}
            loading={busy}
            title={disabledReason ?? undefined}
            onClick={onConfirm}
          />
        </Box>
      </Flex>
    </Stack>
  );
}

export function createDetachingDeleteAction(
  config: DetachingDeleteConfig
): DocumentActionComponent {
  const Action: DocumentActionComponent = (props: DocumentActionProps) => {
    const { id, type, draft, published, onComplete } = props;
    // Perspective `raw` EXPLICITE : depuis les apiVersions récentes le défaut
    // est `published`, qui cacherait les brouillons référents — un Publish
    // ultérieur recréerait alors une référence vers un document disparu.
    const baseClient = useClient({ apiVersion: API_VERSION });
    const client = useMemo(
      () => baseClient.withConfig({ perspective: 'raw' }),
      [baseClient]
    );
    const { delete: deleteOp } = useDocumentOperation(id, type);

    const [open, setOpen] = useState(false);
    const [plans, setPlans] = useState<DetachPlan[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const doc = draft ?? published;
    const title =
      (typeof doc?.title === 'string' && doc.title) || config.fallbackTitle;

    // Fetch des référents à l'ouverture du dialogue seulement — pas à chaque
    // rendu de la barre d'actions.
    useEffect(() => {
      if (!open) return;
      let cancelled = false;
      setPlans(null);
      setLoadError(null);
      client
        .fetch<ReferringDoc[]>(REFERRING_QUERY, { id })
        .then((docs) => {
          if (cancelled) return;
          setPlans(
            docs
              .map((referring) => buildPlan(referring, id))
              .filter((plan): plan is DetachPlan => plan !== null)
          );
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setLoadError(err instanceof Error ? err.message : 'Erreur inconnue');
          }
        });
      return () => {
        cancelled = true;
      };
    }, [open, client, id]);

    const close = useCallback(() => {
      setOpen(false);
      setError(null);
    }, []);

    const handleConfirm = useCallback(async () => {
      if (!plans) return;
      setBusy(true);
      setError(null);
      try {
        if (plans.length > 0) {
          // UNE transaction pour tous les détachements : jamais de dataset à
          // moitié détaché. La suppression passe ensuite par l'opération native
          // (toast, navigation, gestion draft+published).
          const tx = plans.reduce(
            (acc, plan) => acc.patch(plan.docId, (p) => p.unset(plan.unsetPaths)),
            client.transaction()
          );
          await tx.commit({ visibility: 'sync' });
        }
        deleteOp.execute();
        close();
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Échec de la suppression.');
        setBusy(false);
      }
    }, [plans, client, deleteOp, close, onComplete]);

    const disabledReason =
      typeof deleteOp.disabled === 'string'
        ? `Suppression indisponible : ${deleteOp.disabled}`
        : null;

    return {
      label: 'Supprimer',
      icon: TrashIcon,
      tone: 'critical',
      disabled: !draft && !published,
      onHandle: () => setOpen(true),
      dialog: open && {
        type: 'dialog' as const,
        header: config.header,
        onClose: () => {
          close();
          onComplete();
        },
        content: (
          <DeleteDialogContent
            config={config}
            title={title}
            plans={plans}
            loading={open && plans === null && !loadError}
            loadError={loadError}
            busy={busy}
            error={error}
            disabledReason={disabledReason}
            onConfirm={handleConfirm}
            onCancel={() => {
              close();
              onComplete();
            }}
          />
        ),
      },
    };
  };

  // Se déclarer comme L'action `delete` : le Studio la place et la stylise
  // comme la suppression native qu'elle remplace.
  Action.action = 'delete';
  return Action;
}
