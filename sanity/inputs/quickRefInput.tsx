import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Flex, Select, Stack, Text, TextInput } from '@sanity/ui';
import { AddIcon, TrashIcon } from '@sanity/icons';
import {
  set,
  unset,
  useClient,
  useFormValue,
  type ArrayOfObjectsInputProps,
  type ObjectInputProps,
} from 'sanity';
import { createRefDoc, sameTitle } from '../lib/createRefDoc';

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
 *
 * ---
 *
 * ## Créer depuis le champ (`config.create`)
 *
 * Remplacer l'input natif a coûté son « Create new … » : la liste ne contenait
 * plus que l'existant, et rencontrer une série absente renvoyait l'éditeur
 * ailleurs dans le Studio — en abandonnant la photo en cours. Le geste est
 * rendu ici, sous une doctrine à quatre règles :
 *
 * 1. **Le bouton est SOUS le sélecteur, et il est subordonné** (`mode="bleed"`,
 *    corps 1). Le chemin normal reste « je choisis dans la liste » ; créer est
 *    le recours quand la liste n'a pas ce qu'il faut. Un bouton plein ferait
 *    deux actions principales sur un même champ.
 * 2. **Aucune boîte de dialogue.** Le formulaire de création tient en un champ
 *    (le titre) : il se déplie EN PLACE, à la place du bouton, et se replie
 *    après. Le contexte de la photo n'est jamais recouvert.
 * 3. **Un nom déjà pris ne crée RIEN.** La comparaison ignore casse et accents
 *    (`sameTitle`) : le document existant est rattaché, et on le dit. Sans
 *    cette garde, « street » et « Street » donneraient deux styles, donc deux
 *    groupes sur `/archives` — la fragmentation de taxonomie que la liste
 *    fermée était censée empêcher.
 * 4. **L'option créée est injectée dans la liste locale** avant même le
 *    refetch. Sinon le `<select>` afficherait « ⚠ introuvable » sur le document
 *    qu'on vient de créer : la liste d'options est fetchée une seule fois.
 *
 * Le bouton disparaît en lecture seule et au plafond d'un tableau (créer un 4ᵉ
 * style qu'on ne pourrait pas rattacher n'aurait aucun sens).
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
  /**
   * Création d'un document manquant depuis le champ. Omettre = pas de bouton
   * (le champ ne propose alors que l'existant).
   */
  create?: {
    /** Type du document créé — 'series', 'style', 'camera', 'lens'. */
    type: string;
    /** Libellé du bouton replié. Ex. « Créer une nouvelle série ». */
    button: string;
    /** Placeholder du champ de saisie déplié. */
    placeholder: string;
    /** Une phrase sous le champ : ce que la création fait, et ce qu'elle ne fait pas. */
    help: string;
    /** Slug de repli si le titre ne produit aucun caractère slugifiable. */
    slugFallback: string;
    /** Message quand le nom saisi existait déjà — `%s` = le titre trouvé. */
    duplicate: string;
  };
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

  /**
   * Insère une option fraîchement créée sans réinterroger le dataset. La liste
   * est fetchée UNE fois : sans ça, le `<select>` afficherait « ⚠ introuvable »
   * sur le document que l'éditeur vient lui-même de créer. Insertion à sa place
   * alphabétique, l'ordre étant celui de la GROQ (`order(title asc)`).
   */
  const addOption = useCallback((option: Option) => {
    setState((prev) =>
      prev.options === null
        ? prev
        : {
            ...prev,
            options: [...prev.options, option].sort((a, b) =>
              (a.label ?? a._id).localeCompare(b.label ?? b._id, 'fr')
            ),
          }
    );
  }, []);

  return { ...state, addOption };
}

/**
 * Bouton « Créer … » + son formulaire d'un champ, dépliés EN PLACE.
 *
 * Replié et déplié occupent le même emplacement : rien ne saute sous le
 * curseur. Clavier : `Entrée` crée, `Échap` referme, le champ prend le focus à
 * l'ouverture et le bouton le récupère à la fermeture.
 */
function CreateRefControl({
  create,
  options,
  disabled,
  onPicked,
}: {
  create: NonNullable<QuickRefConfig['create']>;
  /** Toutes les options connues — sert la garde anti-doublon. */
  options: Option[];
  disabled: boolean;
  /**
   * Un document est prêt à être référencé. `existed` = il était déjà au
   * catalogue (rien n'a été créé) : le champ appelant décide quoi en faire.
   */
  onPicked: (option: Option, existed: boolean) => void;
}) {
  const client = useClient({ apiVersion: API_VERSION });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Autofocus : le bouton a déjà exprimé l'intention, on peut taper.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // La confirmation s'efface d'elle-même : un message figé sous un champ
  // finit par décrire un état qui n'est plus vrai.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const close = useCallback(() => {
    setOpen(false);
    setName('');
    setError(null);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  const submit = useCallback(async () => {
    const title = name.trim();
    if (title.length < 2) {
      setError('Deux caractères minimum.');
      return;
    }

    // Garde anti-doublon AVANT toute écriture : on rattache l'existant.
    const existing = options.find((o) => o.label && sameTitle(o.label, title));
    if (existing) {
      onPicked(existing, true);
      setNotice(create.duplicate.replace('%s', existing.label ?? title));
      close();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await createRefDoc(client, {
        type: create.type,
        title,
        slugFallback: create.slugFallback,
      });
      onPicked({ _id: created._id, label: created.title }, false);
      close();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Création impossible.'
      );
    } finally {
      setBusy(false);
    }
  }, [client, create, name, options, onPicked, close]);

  if (!open) {
    return (
      <Stack space={2}>
        <Flex>
          <Button
            ref={buttonRef}
            icon={AddIcon}
            // Bleed + corps 1 : le chemin normal reste la liste au-dessus.
            // Créer est le recours, il ne doit pas lui disputer l'œil.
            mode="bleed"
            fontSize={1}
            padding={2}
            space={2}
            text={create.button}
            disabled={disabled}
            onClick={() => setOpen(true)}
          />
        </Flex>
        {notice && (
          <Text size={0} muted>
            {notice}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack space={2}>
      <Flex gap={2} align="center">
        <Box flex={1}>
          <TextInput
            ref={inputRef}
            value={name}
            placeholder={create.placeholder}
            disabled={busy}
            aria-label={create.button}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void submit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                close();
              }
            }}
          />
        </Box>
        <Button
          text="Créer"
          tone="primary"
          fontSize={1}
          padding={3}
          disabled={busy || name.trim().length < 2}
          loading={busy}
          onClick={() => void submit()}
        />
        <Button
          text="Annuler"
          mode="bleed"
          fontSize={1}
          padding={3}
          disabled={busy}
          onClick={close}
        />
      </Flex>
      {error ? (
        // Sous le champ concerné, jamais en toast : l'erreur doit rester
        // visible pendant qu'on corrige la saisie.
        <Card padding={2} radius={2} tone="critical">
          <Text size={1}>{error}</Text>
        </Card>
      ) : (
        <Text size={0} muted>
          {create.help}
        </Text>
      )}
    </Stack>
  );
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
    const { options, failed, addOption } = useOptions(config);
    const value = props.value as RefValue | undefined;
    const currentRef = value?._ref;

    const handlePicked = useCallback(
      (option: Option, existed: boolean) => {
        if (!existed) addOption(option);
        props.onChange(set({ _type: 'reference', _ref: option._id }));
      },
      // `props.onChange` est stable par contrat de l'API de formulaire Sanity.
      [addOption, props.onChange] // eslint-disable-line react-hooks/exhaustive-deps
    );

    if (failed) return props.renderDefault(props);

    if (options === null) {
      return (
        <Select disabled fontSize={2} padding={3} radius={2}>
          <option>{config.labels.loading}</option>
        </Select>
      );
    }

    const creator = config.create && !props.readOnly && (
      <CreateRefControl
        create={config.create}
        options={options}
        disabled={Boolean(props.readOnly)}
        onPicked={handlePicked}
      />
    );

    // Catalogue vide : l'état vide PORTE l'action plutôt que d'envoyer
    // l'éditeur la chercher ailleurs dans le Studio.
    if (options.length === 0 && !currentRef) {
      return (
        <Stack space={3}>
          <Card padding={3} radius={2} tone="caution">
            <Text size={1}>{config.labels.none}</Text>
          </Card>
          {creator}
        </Stack>
      );
    }

    return (
      <Stack space={2}>
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
        {creator}
      </Stack>
    );
  };
}

/** Champ `array of reference` (ex. `photo.series`, `photo.styles`). */
export function createQuickRefsArrayInput(config: QuickRefConfig) {
  return function QuickRefsArrayInput(props: ArrayOfObjectsInputProps) {
    const { options, failed, addOption } = useOptions(config);

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

    const handlePicked = useCallback(
      (option: Option, existed: boolean) => {
        if (!existed) addOption(option);
        // Déjà rattachée : ne rien écrire. Le message de `CreateRefControl`
        // dit que le document existait ; le champ, lui, est déjà à jour.
        if (taken.has(option._id)) return;
        props.onChange(
          set([
            ...value,
            { _key: itemKey(), _type: 'reference', _ref: option._id },
          ])
        );
      },
      [addOption, taken, value, props.onChange] // eslint-disable-line react-hooks/exhaustive-deps
    );

    if (failed) return props.renderDefault(props);

    if (options === null) {
      return (
        <Select disabled fontSize={2} padding={3} radius={2}>
          <option>{config.labels.loading}</option>
        </Select>
      );
    }

    const atMax = typeof config.max === 'number' && value.length >= config.max;

    // Au plafond, le bouton disparaît AVEC le sélecteur d'ajout : créer un
    // document qu'on ne pourrait pas rattacher dans la foulée est un cul-de-sac.
    const creator = config.create && !props.readOnly && !atMax && (
      <CreateRefControl
        create={config.create}
        options={options}
        disabled={Boolean(props.readOnly)}
        onPicked={handlePicked}
      />
    );

    // Catalogue vide : l'état vide PORTE l'action plutôt que d'envoyer
    // l'éditeur la chercher ailleurs dans le Studio.
    if (options.length === 0 && value.length === 0) {
      return (
        <Stack space={3}>
          <Card padding={3} radius={2} tone="caution">
            <Text size={1}>{config.labels.none}</Text>
          </Card>
          {creator}
        </Stack>
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

        {creator}
      </Stack>
    );
  };
}
