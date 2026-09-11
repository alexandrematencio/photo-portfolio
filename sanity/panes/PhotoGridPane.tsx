import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Select,
  Spinner,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import { AddIcon, SearchIcon } from '@sanity/icons';
import { DocumentStatusIndicator, SanityDefaultPreview, useClient } from 'sanity';
import { PaneContext, PaneLayoutContext } from 'sanity/_singletons';
import { usePaneRouter, type UserComponent } from 'sanity/structure';

import { PhotoRowMedia } from '../components/PhotoRowMedia';

const API_VERSION = '2026-01-01';
/** Largeur de la colonne en mode liste — celle des listes natives de Sanity (`currentMaxWidth`). */
const LIST_MAX_WIDTH = 350;
/** Côté minimal d'une case de la planche-contact : autant de colonnes que la largeur en permet. */
const TILE_MIN = 168;
/** Carré demandé au CDN pour une case — net en @2x jusqu'à ~200 px de côté. */
const TILE_IMG = 400;
/** Regroupe les événements du listener avant de relire (une transaction = plusieurs mutations). */
const REFETCH_DEBOUNCE = 250;

export type PhotoSort = 'year' | 'title' | 'updated' | 'created';

const SORT_LABELS: Record<PhotoSort, string> = {
  year: 'Année (récent → ancien)',
  title: 'Titre (A → Z)',
  updated: 'Modifiées récemment',
  created: 'Ajoutées récemment',
};

export type PhotoGridOptions = {
  /** Condition GROQ, SANS `_type == "photo"` (posé ici). */
  filter: string;
  params?: Record<string, unknown>;
  /** Tri par défaut (l'éditeur peut en changer en mode grille). */
  sort?: PhotoSort;
  /**
   * GROQ rendant un tableau d'ids : l'ordre de référence, qui prime sur le
   * tri (la curation, dans l'ordre de la home). Les photos absentes de cet
   * ordre suivent, triées.
   */
  orderQuery?: string;
  /** Filtre GROQ supplémentaire à écouter pour relire (ex. les Réglages, pour la curation). */
  listenAlso?: string;
  /** Bouton « Nouvelle photo » ; `null` = pas de création depuis ce panneau. */
  create: { template?: string } | null;
  emptyText: string;
};

type PhotoDoc = {
  _id: string;
  _rev: string;
  _updatedAt: string;
  _createdAt: string;
  title?: string;
  location?: string;
  year?: number;
  image?: { asset?: { _ref?: string } };
  hidden?: boolean;
};

type Row = {
  /** Id publié — celui des références, des enfants de panneau et de `PhotoRowMedia`. */
  id: string;
  /** La version affichée : brouillon s'il existe, sinon publiée (comme les listes natives). */
  doc: PhotoDoc;
  draft: PhotoDoc | null;
  published: PhotoDoc | null;
};

const PROJECTION = `{ _id, _rev, _updatedAt, _createdAt, title, location, year, image, hidden }`;

/**
 * Le panneau du Studio est étroit exprès quand une photo est ouverte à sa
 * droite : `Pane` ne pose `max-width` en style inline que si le layout lui en
 * donne un (jamais pour un panneau composant), la feuille de style a donc le
 * dernier mot. `:has()` cible le `Pane` qui contient ce composant en mode
 * liste — et lui seul.
 *
 * ⚠️ Un panneau se reconnaît à `data-pane-index`, PAS à `data-ui="Pane"` :
 * au rendu, `data-ui` nomme le GENRE de panneau (`ListPane`, `DocumentListPane`,
 * `Pane` pour les panneaux composants et les documents) — constaté sur le DOM
 * réel via `/studio-probe`, 2026-09-11.
 */
const PANE_CSS = `[data-pane-index]:has([data-photo-pane="list"]) { max-width: ${LIST_MAX_WIDTH}px; }`;

function publishedId(id: string): string {
  return id.startsWith('drafts.') ? id.slice('drafts.'.length) : id;
}

/** Réunit publié et brouillon d'une même photo en une ligne (cf. §11.15 pour le piège). */
function mergeRows(docs: PhotoDoc[]): Row[] {
  const rows = new Map<string, Row>();
  for (const doc of docs) {
    const id = publishedId(doc._id);
    const isDraft = doc._id !== id;
    const row = rows.get(id) ?? { id, doc, draft: null, published: null };
    if (isDraft) row.draft = doc;
    else row.published = doc;
    row.doc = row.draft ?? (row.published as PhotoDoc);
    rows.set(id, row);
  }
  return Array.from(rows.values());
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function compareBy(sort: PhotoSort): (a: Row, b: Row) => number {
  const byTitle = (a: Row, b: Row) =>
    (a.doc.title ?? '').localeCompare(b.doc.title ?? '', 'en');
  switch (sort) {
    case 'title':
      return byTitle;
    case 'updated':
      return (a, b) => b.doc._updatedAt.localeCompare(a.doc._updatedAt);
    case 'created':
      return (a, b) => b.doc._createdAt.localeCompare(a.doc._createdAt);
    case 'year':
    default:
      return (a, b) => (b.doc.year ?? -1) - (a.doc.year ?? -1) || byTitle(a, b);
  }
}

/**
 * Lecture + écoute des photos du panneau. Perspective `raw` pour voir les
 * brouillons ; relecture regroupée à chaque mutation qui touche le filtre, et
 * au retour de focus (filet si le listener refuse une fonction du filtre,
 * comme `now()`).
 */
function usePhotos(options: PhotoGridOptions) {
  const baseClient = useClient({ apiVersion: API_VERSION });
  const client = useMemo(
    () => baseClient.withConfig({ perspective: 'raw' }),
    [baseClient]
  );
  const { filter, orderQuery, listenAlso } = options;
  const paramsKey = JSON.stringify(options.params ?? {});
  const [state, setState] = useState<{
    rows: Row[] | null;
    order: string[] | null;
    error: string | null;
  }>({ rows: null, order: null, error: null });

  useEffect(() => {
    const params = JSON.parse(paramsKey) as Record<string, unknown>;
    const query = `{
      "docs": *[_type == "photo" && (${filter})] ${PROJECTION},
      "order": ${orderQuery ?? 'null'}
    }`;
    let cancelled = false;
    let timer: number | undefined;
    const load = () => {
      client
        .fetch<{ docs: PhotoDoc[]; order: string[] | null }>(query, params)
        .then((result) => {
          if (cancelled) return;
          setState({
            rows: mergeRows(result.docs),
            order: result.order,
            error: null,
          });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : 'Erreur inconnue',
          }));
        });
    };
    const scheduleLoad = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, REFETCH_DEBOUNCE);
    };
    load();
    const listenFilter = `*[(_type == "photo" && (${filter}))${listenAlso ? ` || (${listenAlso})` : ''}]`;
    const subscription = client
      .listen(listenFilter, params, {
        includeResult: false,
        includePreviousRevision: false,
        visibility: 'query',
        events: ['mutation'],
      })
      .subscribe({
        next: scheduleLoad,
        // Filtre refusé par le listener : on vit sans temps réel, le focus relit.
        error: () => undefined,
      });
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      subscription.unsubscribe();
      window.removeEventListener('focus', load);
    };
  }, [client, filter, paramsKey, orderQuery, listenAlso]);

  return state;
}

/**
 * Quand une photo est ouverte à droite, les panneaux à GAUCHE de celui-ci
 * (« Contenu », « Photos ») se replient pour lui laisser la largeur ; ils se
 * redéploient quand elle se ferme — seulement ceux qu'on a repliés nous-mêmes,
 * et seulement s'ils sont encore montés (`expand` sur un élément démonté
 * laisserait le layout compter la largeur d'un fantôme).
 */
function useCollapseLeftPanes(active: boolean) {
  const layout = useContext(PaneLayoutContext);
  const pane = useContext(PaneContext);
  const layoutRef = useRef(layout);
  const paneRef = useRef(pane);
  const collapsedByUs = useRef<HTMLElement[]>([]);
  useEffect(() => {
    layoutRef.current = layout;
    paneRef.current = pane;
  });
  useEffect(() => {
    const l = layoutRef.current;
    const index = paneRef.current?.index;
    if (!l || index === undefined) return;
    if (active) {
      const targets = l.panes
        .slice(0, index)
        .filter((p) => !p.collapsed)
        .map((p) => p.element);
      for (const el of targets) l.collapse(el);
      collapsedByUs.current = targets;
      return;
    }
    const mounted = new Set(l.panes.map((p) => p.element));
    for (const el of collapsedByUs.current) if (mounted.has(el)) l.expand(el);
    collapsedByUs.current = [];
  }, [active]);
}

type PaneProps = ComponentProps<UserComponent>;

/**
 * Liste de photos de Structure, en deux états (skill sanity-studio §11.21) :
 *
 * - **Planche-contact** quand rien n'est ouvert à sa droite : le panneau prend
 *   toute la largeur restante (un panneau composant n'a pas de `maxWidth`,
 *   contrairement aux listes natives bornées à 350 px) et pose autant de
 *   colonnes que la largeur en permet.
 * - **Colonne** dès qu'une photo est ouverte : lignes natives (vignette avec
 *   l'œil, titre, lieu, pastille brouillon/publié), largeur bornée à celle des
 *   listes de Sanity, panneaux de gauche repliés.
 *
 * L'état se lit sur `childItemId` : Sanity le pose dès qu'un enfant du panneau
 * est ouvert. Aucun réglage à retenir, aucune URL à changer.
 */
export function PhotoGridPane(props: PaneProps) {
  const options = props.options as PhotoGridOptions;
  const { childItemId, isActive } = props;
  const listMode = Boolean(childItemId);
  const { ChildLink } = usePaneRouter();
  const { rows, order, error } = usePhotos(options);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<PhotoSort>(options.sort ?? 'year');
  const [newId, setNewId] = useState(() => crypto.randomUUID());

  useCollapseLeftPanes(listMode);

  const shown = useMemo(() => {
    if (!rows) return null;
    const q = fold(query.trim());
    const filtered = q
      ? rows.filter((r) =>
          fold(
            [r.doc.title, r.doc.location, r.doc.year].filter(Boolean).join(' ')
          ).includes(q)
        )
      : rows;
    const cmp = compareBy(sort);
    if (!order) return filtered.slice().sort(cmp);
    const rank = new Map(order.map((id, i) => [id, i] as const));
    const r = (row: Row) => rank.get(row.id) ?? Number.POSITIVE_INFINITY;
    return filtered.slice().sort((a, b) => r(a) - r(b) || cmp(a, b));
  }, [rows, query, sort, order]);

  const template = options.create?.template;
  const createLink = useMemo(
    () => ({
      childId: newId,
      childParameters: template ? { template } : undefined,
    }),
    [newId, template]
  );
  // L'id du prochain document est tiré au clic : le lien courant garde le sien.
  const onCreateClick = useCallback(() => setNewId(crypto.randomUUID()), []);

  return (
    <Stack
      data-photo-pane={listMode ? 'list' : 'grid'}
      space={listMode ? 2 : 3}
      padding={2}
    >
      <style>{PANE_CSS}</style>

      <Flex gap={2} align="center">
        <Box flex={1}>
          <TextInput
            icon={SearchIcon}
            fontSize={1}
            padding={2}
            placeholder={listMode ? 'Filtrer' : 'Filtrer par titre, lieu ou année'}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            clearButton={query.length > 0}
            onClear={() => setQuery('')}
          />
        </Box>
        {!listMode && !order && (
          // `flex="none"` : le `Select` de Sanity UI s'étire sur toute la largeur
          // disponible ; posé nu dans la rangée, il prenait TOUT et le filtre
          // tombait à 0 px (mesuré sur /studio-probe, 2026-09-11).
          <Box flex="none">
            <Select
              fontSize={1}
              padding={2}
              value={sort}
              onChange={(e) => setSort(e.currentTarget.value as PhotoSort)}
              aria-label="Trier"
            >
              {(Object.keys(SORT_LABELS) as PhotoSort[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </Select>
          </Box>
        )}
        {options.create && (
          // Le lien est le `<a>` du routeur des panneaux : le bouton n'y est
          // que pour le dessin (même montage que les raccourcis du Tableau de bord).
          <ChildLink {...createLink}>
            <Button
              icon={AddIcon}
              mode="ghost"
              fontSize={1}
              padding={2}
              text={listMode ? undefined : 'Nouvelle photo'}
              aria-label="Nouvelle photo"
              onClick={onCreateClick}
            />
          </ChildLink>
        )}
      </Flex>

      {error && (
        <Card padding={3} radius={2} tone="critical">
          <Text size={1}>Lecture impossible : {error}</Text>
        </Card>
      )}

      {!shown ? (
        <Flex align="center" justify="center" padding={4}>
          <Spinner muted />
        </Flex>
      ) : shown.length === 0 ? (
        <Box padding={3}>
          <Text size={1} muted>
            {query ? 'Aucune photo ne correspond.' : options.emptyText}
          </Text>
        </Box>
      ) : listMode ? (
        <Stack space={1}>
          {shown.map((row) => (
            <PhotoRow
              key={row.id}
              row={row}
              ChildLink={ChildLink}
              selected={Boolean(isActive) && childItemId === row.id}
              pressed={!isActive && childItemId === row.id}
            />
          ))}
        </Stack>
      ) : (
        <>
          <Text size={0} muted>
            {shown.length} photo{shown.length > 1 ? 's' : ''}
            {rows && shown.length !== rows.length ? ` sur ${rows.length}` : ''}
          </Text>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${TILE_MIN}px, 1fr))`,
              gap: 8,
            }}
          >
            {shown.map((row) => (
              <PhotoTile key={row.id} row={row} ChildLink={ChildLink} />
            ))}
          </div>
        </>
      )}
    </Stack>
  );
}

type LinkProps = { ChildLink: ReturnType<typeof usePaneRouter>['ChildLink'] };

/**
 * La carte-lien des lignes et des cases : un `Card` rendu EN `ChildLink`
 * (c'est le montage de `PaneItem` natif, avec `PreviewCard`). `Card` plutôt
 * que `PreviewCard` : le type publié de ce dernier croise `as` avec celui de
 * `HTMLProps` (`ElementType & string`), ce qui refuse tout composant — un
 * défaut de typage, pas de mécanique. `data-photo-row` remplace le
 * `data-ui="PreviewCard"` que `PhotoRowMedia` cherche pour détecter le survol.
 * Les props du lien passent en spread : `Card` est polymorphe mais son type
 * ne connaît pas `childId`.
 */
function LinkCard({
  ChildLink,
  id,
  children,
  ...cardProps
}: LinkProps & { id: string; children: ReactNode } & Omit<
    ComponentProps<typeof Card>,
    'as' | 'children'
  >) {
  const link = { childId: id };
  return (
    <Card
      as={ChildLink}
      {...link}
      data-as="a"
      data-photo-row=""
      radius={2}
      tone="inherit"
      sizing="border"
      __unstable_focusRing
      {...cardProps}
    >
      {children}
    </Card>
  );
}

/** Ligne du mode colonne — le dessin des listes natives (`PaneItem`), sans leur menu de tri. */
function PhotoRow({
  row,
  ChildLink,
  selected,
  pressed,
}: LinkProps & { row: Row; selected: boolean; pressed: boolean }) {
  return (
    <LinkCard ChildLink={ChildLink} id={row.id} selected={selected} pressed={pressed}>
      <SanityDefaultPreview
        layout="default"
        title={row.doc.title ?? 'Sans titre'}
        subtitle={row.doc.location}
        media={
          <PhotoRowMedia
            id={row.id}
            title={row.doc.title ?? 'La photo'}
            image={row.doc.image}
            hidden={row.doc.hidden === true}
          />
        }
        status={
          <DocumentStatusIndicator
            draft={row.draft ?? undefined}
            published={row.published ?? undefined}
          />
        }
      />
    </LinkCard>
  );
}

/** Case de la planche-contact : la photo d'abord, le texte en dessous. */
function PhotoTile({ row, ChildLink }: LinkProps & { row: Row }) {
  const meta = [row.doc.year, row.doc.location].filter(Boolean).join(' · ');
  return (
    <LinkCard
      ChildLink={ChildLink}
      id={row.id}
      overflow="hidden"
      border
      style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
    >
      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--card-border-color, #222)',
        }}
      >
        <PhotoRowMedia
          id={row.id}
          title={row.doc.title ?? 'La photo'}
          image={row.doc.image}
          hidden={row.doc.hidden === true}
          size={TILE_IMG}
        />
      </div>
      <Box padding={2}>
        <Stack space={2}>
          <Flex align="center" gap={2}>
            <Box flex={1} style={{ minWidth: 0 }}>
              <Text size={1} weight="medium" textOverflow="ellipsis">
                {row.doc.title ?? 'Sans titre'}
              </Text>
            </Box>
            <DocumentStatusIndicator
              draft={row.draft ?? undefined}
              published={row.published ?? undefined}
            />
          </Flex>
          <Text size={0} muted textOverflow="ellipsis">
            {meta || '—'}
          </Text>
        </Stack>
      </Box>
    </LinkCard>
  );
}
