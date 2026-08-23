import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Flex, Select, Stack, Text } from '@sanity/ui';
import { TrashIcon } from '@sanity/icons';
import {
  set,
  unset,
  useClient,
  useFormValue,
  type ArrayOfObjectsInputProps,
  type ObjectInputProps,
} from 'sanity';

/**
 * Fabrique d'inputs « choisir une référence en une liste déroulante ».
 *
 * **Pourquoi.** L'input de référence natif de Sanity affiche une valeur posée
 * comme une CARTE D'APERÇU, pas comme un champ. En changer demande quatre
 * gestes : « ⋯ » → « Replace » → clic dans le champ de recherche qui apparaît
 * enfin → choix. Vérifié dans la source installée (sanity 5.26) : la carte ne
 * bascule en champ de recherche que quand le focus est posé sur le chemin
 * `_ref` (`isEditing = !value?._ref || focusPath[0] === '_ref'`), et c'est
 * exactement ce que fait « Replace » (`handleReplace = () => onPathFocus(['_ref'])`).
 * Le détour n'est donc pas contournable par une option de schéma — il est
 * câblé dans le composant. D'où ce remplacement.
 *
 * **Ce que ça donne** : le champ EST la liste. Ouvrir + choisir = deux gestes,
 * et le clavier suffit (une balise `<select>` native sous `@sanity/ui`).
 *
 * **Périmètre — petits ensembles fermés UNIQUEMENT** (boîtiers, objectifs,
 * styles, séries : 4 à 13 documents). Une liste déroulante ne trie pas, ne
 * cherche pas et n'affiche pas de vignette : au-delà de quelques dizaines
 * d'entrées elle est PIRE que la recherche native. Ne pas la brancher sur un
 * champ qui pointe des `photo` (198 documents) — cf. `series.coverPhoto`, resté
 * volontairement en input natif.
 *
 * **Repli** : si la lecture des options échoue (réseau, droits), on rend
 * `renderDefault(props)` — l'éditeur retrouve le champ natif plutôt qu'un
 * champ mort. Même doctrine que `orderedRefsInput`.
 */

const API_VERSION = '2026-01-01';

type Option = { _id: string; label: string | null };

type RefValue = { _key?: string; _type?: string; _ref?: string };

export type QuickRefConfig = {
  /** GROQ ramenant les options `{ _id, label }`, déjà triées, drafts exclus. */
  query: string;
  /**
   * Paramètres calculés depuis l'id PUBLIÉ du document ouvert. Retourner
   * `null` = pas de fetch (document pas encore persisté).
   */
  params?: (publishedDocId: string) => Record<string, string> | null;
  labels: {
    loading: string;
    /** Aucune option n'existe dans le dataset. */
    none: string;
    /** Option vide du sélecteur simple (valeur non renseignée). */
    empty: string;
    /** Option vide du sélecteur d'ajout (tableau). */
    add: string;
    /** Libellé d'une référence qui ne correspond à aucun document. */
    unknown: string;
    /** Message affiché quand le maximum d'entrées est atteint (tableau). */
    max?: string;
  };
  /** Tableau seulement : nombre maximum d'entrées (masque l'ajout au-delà). */
  max?: number;
};

/** Clé d'item de tableau. Studio-only : aucun enjeu d'hydratation serveur. */
function itemKey(): string {
  return Math.random().toString(36).slice(2, 12);
}

function useOptions(config: QuickRefConfig) {
  const client = useClient({ apiVersion: API_VERSION });
  const rawId = useFormValue(['_id']);
  // Sur un brouillon, `_id` vaut `drafts.<id>` alors que les références
  // pointent l'id publié — d'où le strip.
  const docId = typeof rawId === 'string' ? rawId.replace(/^drafts\./, '') : '';

  const [state, setState] = useState<{
    options: Option[] | null;
    failed: boolean;
  }>({ options: null, failed: false });

  useEffect(() => {
    const params = config.params ? config.params(docId) : {};
    if (params === null) {
      setState({ options: [], failed: false });
      return;
    }
    let cancelled = false;
    client
      .fetch<Option[]>(config.query, params)
      .then((rows) => {
        if (!cancelled) setState({ options: rows ?? [], failed: false });
      })
      .catch(() => {
        // On ne masque pas l'échec : le champ natif reprend la main.
        if (!cancelled) setState({ options: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
    // `config` est figé à la création de l'input (une fabrique par champ).
  }, [client, docId, config]);

  return state;
}

/**
 * Options d'un sélecteur donné : les documents lisibles, moins ceux déjà pris
 * par les AUTRES lignes (dédoublonnage par construction — `Rule.unique()` n'a
 * plus rien à rattraper), plus la valeur courante même si elle est introuvable
 * (référence cassée, document dépublié). Sans cette dernière, un `<select>`
 * afficherait silencieusement sa première option à la place de la valeur
 * réelle : l'éditeur croirait lire une donnée qui n'est pas en base.
 */
function optionsFor(
  all: Option[],
  currentRef: string | undefined,
  taken: Set<string>,
  unknownLabel: string
): Option[] {
  const available = all.filter(
    (o) => o._id === currentRef || !taken.has(o._id)
  );
  if (currentRef && !all.some((o) => o._id === currentRef)) {
    return [{ _id: currentRef, label: unknownLabel }, ...available];
  }
  return available;
}

function renderOptions(options: Option[]) {
  return options.map((o) => (
    <option key={o._id} value={o._id}>
      {o.label ?? o._id}
    </option>
  ));
}

/** Champ `reference` simple (ex. `photo.camera`, `photo.lens`). */
export function createQuickRefInput(config: QuickRefConfig) {
  return function QuickRefInput(props: ObjectInputProps) {
    const { options, failed } = useOptions(config);
    const value = props.value as RefValue | undefined;
    const currentRef = value?._ref;

    if (failed) return props.renderDefault(props);

    if (options === null) {
      return (
        <Select disabled fontSize={2} padding={3} radius={2}>
          <option>{config.labels.loading}</option>
        </Select>
      );
    }

    if (options.length === 0 && !currentRef) {
      return (
        <Card padding={3} radius={2} tone="caution">
          <Text size={1}>{config.labels.none}</Text>
        </Card>
      );
    }

    return (
      <Select
        id={props.elementProps.id}
        onFocus={props.elementProps.onFocus}
        onBlur={props.elementProps.onBlur}
        disabled={props.readOnly}
        fontSize={2}
        padding={3}
        radius={2}
        value={currentRef ?? ''}
        onChange={(event) => {
          const next = event.currentTarget.value;
          props.onChange(
            next ? set({ _type: 'reference', _ref: next }) : unset()
          );
        }}
      >
        <option value="">{config.labels.empty}</option>
        {renderOptions(
          optionsFor(options, currentRef, new Set(), config.labels.unknown)
        )}
      </Select>
    );
  };
}

/** Champ `array of reference` (ex. `photo.series`, `photo.styles`). */
export function createQuickRefsArrayInput(config: QuickRefConfig) {
  return function QuickRefsArrayInput(props: ArrayOfObjectsInputProps) {
    const { options, failed } = useOptions(config);

    const value = useMemo(
      () => ((props.value ?? []) as unknown as RefValue[]),
      [props.value]
    );
    const taken = useMemo(
      () =>
        new Set(
          value.map((v) => v._ref).filter((r): r is string => Boolean(r))
        ),
      [value]
    );

    if (failed) return props.renderDefault(props);

    if (options === null) {
      return (
        <Select disabled fontSize={2} padding={3} radius={2}>
          <option>{config.labels.loading}</option>
        </Select>
      );
    }

    if (options.length === 0 && value.length === 0) {
      return (
        <Card padding={3} radius={2} tone="caution">
          <Text size={1}>{config.labels.none}</Text>
        </Card>
      );
    }

    function replaceAt(key: string | undefined, ref: string) {
      props.onChange(
        set(
          value.map((v) =>
            v._key === key
              ? // L'entrée est RECONSTRUITE, pas étendue (`{...v}`) : un
                // `_strengthenOnPublish` ou un `_weak` hérités de l'ancienne
                // cible survivraient au remplacement et Sanity tenterait de
                // renforcer une référence qui n'en a pas besoin. Seule la clé
                // d'item est conservée.
                { _key: v._key, _type: 'reference', _ref: ref }
              : v
          )
        )
      );
    }

    function removeAt(key: string | undefined) {
      const next = value.filter((v) => v._key !== key);
      // Tableau vidé → `unset()` plutôt qu'un `[]` résiduel : les vues
      // « Sans série » / « Sans style » et les alertes du Dashboard testent
      // les deux (`!defined(...) || count(...) == 0`), mais un document propre
      // évite d'avoir à y penser à chaque nouvelle requête.
      props.onChange(next.length > 0 ? set(next) : unset());
    }

    function append(ref: string) {
      props.onChange(
        set([...value, { _key: itemKey(), _type: 'reference', _ref: ref }])
      );
    }

    const remaining = options.filter((o) => !taken.has(o._id));
    const atMax = typeof config.max === 'number' && value.length >= config.max;

    return (
      <Stack space={2}>
        {value.map((item) => (
          <Flex key={item._key ?? item._ref} gap={2} align="center">
            <Select
              disabled={props.readOnly}
              fontSize={2}
              padding={3}
              radius={2}
              value={item._ref ?? ''}
              onChange={(event) =>
                replaceAt(item._key, event.currentTarget.value)
              }
            >
              {renderOptions(
                optionsFor(options, item._ref, taken, config.labels.unknown)
              )}
            </Select>
            <Button
              icon={TrashIcon}
              mode="bleed"
              tone="critical"
              padding={3}
              disabled={props.readOnly}
              aria-label={`Retirer ${
                options.find((o) => o._id === item._ref)?.label ?? 'cette entrée'
              }`}
              onClick={() => removeAt(item._key)}
            />
          </Flex>
        ))}

        {atMax ? (
          config.labels.max ? (
            <Text size={1} muted>
              {config.labels.max}
            </Text>
          ) : null
        ) : remaining.length > 0 ? (
          <Select
            id={value.length === 0 ? props.elementProps.id : undefined}
            onFocus={props.elementProps.onFocus}
            onBlur={props.elementProps.onBlur}
            disabled={props.readOnly}
            fontSize={2}
            padding={3}
            radius={2}
            // Sélecteur d'ajout : il ne PORTE pas de valeur, il en produit une.
            // Il retombe donc sur son option vide à chaque choix.
            value=""
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (next) append(next);
            }}
          >
            <option value="">{config.labels.add}</option>
            {renderOptions(remaining)}
          </Select>
        ) : null}
      </Stack>
    );
  };
}
