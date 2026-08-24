import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Spinner,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import { AddIcon, CheckmarkIcon, CloseIcon, StackCompactIcon } from '@sanity/icons';
import {
  useClient,
  useDocumentOperation,
  type DocumentActionComponent,
  type DocumentActionProps,
} from 'sanity';
import { createRefDoc } from '../lib/createRefDoc';

const API_VERSION = '2026-01-01';

/**
 * Action document « Ajouter à une série », disponible sur toute photo ouverte —
 * donc depuis N'IMPORTE QUEL onglet de Photos (Par style, Par année, Sans série…),
 * puisqu'une action document ne dépend pas du panneau d'où l'on vient.
 *
 * Pattern d'interaction : combobox-with-create. UN seul champ sert à la fois de
 * recherche et de création — si la saisie ne correspond à aucune série, l'option
 * « Créer … » devient l'action principale. Évite le double parcours
 * « je cherche » / « je n'ai pas trouvé, je vais ailleurs créer ».
 *
 * La série créée ici n'a que son titre + slug : elle est immédiatement
 * référençable, et se complète ensuite dans Structure → Séries.
 */

type SeriesRow = {
  _id: string;
  title: string;
  slug: string | null;
  year: number | null;
  photoCount: number;
};

const SERIES_QUERY = /* groq */ `
  *[_type == "series" && !(_id in path('drafts.**'))] | order(title asc) {
    _id, title, "slug": slug.current, year,
    "photoCount": count(*[_type == "photo" && references(^._id)])
  }
`;

function SeriesPicker({
  currentSeriesIds,
  onAssign,
  onDetach,
  busy,
  error,
}: {
  /** Séries auxquelles la photo appartient DÉJÀ — l'appartenance est multiple. */
  currentSeriesIds: string[];
  onAssign: (seriesId: string, seriesTitle: string) => void;
  onDetach: (seriesId: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const client = useClient({ apiVersion: API_VERSION });
  const [series, setSeries] = useState<SeriesRow[] | null>(null);
  const [query, setQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    client
      .fetch<SeriesRow[]>(SERIES_QUERY)
      .then((rows) => {
        if (!cancelled) setSeries(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Erreur inconnue');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Autofocus : on peut taper immédiatement, sans viser le champ à la souris.
  useEffect(() => {
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  const trimmed = query.trim();

  const filtered = useMemo(() => {
    if (!series) return [];
    if (!trimmed) return series;
    const needle = trimmed.toLowerCase();
    return series.filter((s) => s.title.toLowerCase().includes(needle));
  }, [series, trimmed]);

  const exactMatch = useMemo(
    () =>
      series?.find(
        (s) => s.title.toLowerCase() === trimmed.toLowerCase()
      ) ?? null,
    [series, trimmed]
  );

  // Créer n'a de sens que si la saisie n'est pas déjà un titre existant.
  const canCreate = trimmed.length >= 2 && !exactMatch;

  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    onAssign('__create__', trimmed);
  }, [canCreate, trimmed, onAssign]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (exactMatch) {
        onAssign(exactMatch._id, exactMatch.title);
      } else if (filtered.length === 1) {
        onAssign(filtered[0]._id, filtered[0].title);
      } else if (canCreate) {
        handleCreate();
      }
    },
    [exactMatch, filtered, canCreate, handleCreate, onAssign]
  );

  // Séries actuelles, affichées à part : la liste du dessous est filtrée par la
  // recherche, une appartenance en cours pourrait donc disparaître de l'écran
  // au moment même où on veut la retirer.
  const attached = useMemo(
    () => (series ?? []).filter((s) => currentSeriesIds.includes(s._id)),
    [series, currentSeriesIds]
  );

  return (
    <Stack space={4}>
      {attached.length > 0 && (
        <Stack space={2}>
          <Text size={1} weight="semibold">
            Déjà dans {attached.length === 1 ? 'cette série' : 'ces séries'}
          </Text>
          {attached.map((s) => (
            <Card key={s._id} padding={2} radius={2} tone="positive">
              <Flex align="center" justify="space-between" gap={3}>
                <Flex align="center" gap={2}>
                  <CheckmarkIcon />
                  <Text size={1} weight="semibold">
                    {s.title}
                  </Text>
                </Flex>
                <Button
                  icon={CloseIcon}
                  mode="bleed"
                  tone="critical"
                  fontSize={1}
                  padding={2}
                  text="Retirer"
                  disabled={busy}
                  onClick={() => onDetach(s._id)}
                />
              </Flex>
            </Card>
          ))}
        </Stack>
      )}

      <Stack space={3}>
        <Text size={1} weight="semibold" as="label" id="series-search-label">
          {attached.length > 0
            ? 'Ajouter à une autre série, ou taper un nouveau nom'
            : 'Rechercher une série, ou taper un nouveau nom'}
        </Text>
        <TextInput
          ref={inputRef}
          aria-labelledby="series-search-label"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex. Djerba 2024"
          disabled={busy}
          clearButton={trimmed.length > 0}
          onClear={() => setQuery('')}
        />
        <Text size={0} muted>
          Entrée valide. La photo repasse en brouillon : pense à{' '}
          <strong>Publish</strong>. Une série créée ici n&apos;a que son nom —
          complète-la ensuite dans Structure → Séries.
        </Text>
      </Stack>

      {error && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>{error}</Text>
        </Card>
      )}
      {loadError && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>Chargement des séries impossible : {loadError}</Text>
        </Card>
      )}

      {/* Création — action principale dès que la saisie ne matche rien */}
      {canCreate && (
        <Button
          icon={AddIcon}
          text={`Créer la série « ${trimmed} » et l'assigner`}
          tone="primary"
          disabled={busy}
          loading={busy}
          onClick={handleCreate}
          width="fill"
        />
      )}

      {series === null && !loadError && (
        <Flex align="center" gap={2} padding={3}>
          <Spinner muted />
          <Text size={1} muted>
            Chargement des séries…
          </Text>
        </Flex>
      )}

      {/* État vide : aucune série n'existe encore */}
      {series !== null && series.length === 0 && (
        <Card padding={4} radius={2} tone="transparent" border>
          <Stack space={3}>
            <Text size={1} weight="semibold">
              Aucune série pour l&apos;instant.
            </Text>
            <Text size={1} muted>
              Tape un nom ci-dessus pour créer la première et y ranger cette
              photo dans la foulée.
            </Text>
          </Stack>
        </Card>
      )}

      {/* Aucun résultat : jamais un cul-de-sac, la création prend le relais */}
      {series !== null && series.length > 0 && filtered.length === 0 && (
        <Card padding={4} radius={2} tone="transparent" border>
          <Text size={1} muted>
            Aucune série ne correspond à « {trimmed} ». Le bouton ci-dessus la
            crée.
          </Text>
        </Card>
      )}

      {filtered.length > 0 && (
        <Stack space={1}>
          {filtered.map((s) => {
            const isCurrent = currentSeriesIds.includes(s._id);
            return (
              // Card `as="button"` plutôt que <Button> : ButtonProps n'expose
              // pas `children` (seulement `text`/`icon`), une ligne composée
              // ne s'y afficherait pas. Card rend ses enfants et fournit
              // l'anneau de focus clavier.
              <Card
                key={s._id}
                as="button"
                type="button"
                padding={3}
                radius={2}
                tone={isCurrent ? 'positive' : 'default'}
                __unstable_focusRing
                disabled={busy || isCurrent}
                aria-current={isCurrent || undefined}
                onClick={() => onAssign(s._id, s.title)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  cursor: isCurrent || busy ? 'default' : 'pointer',
                }}
              >
                <Flex align="center" justify="space-between" gap={3}>
                  <Flex align="center" gap={2}>
                    {isCurrent && <CheckmarkIcon />}
                    <Text size={1} weight={isCurrent ? 'semibold' : undefined}>
                      {s.title}
                    </Text>
                    {s.year && (
                      <Text size={0} muted>
                        {s.year}
                      </Text>
                    )}
                  </Flex>
                  <Badge tone={isCurrent ? 'positive' : 'default'} mode="outline">
                    {isCurrent
                      ? 'déjà rattachée'
                      : `${s.photoCount} photo${s.photoCount === 1 ? '' : 's'}`}
                  </Badge>
                </Flex>
              </Card>
            );
          })}
        </Stack>
      )}

    </Stack>
  );
}

export const AssignToSeriesAction: DocumentActionComponent = (
  props: DocumentActionProps
) => {
  const { id, type, draft, published, onComplete } = props;
  const client = useClient({ apiVersion: API_VERSION });
  const { patch } = useDocumentOperation(id, type);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doc = (draft ?? published) as
    | { series?: { _key?: string; _ref?: string }[] | { _ref?: string } | null }
    | null
    | undefined;

  // Tolère les deux formes : le champ est un TABLEAU depuis le 2026-08-21, mais
  // un document non encore migré (ou un draft resté en arrière) porte encore
  // une référence unique. Lire les deux évite d'afficher « aucune série » sur
  // une photo qui en a une, et donc d'en créer une seconde par erreur.
  const currentSeriesIds = useMemo(() => {
    const raw = doc?.series;
    if (Array.isArray(raw)) {
      return raw
        .map((r) => r?._ref)
        .filter((ref): ref is string => typeof ref === 'string');
    }
    return raw?._ref ? [raw._ref] : [];
  }, [doc?.series]);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    onComplete();
  }, [onComplete]);

  const handleAssign = useCallback(
    async (seriesId: string, seriesTitle: string) => {
      setBusy(true);
      setError(null);
      try {
        let targetId = seriesId;

        if (seriesId === '__create__') {
          // Même mécanique que la création depuis le champ « Séries » de la
          // photo (slug dé-doublonné, document créé PUBLIÉ) : une seule
          // fabrique, sinon les deux chemins de création divergent.
          const created = await createRefDoc(client, {
            type: 'series',
            title: seriesTitle,
            slugFallback: 'serie',
          });
          targetId = created._id;
        }

        // AJOUT, pas remplacement : une photo peut appartenir à plusieurs
        // séries. On réécrit le tableau complet plutôt que d'utiliser `insert`
        // — ça normalise au passage un document resté en référence unique, et
        // ça dé-doublonne sans dépendre de l'état exact en base.
        if (currentSeriesIds.includes(targetId)) {
          close();
          return;
        }
        patch.execute([
          {
            set: {
              series: [...currentSeriesIds, targetId].map((ref) => ({
                _key: ref,
                _type: 'reference',
                _ref: ref,
              })),
            },
          },
        ]);
        close();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Échec de l’assignation.'
        );
      } finally {
        setBusy(false);
      }
    },
    [client, patch, close, currentSeriesIds]
  );

  const handleDetach = useCallback(
    (seriesId: string) => {
      setBusy(true);
      setError(null);
      try {
        const next = currentSeriesIds.filter((ref) => ref !== seriesId);
        patch.execute([
          next.length === 0
            ? { unset: ['series'] }
            : {
                set: {
                  series: next.map((ref) => ({
                    _key: ref,
                    _type: 'reference',
                    _ref: ref,
                  })),
                },
              },
        ]);
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Échec du retrait.');
      } finally {
        setBusy(false);
      }
    },
    [patch, close, currentSeriesIds]
  );

  return {
    label:
      currentSeriesIds.length > 0
        ? 'Séries de cette photo'
        : 'Ajouter à une série',
    icon: StackCompactIcon,
    onHandle: () => setOpen(true),
    dialog: open && {
      type: 'dialog' as const,
      header: 'Ranger cette photo dans une série',
      onClose: close,
      content: (
        <SeriesPicker
          currentSeriesIds={currentSeriesIds}
          onAssign={handleAssign}
          onDetach={handleDetach}
          busy={busy}
          error={error}
        />
      ),
    },
  };
};
