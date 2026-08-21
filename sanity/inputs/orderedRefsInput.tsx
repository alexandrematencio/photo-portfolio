import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Flex, Spinner, Stack, Text } from '@sanity/ui';
import { AddIcon, TrashIcon } from '@sanity/icons';
import {
  set,
  useClient,
  useFormValue,
  type ArrayOfObjectsInputProps,
} from 'sanity';

/**
 * Fabrique d'inputs pour les champs « tableau ordonné de références » servant
 * de CLÉ DE TRI (cf. CLAUDE.md §11.12) : `series.photoOrder` et
 * `siteSettings.seriesOrder`.
 *
 * **Pourquoi un composant custom.** Le champ natif part d'un tableau VIDE :
 * pour ranger N items, il faudrait d'abord les ajouter un par un via un champ
 * de recherche — avant même de pouvoir en glisser un seul. L'éditeur s'attend
 * à ouvrir le champ et à trouver ses items déjà là, prêts à être déplacés. Ce
 * composant ajoute ce chaînon manquant : un bouton qui charge les items dans
 * l'ordre où le site les affiche aujourd'hui. Ensuite, glisser-déposer natif.
 *
 * Tout le reste est délégué à `renderDefault` : réordonnancement, vignettes,
 * suppression, validation. Aucune réimplémentation d'un input de tableau.
 *
 * Le champ reste une clé de tri : le bouton n'écrit pas une appartenance, il
 * matérialise l'ordre implicite pour le rendre manipulable. Ne rien charger
 * reste parfaitement valide — le site retombe alors sur l'ordre de repli. Et
 * les écarts détectés (item manquant, entrée obsolète) ne sont JAMAIS corrigés
 * automatiquement : chaque correction est un bouton, donc un geste de
 * l'éditeur (§11.12 — pas de resynchronisation automatique).
 */

const API_VERSION = '2026-01-01';

type Member = { _id: string; title: string | null };

export type OrderedRefsConfig = {
  /**
   * GROQ ramenant les items ordonnables (`{ _id, title }`), dans l'ordre de
   * REPLI du site — c'est cet ordre que « Charger » matérialise.
   */
  query: string;
  /**
   * Paramètres de la query, calculés depuis l'id PUBLIÉ du document en cours.
   * Retourner `null` = pas de fetch (ex. document pas encore persisté).
   */
  params?: (publishedDocId: string) => Record<string, string> | null;
  labels: {
    loading: string;
    /** Tous les items sont rangés. */
    complete: (count: number) => string;
    /** Le tableau est vide, `count` items sont chargeables. */
    empty: (count: number) => string;
    /** `count` items ne sont pas encore dans l'ordre. */
    missing: (count: number) => string;
    /** `count` entrées pointent des items qui n'existent plus. */
    stale: (count: number) => string;
    loadButton: string;
    addButton: (count: number) => string;
    removeButton: (count: number) => string;
  };
};

/** Clé d'item de tableau. Studio-only : aucun enjeu d'hydratation serveur. */
function itemKey(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function createOrderedRefsInput(config: OrderedRefsConfig) {
  return function OrderedRefsInput(props: ArrayOfObjectsInputProps) {
    const client = useClient({ apiVersion: API_VERSION });
    const rawId = useFormValue(['_id']);
    // Sur un brouillon, `_id` vaut `drafts.<id>` alors que les références
    // pointent l'id publié — d'où le strip.
    const docId =
      typeof rawId === 'string' ? rawId.replace(/^drafts\./, '') : '';

    const [members, setMembers] = useState<Member[] | null>(null);

    useEffect(() => {
      const params = config.params ? config.params(docId) : {};
      if (params === null) {
        setMembers([]);
        return;
      }
      let cancelled = false;
      client
        .fetch<Member[]>(config.query, params)
        .then((rows) => {
          if (cancelled) return;
          // Un document publié ET édité en brouillon remonte DEUX fois (`X` et
          // `drafts.X`). Les références pointent l'id publié : on ramène tout
          // au même id et on dé-doublonne, sinon l'item serait compté manquant
          // à vie et le bouton ne disparaîtrait jamais.
          const seen = new Set<string>();
          const rebased: Member[] = [];
          for (const row of rows) {
            const id = row._id.replace(/^drafts\./, '');
            if (seen.has(id)) continue;
            seen.add(id);
            rebased.push({ _id: id, title: row.title });
          }
          setMembers(rebased);
        })
        .catch(() => {
          // Échec réseau : on n'affiche simplement pas l'assistance, le champ
          // natif en dessous reste pleinement utilisable.
          if (!cancelled) setMembers([]);
        });
      return () => {
        cancelled = true;
      };
    }, [client, docId]);

    const value = useMemo(
      () =>
        (props.value ?? []) as unknown as {
          _key: string;
          _type?: string;
          _ref?: string;
        }[],
      [props.value]
    );

    const { missing, stale } = useMemo(() => {
      if (!members) return { missing: [] as Member[], stale: [] as string[] };
      const listed = new Set(
        value.map((v) => v._ref).filter((ref): ref is string => Boolean(ref))
      );
      const known = new Set(members.map((m) => m._id));
      return {
        // Ordonnables mais pas encore rangés.
        missing: members.filter((m) => !listed.has(m._id)),
        // Rangés ici mais qui n'existent plus (clés d'items à retirer).
        stale: value
          .filter((v) => v._ref && !known.has(v._ref))
          .map((v) => v._key),
      };
    }, [members, value]);

    function addMissing() {
      props.onChange(
        set([
          ...value,
          ...missing.map((m) => ({
            _key: itemKey(),
            _type: 'reference',
            _ref: m._id,
          })),
        ])
      );
    }

    function removeStale() {
      const staleKeys = new Set(stale);
      props.onChange(set(value.filter((v) => !staleKeys.has(v._key))));
    }

    const loading = members === null;
    const complete = !loading && missing.length === 0 && stale.length === 0;
    const { labels } = config;

    return (
      <Stack space={3}>
        <Card padding={3} radius={2} tone={complete ? 'positive' : 'caution'}>
          <Flex align="center" gap={3} wrap="wrap">
            {loading ? (
              <Flex align="center" gap={2}>
                <Spinner muted />
                <Text size={1} muted>
                  {labels.loading}
                </Text>
              </Flex>
            ) : (
              <>
                <Text size={1} style={{ flex: 1, minWidth: 200 }}>
                  {complete
                    ? labels.complete(value.length)
                    : missing.length > 0 && value.length === 0
                      ? labels.empty(missing.length)
                      : missing.length > 0
                        ? labels.missing(missing.length)
                        : labels.stale(stale.length)}
                </Text>
                {missing.length > 0 && (
                  <Button
                    icon={AddIcon}
                    text={
                      value.length === 0
                        ? labels.loadButton
                        : labels.addButton(missing.length)
                    }
                    tone="primary"
                    mode="ghost"
                    fontSize={1}
                    padding={2}
                    onClick={addMissing}
                  />
                )}
                {stale.length > 0 && (
                  <Button
                    icon={TrashIcon}
                    text={labels.removeButton(stale.length)}
                    tone="critical"
                    mode="ghost"
                    fontSize={1}
                    padding={2}
                    onClick={removeStale}
                  />
                )}
              </>
            )}
          </Flex>
        </Card>

        {props.renderDefault(props)}
      </Stack>
    );
  };
}
