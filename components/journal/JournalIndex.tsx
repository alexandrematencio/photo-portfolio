'use client';

import Link from 'next/link';
import { DICT, LONG_READ_MINUTES, THEME_PARAM, articleDate, articlePath, seriesPath, type Lang } from '@/lib/journal/i18n';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { StateDot } from '@/components/site/StateDot';
import { ListSelector } from '@/components/site/ListSelector';
import { EDITORIAL_SIDENOTE, MICRO_LABEL, PAGE_TITLE_GAP } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import { TagSwatch } from '@/components/journal/TagSwatch';
import type { ArticleSummary } from '@/lib/journal/types';

/**
 * PAGE D'ACCUEIL DU JOURNAL — reprise de stripe.dev/blog (demande Alexandre,
 * 2026-10-17), traduite dans la grammaire du site (brand book §14.7) :
 *
 * - une colonne de filtres à gauche (« Séries »), collante ;
 * - un index en lignes : « Date », « Titre », un « + » qui déplie le
 *   sous-titre DANS la ligne (2026-10-22) — elle grandit et pousse les
 *   suivantes ;
 * - au survol, la ligne s'inverse — encre sur papier devient papier sur
 *   encre. Stripe la passe en vert ; ici l'orange n'a pas le droit d'être une
 *   surface (§4.3), il reste ce qu'il est partout : le voyant de la ligne
 *   active.
 *
 * Sous `md`, la colonne de filtres monte au-dessus de l'index : les mêmes
 * dossiers, leurs entrées à la suite (`FolderFlow`). Un `ListSelector` ne
 * reste que tant qu'aucune thématique n'existe.
 *
 * Une ligne qui appartient à une série le dit sous son titre (2026-10-19,
 * descendue de la colonne de droite le 2026-10-21) : une flèche, le nom de la
 * série et sa partie « 2/3 » encadrée. C'est un LIEN vers la page de la
 * série, au bleu du logo (les thématiques restent grises) : l'ensemble se
 * rejoint depuis l'index sans passer par les filtres. Sous le titre, un nom de
 * série long ne prend plus la largeur du titre. Filtrée sur une série, la
 * ligne ne garde que la partie : le nom est déjà dans le filtre.
 *
 * Les THÉMATIQUES (2026-10-19) : un second filtre, qui se combine au premier
 * (série ET thématique). Les deux partagent la même place : deux DOSSIERS
 * (`Folder`, 2026-10-24 ; des onglets avant), séries ouvertes par défaut ;
 * ouvrir l'un n'est qu'une vue,
 * il ne remet aucun filtre à zéro — un voyant sur le fermé dit qu'il
 * filtre encore. Les dossiers n'apparaissent qu'à la première thématique posée
 * sur un article. Les compteurs d'un filtre se lisent dans l'autre — « (3) »
 * promet trois lignes. La thématique choisie s'écrit dans l'adresse
 * (`?theme=`) : c'est le lien que posent les pages d'article, et elle ouvre
 * le dossier des thématiques. Chaque ligne de l'index nomme ses thématiques
 * sous son titre.
 *
 * Plusieurs thématiques peuvent filtrer à la fois (2026-10-22, demande
 * Alexandre) : un article passe s'il en porte UNE (ou, pas et — chaque thème
 * ajouté élargit). Dès qu'une thématique filtre, un bandeau « Filtrage » coiffe
 * l'index (`ThemeBar`) : ce qui filtre, un « Tout afficher » pour en sortir sans
 * chercher la colonne, et toutes les thématiques en bascules. Un clic sur la
 * thématique d'une ligne, lui, REMPLACE le filtre — on change de piste ; on
 * cumule depuis le bandeau. La colonne de gauche garde le choix unique.
 *
 * Une thématique peut porter une COULEUR (Studio, 2026-10-21) : un carré
 * devant son nom, dans la ligne, la colonne de filtres et l'article
 * (`TagSwatch`).
 *
 * Sous les filtres, la COUVERTURE de l'article survolé (champ « Image de
 * couverture » du Studio, 2026-10-18 — elle remplace la vignette de la
 * Fig. 1). Toutes les couvertures sont montées, empilées, et seule celle de
 * la ligne active s'ouvre : rien ne se charge au survol. Mécanique et
 * timings : bloc « COUVERTURES DU JOURNAL » de `globals.css`.
 */

const ALL = '__all';

/** Filtre des articles qui n'appartiennent à aucune série (clé interne ; le libellé vient du dictionnaire). */
const HORS_SERIE = '__none';

/** Colonne des dates — « 17/10/26 » en chiffres tabulaires. */
const DATE_COL = 128;

/** Largeur de la colonne de filtres au-dessus de `md`. */
const FILTER_COL = 220;

/** Téléphone : écart drapeaux (bloc de titre) → onglets des filtres. */
const MOBILE_FILTERS_GAP = 28;

type Filter = { key: string; label: string; count: number; color?: string | null };

type Tab = 'series' | 'themes';

export function JournalIndex({
  articles,
  lang,
  language,
}: {
  articles: ArticleSummary[];
  lang: Lang;
  /** Le sélecteur de langue, posé en tête de la colonne de filtres. */
  language: ReactNode;
}) {
  const t = DICT[lang];
  const [series, setSeries] = useState(ALL);
  // Les thématiques qui filtrent ; vide = toutes.
  const [picked, setPickedState] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('series');
  const bar = useRef<HTMLDivElement | null>(null);
  // La ligne survolée (ou focalisée) : sa couverture s'ouvre dans la colonne de gauche.
  const [active, setActive] = useState<string | null>(null);
  const covers = articles.filter((a) => a.cover);

  const inSeries = (a: ArticleSummary) => series === ALL || (a.series ?? HORS_SERIE) === series;
  const inTheme = (a: ArticleSummary) => picked.length === 0 || a.tags.some((tag) => picked.includes(tag.slug));

  // La liste des séries ne bouge pas ; ses compteurs suivent la thématique choisie.
  const filters = useMemo<Filter[]>(() => {
    const pool = articles.filter(inTheme);
    const counts = new Map<string, number>();
    for (const a of articles) counts.set(a.series ?? HORS_SERIE, 0);
    for (const a of pool) {
      const name = a.series ?? HORS_SERIE;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [
      { key: ALL, label: t.all, count: pool.length },
      // « Hors série » ferme la liste : c'est le reste, pas une série de plus
      // (même place que « Autres » dans un filtre, 2026-10-24).
      ...[...counts]
        .sort(([a], [b]) => Number(a === HORS_SERIE) - Number(b === HORS_SERIE))
        .map(([name, count]) => ({ key: name, label: name === HORS_SERIE ? t.noSeries : name, count })),
    ];
  }, [articles, t, picked]);

  // Les thématiques, par ordre alphabétique : la liste grandit avec le
  // journal, on y cherche un mot, pas un rang. Vide : pas de groupe.
  const themes = useMemo<Filter[]>(() => {
    const names = new Map<string, string>();
    const colors = new Map<string, string | null>();
    for (const a of articles) {
      for (const tag of a.tags) {
        names.set(tag.slug, tag.title);
        colors.set(tag.slug, tag.color);
      }
    }
    if (names.size === 0) return [];
    const pool = articles.filter(inSeries);
    return [
      { key: ALL, label: t.all, count: pool.length },
      ...[...names]
        .sort(([, x], [, y]) => x.localeCompare(y, lang))
        .map(([slug, title]) => ({
          key: slug,
          label: title,
          color: colors.get(slug),
          count: pool.filter((a) => a.tags.some((tag) => tag.slug === slug)).length,
        })),
    ];
  }, [articles, t, lang, series]);

  // `?theme=<slug>,<slug>` : lu au montage (l'export est statique, le HTML
  // servi ne connaît pas l'adresse), réécrit à chaque choix pour que l'adresse
  // se partage. Un slug inconnu (thématique retirée depuis) est ignoré.
  useEffect(() => {
    const slugs = (new URLSearchParams(window.location.search).get(THEME_PARAM) ?? '')
      .split(',')
      .filter((slug) => articles.some((a) => a.tags.some((tag) => tag.slug === slug)));
    if (slugs.length) {
      setPickedState(slugs);
      setTab('themes');
    }
  }, [articles]);

  const setPicked = (slugs: string[]) => {
    setPickedState(slugs);
    const url = new URL(window.location.href);
    if (slugs.length === 0) url.searchParams.delete(THEME_PARAM);
    else url.searchParams.set(THEME_PARAM, slugs.join(','));
    window.history.replaceState(window.history.state, '', url);
  };

  // Depuis les dossiers : un seul choix, « Tout » vide le filtre.
  const setTheme = (key: string) => {
    setPicked(key === ALL ? [] : [key]);
  };

  // Bascule depuis le bandeau : ajoute ou retire, dans l'ordre de la liste.
  const toggleTheme = (key: string) => {
    const next = picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key];
    setPicked(themes.map((f) => f.key).filter((k) => next.includes(k)));
  };

  // Depuis une ligne : le filtre passe à CETTE thématique. Si le bandeau est
  // au-dessus de l'écran (ligne lointaine, ou téléphone), on y remonte pour que
  // le tri se voie. Il ne grandit que vers le bas : son haut ne bouge pas
  // pendant qu'il s'ouvre, la cible tient.
  const pickTheme = (key: string) => {
    setPicked([key]);
    setTab('themes');
    const box = bar.current;
    if (box && box.getBoundingClientRect().top < 0) {
      const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      box.scrollIntoView({ block: 'start', behavior: instant ? 'auto' : 'smooth' });
    }
  };

  // La page de la série choisie dans les filtres : le filtre trie, la page présente.
  const seriesSlug = series === ALL ? null : (articles.find((a) => a.series === series)?.seriesSlug ?? null);
  const seriesLink = seriesSlug && (
    <Link
      href={seriesPath(seriesSlug, lang)}
      className={cn(MICRO_LABEL, 'group flex w-fit items-center gap-2 text-[var(--color-fg)] underline underline-offset-4')}
    >
      {t.seriesPage}
      <span aria-hidden className="no-underline transition-[translate] duration-200 ease-out group-hover:translate-x-[3px] motion-reduce:transition-none">
        →
      </span>
    </Link>
  );

  // Nombre de parties de chaque série : les articles publiés dans cette
  // langue, ou la plus haute partie si une traduction manque au milieu.
  const totals = useMemo(() => {
    const out = new Map<string, number>();
    for (const a of articles) {
      if (a.series) out.set(a.series, Math.max(out.get(a.series) ?? 0, a.part));
    }
    for (const [name, n] of out) out.set(name, Math.max(n, articles.filter((a) => a.series === name).length));
    return out;
  }, [articles]);

  const shown = articles.filter((a) => inSeries(a) && inTheme(a));
  const tabsId = useId();
  // Le voyant de chaque onglet : son filtre trie-t-il encore ?
  const lit = { series: series !== ALL, themes: picked.length > 0 };

  const seriesSelector = (
    <ListSelector
      hint={t.seriesHint}
      ariaLabel={t.filterBySeries}
      items={filters}
      value={series}
      onChange={setSeries}
      mark="dot"
      tone="plate"
      lit={series !== ALL}
    />
  );

  return (
    <div className="flex flex-col md:grid md:gap-x-12" style={{ gridTemplateColumns: `${FILTER_COL}px minmax(0, 1fr)` }}>
      {/* FILTRES — téléphone. Les drapeaux vivent dans le bloc de titre
          (`JournalHome`) : le bloc remonte vers eux, l'écart de page
          (`PAGE_TITLE_GAP`) ramené à MOBILE_FILTERS_GAP — les onglets suivent
          la langue au lieu d'attendre après un grand blanc (2026-10-20). */}
      <div
        className="md:hidden"
        style={{ marginTop: MOBILE_FILTERS_GAP - PAGE_TITLE_GAP, marginBottom: 32, scrollMarginTop: 16 }}
      >
        {themes.length === 0 ? (
          <>
            {seriesSelector}
            {seriesLink && <div style={{ marginTop: 16 }}>{seriesLink}</div>}
          </>
        ) : (
          <div role="group" aria-label={t.filters} className="flex flex-col">
            <Folder
              id={`${tabsId}-m-series`}
              name={t.seriesHeading}
              open={tab === 'series'}
              onOpen={() => setTab('series')}
              lit={lit.series}
              entries={filters.length - 1}
              roomy
            >
              <FolderFlow items={filters} isOn={(key) => key === series} onChange={setSeries} after={seriesLink} />
            </Folder>
            <Folder
              id={`${tabsId}-m-themes`}
              name={t.themesHeading}
              open={tab === 'themes'}
              onOpen={() => setTab('themes')}
              lit={lit.themes}
              entries={themes.length - 1}
              roomy
            >
              <FolderFlow
                items={themes}
                isOn={(key) => (key === ALL ? picked.length === 0 : picked.includes(key))}
                onChange={setTheme}
              />
            </Folder>
          </div>
        )}
      </div>

      {/* FILTRES — desktop, colonne collante */}
      <aside className="hidden md:flex flex-col gap-10 self-start sticky top-6" aria-label={t.filters}>
        {language}
        {themes.length === 0 ? (
          <FilterGroup heading={t.seriesHeading} items={filters} isOn={(key) => key === series} onChange={setSeries}>
            {seriesLink && <div style={{ paddingTop: 16 }}>{seriesLink}</div>}
          </FilterGroup>
        ) : (
          <div role="group" aria-label={t.filters} className="flex flex-col">
            <Folder
              id={`${tabsId}-d-series`}
              name={t.seriesHeading}
              open={tab === 'series'}
              onOpen={() => setTab('series')}
              lit={lit.series}
              entries={filters.length - 1}
            >
              <FolderList items={filters} isOn={(key) => key === series} onChange={setSeries}>
                {seriesLink && <div style={{ paddingBottom: 10, paddingLeft: TREE_INDENT }}>{seriesLink}</div>}
              </FolderList>
            </Folder>
            <Folder
              id={`${tabsId}-d-themes`}
              name={t.themesHeading}
              open={tab === 'themes'}
              onOpen={() => setTab('themes')}
              lit={lit.themes}
              entries={themes.length - 1}
            >
              <FolderList
                items={themes}
                isOn={(key) => (key === ALL ? picked.length === 0 : picked.includes(key))}
                onChange={setTheme}
              />
            </Folder>
          </div>
        )}

        {covers.length > 0 && (
          <div className="journal-covers" aria-hidden>
            {covers.map((a) => (
              <div key={a.slug} className="journal-cover" data-on={a.slug === active ? '' : undefined}>
                <img
                  src={a.cover!.src}
                  srcSet={a.cover!.srcSet}
                  sizes={`${FILTER_COL}px`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{ objectPosition: a.cover!.position }}
                />
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* INDEX */}
      <section aria-label="Articles" className="flex flex-col min-w-0">
        <ThemeBar
          ref={bar}
          lang={lang}
          themes={themes.filter((f) => f.key !== ALL)}
          picked={picked}
          onToggle={toggleTheme}
          onClear={() => setPicked([])}
        />
        <div
          className={cn(MICRO_LABEL, 'hidden md:grid text-[var(--color-fg-muted)]')}
          style={{
            gridTemplateColumns: `${DATE_COL}px minmax(0, 1fr)`,
            paddingBottom: 12,
            borderBottom: '1px solid var(--color-line)',
          }}
        >
          {/* Aligné sur le texte des dates : retrait de ligne (8) + voyant (7) + écart (10). */}
          <span style={{ paddingLeft: 25 }}>{t.dateCol}</span>
          <span>{t.titleCol}</span>
        </div>
        {shown.length === 0 ? (
          <p className={cn(EDITORIAL_SIDENOTE, 'text-[15px]')} style={{ paddingBlock: 24 }}>
            {t.noArticles}
          </p>
        ) : (
          <ol className="flex flex-col">
            {shown.map((a) => (
              <Row
                key={a.slug}
                article={a}
                lang={lang}
                total={a.series ? (totals.get(a.series) ?? 0) : 0}
                showSeriesName={series === ALL}
                onTheme={pickTheme}
                onHot={(on) => setActive((cur) => (on ? a.slug : cur === a.slug ? null : cur))} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/**
 * Le bandeau « Filtrage » (2026-10-22) : il coiffe l'index tant qu'une
 * thématique filtre. Première ligne, ce qui filtre — à l'encre — et la sortie,
 * « × Tout afficher », au fer droit. Dessous, toutes les thématiques en
 * bascules, voyant compris : la grammaire de la colonne de filtres, au corps
 * des thématiques de ligne. Le voyant est toujours rendu, c'est son opacité
 * qui bascule : un clic ne décale jamais la rangée.
 *
 * Il s'ouvre comme le dépli d'une ligne (grille 0fr → 1fr, 300 ms qui freine,
 * le texte 60 ms après la boîte ; fermeture 200 ms qui accélère). À la
 * fermeture il garde la dernière sélection affichée : sans elle, il se
 * viderait avant de se replier.
 */
function ThemeBar({
  ref,
  lang,
  themes,
  picked,
  onToggle,
  onClear,
}: {
  ref: Ref<HTMLDivElement>;
  lang: Lang;
  /** Toutes les thématiques, « Tout » exclu. */
  themes: Filter[];
  picked: string[];
  onToggle: (key: string) => void;
  onClear: () => void;
}) {
  const t = DICT[lang];
  const open = picked.length > 0;
  const last = useRef<string[]>([]);
  if (open) last.current = picked;
  const names = themes.filter((f) => last.current.includes(f.key)).map((f) => f.label);

  return (
    <div
      ref={ref}
      className={cn(
        'grid transition-[grid-template-rows] motion-reduce:transition-none',
        open ? 'duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : 'duration-200 ease-in',
      )}
      style={{ gridTemplateRows: open ? '1fr' : '0fr', scrollMarginTop: 16 }}
    >
      <div className="overflow-hidden" inert={!open}>
        <div
          className={cn(
            'transition-opacity motion-reduce:transition-none',
            open ? 'opacity-100 duration-300 ease-out delay-[60ms]' : 'opacity-0 duration-150 ease-in',
          )}
          // Retrait des lignes (8) : le voyant des bascules tombe dans la
          // colonne des voyants de l'index, « × Tout afficher » au fer du « + ».
          style={{ paddingBottom: 28, paddingInline: 8 }}
        >
          <div className="flex items-baseline justify-between gap-4">
            <p aria-live="polite" className={cn(MICRO_LABEL, 'min-w-0 text-[var(--color-fg-muted)]')}>
              {t.filtering}
              {lang === 'fr' ? '\u00a0: ' : ': '}
              <span className="text-[var(--color-fg)]">{names.join(', ')}</span>
            </p>
            <button
              type="button"
              onClick={onClear}
              className={cn(
                MICRO_LABEL,
                'group/clear shrink-0 flex items-baseline gap-[6px] text-[var(--color-fg)]',
              )}
            >
              {/* Une croix DESSINÉE à la hauteur des capitales (7 px ; mesurée,
                  la capitale de l'étiquette à 11 px fait 7,2). En ligne de base,
                  une boîte sans texte s'aligne par son bas : elle se pose sur la
                  ligne du libellé, là où le glyphe « × » flottait à mi-hauteur. */}
              <svg aria-hidden width={7} height={7} viewBox="0 0 7 7" className="flex-none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M0.75 0.75l5.5 5.5M6.25 0.75l-5.5 5.5" />
              </svg>
              <span className="underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-200 group-hover/clear:decoration-current group-focus-visible/clear:decoration-current motion-reduce:transition-none">
                {t.clearFilter}
              </span>
            </button>
          </div>
          <div role="group" aria-label={t.filterByTheme} className="flex flex-wrap gap-x-5 gap-y-2" style={{ paddingTop: 14 }}>
            {themes.map((f) => {
              const on = picked.includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onToggle(f.key)}
                  className={cn(
                    MICRO_LABEL,
                    'flex items-center gap-[8px] transition-colors duration-200 motion-reduce:transition-none',
                    on ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                  )}
                >
                  <StateDot on={on} />
                  <TagSwatch color={f.color ?? null} />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Une ligne de choix de la colonne de filtres : voyant, pastille de couleur, libellé, compteur. */
function FilterButton({ filter: f, on, onChange }: { filter: Filter; on: boolean; onChange: (key: string) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(f.key)}
      className={cn(
        'flex w-full items-center gap-[10px] text-left text-[15px] font-bold tracking-[-0.02em] leading-[1.3] transition-colors motion-reduce:transition-none',
        on ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
      )}
      style={{ paddingBlock: ITEM_PAD }}
    >
      <StateDot on={on} />
      <span className="flex items-center gap-[8px]">
        <TagSwatch color={f.color ?? null} />
        <span>
          {f.label} <span className="font-normal tabular-nums">({f.count})</span>
        </span>
      </span>
    </button>
  );
}

/** Padding vertical d'une ligne de choix ; la branche de l'arborescence se cale sur le centre de sa première ligne. */
const ITEM_PAD = 6;

/** Un groupe de la colonne de filtres (desktop), tant qu'aucune thématique n'existe : titre filé, une ligne par choix. */
function FilterGroup({
  heading,
  items,
  isOn,
  onChange,
  children,
}: {
  heading: ReactNode;
  items: Filter[];
  isOn: (key: string) => boolean;
  onChange: (key: string) => void;
  /** Sous la liste (le lien vers la page de la série choisie). */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}
        style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-line)' }}
      >
        {heading}
      </div>
      <ul className="flex flex-col" style={{ paddingTop: 12 }}>
        {items.map((f) => (
          <li key={f.key}>
            <FilterButton filter={f} on={isOn(f.key)} onChange={onChange} />
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

/**
 * « séries/ » et « thématiques/ » (2026-10-24, demande Alexandre : les
 * onglets ne disaient pas assez qu'on passe de l'un à l'autre ; le téléphone a
 * suivi le même jour). Une arborescence de serveur, volontairement
 * rudimentaire : deux dossiers l'un sous l'autre, un seul ouvert. Ce qui le
 * fait comprendre : le chevron qui tourne, l'icône de dossier qui s'ouvre, la barre oblique et la
 * fonte à chasse fixe des noms, le nombre d'entrées au fer droit, et les
 * branches qui raccrochent chaque entrée à son dossier. Le dossier fermé
 * reste en vue à sa place : on voit ce qu'on peut ouvrir.
 *
 * L'ordre ne bouge jamais (séries au-dessus). Ouvrir l'un ferme l'autre, et,
 * comme les onglets d'avant, ne touche à aucun filtre : le voyant d'un dossier
 * FERMÉ dit qu'il trie encore. Le contenu se déplie en hauteur
 * (`grid-template-rows` 0fr → 1fr, aucune hauteur mesurée) ; replié, il est
 * `inert` — ni focus clavier ni lecteur d'écran dans une liste invisible.
 */

/** Retrait des entrées sous leur dossier : la branche part du milieu du chevron. */
const TREE_INDENT = 22;

/** Abscisse de la branche verticale : le centre du chevron (8 px). */
const TREE_TRUNK = 4;

function Folder({
  id,
  name,
  open,
  onOpen,
  lit,
  entries,
  roomy = false,
  children,
}: {
  id: string;
  name: string;
  open: boolean;
  onOpen: () => void;
  /** Son filtre trie-t-il encore ? Ne s'affiche que dossier fermé. */
  lit: boolean;
  /** Nombre d'entrées du dossier, « Tout » exclu. */
  entries: number;
  /** Téléphone : une ligne plus haute, à la mesure d'un doigt. */
  roomy?: boolean;
  /** Le contenu : `FolderList` (desktop) ou `FolderFlow` (téléphone). */
  children: ReactNode;
}) {
  // Le rognage ne sert qu'au dépliage : une fois ouvert, le contenu déborde
  // librement (un anneau de focus, un tiroir posé en `absolute`).
  const [clip, setClip] = useState(true);
  useEffect(() => {
    if (!open) return setClip(true);
    const id = window.setTimeout(() => setClip(false), FOLDER_MS);
    return () => window.clearTimeout(id);
  }, [open]);
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={onOpen}
        className={cn(
          'flex w-full items-center gap-[8px] text-left font-mono text-[13px] leading-none transition-colors duration-200 motion-reduce:transition-none',
          open ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
        )}
        style={{ paddingBlock: roomy ? 12 : 8 }}
      >
        <svg
          aria-hidden
          width={8}
          height={8}
          viewBox="0 0 8 8"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn('flex-none transition-[rotate] duration-200 ease-out motion-reduce:transition-none', open && 'rotate-90')}
        >
          <path d="M2.75 1.25 5.5 4 2.75 6.75" />
        </svg>
        <FolderIcon open={open} />
        <span className="min-w-0 truncate">{name.toLocaleLowerCase()}/</span>
        <StateDot on={!open && lit} />
        {/* Le reset de `globals.css` remet les marges à zéro : un `ml-auto` serait avalé. */}
        <span aria-hidden className="flex-1" />
        <span className="tabular-nums text-[var(--color-fg-muted)]">{entries}</span>
      </button>
      <div
        id={id}
        inert={!open}
        className="grid transition-[grid-template-rows] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', transitionDuration: `${FOLDER_MS}ms` }}
      >
        <div className={cn('min-h-0', clip && 'overflow-hidden')}>{children}</div>
      </div>
    </div>
  );
}

/** Durée du dépliage d'un dossier. */
const FOLDER_MS = 300;

/** Un trait de l'arborescence : le tronc (arrêté au rameau sur la dernière entrée, └) et le rameau. */
function Branch({ y, last }: { y: number | string; last: boolean }) {
  return (
    <>
      <span
        aria-hidden
        className="absolute w-px bg-[var(--color-fg-muted)] opacity-40"
        style={{ left: TREE_TRUNK, top: 0, height: last ? y : '100%' }}
      />
      <span
        aria-hidden
        className="absolute h-px bg-[var(--color-fg-muted)] opacity-40"
        style={{ left: TREE_TRUNK, top: y, width: TREE_INDENT - TREE_TRUNK - 6 }}
      />
    </>
  );
}

/**
 * Une entrée de dossier, façon `ls` (2026-10-24, Alexandre) : chasse fixe,
 * minuscules, le nombre d'articles entre parenthèses, estompé. Le choix actif passe à
 * l'encre et en gras, voyant allumé. La chasse fixe la sépare aussi des
 * thématiques en capitales sous chaque ligne de l'index : un filtre ne se
 * confond pas avec une étiquette.
 */
function LsEntry({
  filter: f,
  on,
  onChange,
  dash = false,
}: {
  filter: Filter;
  on: boolean;
  onChange: (key: string) => void;
  /** Tiret de tête, pour les entrées mises à la suite sur téléphone. */
  dash?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(f.key)}
      className={cn(
        'flex items-center gap-[8px] text-left font-mono text-[13px] leading-[1.3] transition-colors duration-200 motion-reduce:transition-none',
        on ? 'text-[var(--color-fg)] font-bold' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
      )}
      style={{ paddingBlock: ITEM_PAD }}
    >
      <StateDot on={on} />
      <TagSwatch color={f.color ?? null} />
      <span>
        {dash && <span aria-hidden className="font-normal text-[var(--color-fg-muted)]">- </span>}
        {f.label.toLocaleLowerCase()} <span className="opacity-70">({f.count})</span>
      </span>
    </button>
  );
}

/** Centre de la première ligne d'une entrée : 13 px × 1,3 d'interligne. */
const LS_BRANCH_Y = ITEM_PAD + (13 * 1.3) / 2;

/** Desktop (`ls -1`) : une entrée par ligne, chacune sur sa branche. */
function FolderList({
  items,
  isOn,
  onChange,
  children,
}: {
  items: Filter[];
  isOn: (key: string) => boolean;
  onChange: (key: string) => void;
  children?: ReactNode;
}) {
  return (
    <>
      <ul className="flex flex-col" style={{ paddingBottom: 10 }}>
        {items.map((f, i) => (
          <li key={f.key} className="relative" style={{ paddingLeft: TREE_INDENT }}>
            <Branch y={LS_BRANCH_Y} last={i === items.length - 1} />
            <LsEntry filter={f} on={isOn(f.key)} onChange={onChange} />
          </li>
        ))}
      </ul>
      {children}
    </>
  );
}

/**
 * Téléphone (`ls`) : les entrées à la suite, sur une seule branche (└). Une
 * par ligne pousserait l'index d'un écran entier vers le bas ; le champ
 * `ListSelector` qui était là cachait les choix et répétait le nom du dossier.
 */
function FolderFlow({
  items,
  isOn,
  onChange,
  after,
}: {
  items: Filter[];
  isOn: (key: string) => boolean;
  onChange: (key: string) => void;
  after?: ReactNode;
}) {
  return (
    <div style={{ paddingBottom: 14 }}>
      <div className="relative" style={{ paddingLeft: TREE_INDENT }}>
        <Branch y={LS_BRANCH_Y} last />
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {items.map((f) => (
            <li key={f.key}>
              <LsEntry filter={f} on={isOn(f.key)} onChange={onChange} dash />
            </li>
          ))}
        </ul>
      </div>
      {after && <div style={{ paddingTop: 12, paddingLeft: TREE_INDENT }}>{after}</div>}
    </div>
  );
}

/** Le dossier de l'arborescence : fermé, un classeur ; ouvert, la face avant basculée. */
function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width={15}
      height={15}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinejoin="round"
      className="flex-none"
    >
      {open ? (
        <>
          <path d="M2 12.5V3.5h4l1.5 1.5H12.5v2" />
          <path d="M2 12.5 4 7h10.5l-2 5.5z" />
        </>
      ) : (
        <path d="M2 12.5V3.5h4l1.5 1.5H14v7.5z" />
      )}
    </svg>
  );
}

/**
 * La marque de série d'une ligne : une courte flèche, le nom, puis la partie
 * « 2/3 » dans un cadre de 1 px (demande Alexandre, 2026-10-21 — remplace la
 * pile de traits). Son contenu est visuel (`aria-hidden`) — le lien qui
 * l'enveloppe dans `Row` porte son nom en toutes lettres. Tout suit
 * `currentColor`, cadre compris : la couleur se décide sur le lien.
 *
 * Le soulignement de survol ne tient que sous le NOM (`group/series`) : ni la
 * flèche ni le cadre ne se soulignent.
 */
function SeriesMark({ name, part, total }: { name: string | null; part: number; total: number }) {
  return (
    <span aria-hidden className={cn(MICRO_LABEL, 'flex items-center gap-[8px]')}>
      {name && (
        <>
          <svg
            width={10}
            height={10}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-none"
          >
            <path d="M4 12h15" />
            <path d="M13 6l6 6-6 6" />
          </svg>
          <span
            className={cn(
              'underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-200 motion-reduce:transition-none',
              'group-hover/series:decoration-[var(--color-bg)] group-focus-visible/series:decoration-[var(--color-bg)]',
            )}
          >
            {name}
          </span>
        </>
      )}
      {/* Padding inline : le reset `* { padding: 0 }` avale les utilities.
          Graisse 500 : le chiffre se lit sans peser autant que le nom. */}
      <span className="shrink-0 leading-none font-medium" style={{ padding: '3px 5px', border: '1px solid currentColor' }}>
        {part}/{total}
      </span>
    </span>
  );
}

function Row({
  article,
  lang,
  total,
  showSeriesName,
  onTheme,
  onHot,
}: {
  article: ArticleSummary;
  lang: Lang;
  /** Nombre de parties de la série de l'article, 0 hors série. */
  total: number;
  showSeriesName: boolean;
  /** Filtre l'index sur une thématique de l'article (depuis son dépli). */
  onTheme: (slug: string) => void;
  onHot: (on: boolean) => void;
}) {
  const t = DICT[lang];
  const mark = article.series && total > 0 && (
    <SeriesMark name={showSeriesName ? article.series : null} part={article.part} total={total} />
  );
  const [open, setOpen] = useState(false);
  const [hot, setHotState] = useState(false);
  const setHot = (on: boolean) => {
    setHotState(on);
    onHot(on);
  };
  const panelId = useId();

  return (
    <li style={{ borderBottom: '1px solid var(--color-line)' }}>
      <div
        className={cn(
          'group relative flex flex-col transition-colors duration-200 ease-out motion-reduce:transition-none',
          'hover:bg-[var(--color-fg)] focus-within:bg-[var(--color-fg)]',
        )}
        style={{ paddingBlock: 14, paddingInline: 8 }}
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => setHot(false)}
        onFocus={() => setHot(true)}
        onBlur={() => setHot(false)}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex-1 min-w-0 flex flex-col gap-1 md:grid md:items-center"
            style={{ gridTemplateColumns: `${DATE_COL - 8}px minmax(0, 1fr)` }}
          >
            <span
              className={cn(
                MICRO_LABEL,
                'flex items-center gap-[10px] text-[var(--color-fg-muted)] transition-colors duration-200 motion-reduce:transition-none',
                'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
              )}
            >
              {/* Le voyant de survol n'existe qu'au pointeur : sur téléphone il
                  décalait la date sous le titre pour un état qui ne s'allume pas. */}
              <span className="hidden md:flex">
                <StateDot on={hot} />
              </span>
              <time dateTime={article.date}>{articleDate(article.date)}</time>
            </span>
            <span className="flex flex-col gap-[6px] min-w-0">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 md:flex-nowrap">
                <Link
                  href={articlePath(article.slug, lang)}
                  className={cn(
                    'min-w-0 text-[21px] md:text-[28px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-fg)] md:truncate',
                    'transition-colors duration-200 motion-reduce:transition-none',
                    'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)] focus-visible:outline-none',
                    // Lien étiré : toute la ligne est cliquable, le « + » passe au-dessus.
                    'after:absolute after:inset-0',
                  )}
                >
                  {article.title}
                  {article.series && article.part > 0 && (
                    <span className="sr-only"> — {t.seriesMark(article.series, article.part, total)}</span>
                  )}
                </Link>
                {/* « Long read » (2026-10-22, maquette d'Alexandre) : l'orange
                    des liens, cadre compris — c'est un signal, pas une surface.
                    Padding inline : le reset `* { padding: 0 }`. */}
                {article.minutes >= LONG_READ_MINUTES && (
                  <span
                    className="shrink-0 rounded-full text-[8px] font-medium uppercase leading-none text-[var(--color-link)]"
                    style={{ padding: '4px 8px', border: '1px solid var(--color-link)' }}
                  >
                    {t.longRead}
                  </span>
                )}
              </span>
              {/* Sous le titre : la série (lien, à l'encre) puis les
                  thématiques (grises comme la date ; un clic filtre l'index
                  sur elles). Tout passe au papier sur la ligne inversée. */}
              {(mark || article.tags.length > 0) && (
                <span
                  className={cn(
                    MICRO_LABEL,
                    'flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--color-fg-muted)] transition-colors duration-200 motion-reduce:transition-none',
                    'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
                  )}
                >
                  {mark &&
                    (article.seriesSlug ? (
                      <Link
                        href={seriesPath(article.seriesSlug, lang)}
                        aria-label={`${t.seriesPage} — ${t.seriesMark(article.series!, article.part, total)}`}
                        // Au-dessus du lien étiré du titre, comme le « + ».
                        // Bleu du logo au repos ; papier sur la ligne inversée
                        // (le bleu y tomberait à ~2:1) ; orange du surlignage de
                        // la nav sous le pointeur, souligné de papier — `!` :
                        // le survol du lien l'emporte sur celui de la ligne.
                        className={cn(
                          'group/series relative z-10 text-[var(--color-accent)]',
                          'transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none',
                          'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
                          'hover:text-[var(--color-active-bg)]! focus-visible:text-[var(--color-active-bg)]!',
                        )}
                      >
                        {mark}
                      </Link>
                    ) : (
                      <span className="text-[var(--color-accent)] group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]">
                        {mark}
                      </span>
                    ))}
                  {article.tags.length > 0 && (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="sr-only">{t.themesHeading}: </span>
                      {article.tags.map((tag) => (
                        <button
                          key={tag.slug}
                          type="button"
                          onClick={() => onTheme(tag.slug)}
                          // Au-dessus du lien étiré, comme la série.
                          className="relative z-10 flex items-center gap-[6px] uppercase underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-200 hover:decoration-current focus-visible:decoration-current focus-visible:outline-none motion-reduce:transition-none"
                        >
                          <TagSwatch color={tag.color} />
                          {tag.title}
                        </button>
                      ))}
                    </span>
                  )}
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={open ? t.collapse(article.title) : t.expand(article.title)}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center text-[22px] font-normal leading-none text-[var(--color-fg)]',
              'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
              // Tailwind v4 : `rotate-45` écrit la propriété `rotate` — d'où
              // `transition-[rotate]` et pas `transition-transform` (CLAUDE.md §7).
              'transition-[rotate,color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
              open && 'rotate-45',
            )}
          >
            <span aria-hidden>+</span>
          </button>
        </div>

        {/* Dépli DANS la ligne (2026-10-22) : le sous-titre, sous le titre,
            dans la même surface — la ligne grandit, les suivantes descendent.
            Grille 0fr → 1fr pour animer une hauteur inconnue ; ouverture
            300 ms qui freine, fermeture 200 ms qui accélère ; le texte arrive
            60 ms après la boîte (chevauchement). Le lien étiré du titre le
            couvre aussi : un clic sur le sous-titre ouvre l'article. */}
        <div
          id={panelId}
          className={cn(
            'grid transition-[grid-template-rows] motion-reduce:transition-none',
            open ? 'duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]' : 'duration-200 ease-in',
          )}
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden" inert={!open}>
            {/* À droite, la place du « + » (32) et de son écart (12). */}
            <div
              className={cn(
                'md:grid transition-opacity motion-reduce:transition-none',
                open ? 'opacity-100 duration-300 ease-out delay-[60ms]' : 'opacity-0 duration-150 ease-in',
              )}
              style={{ gridTemplateColumns: `${DATE_COL - 8}px minmax(0, 1fr)`, paddingTop: 10, paddingRight: 44 }}
            >
              <span aria-hidden className="hidden md:block" />
              <p
                className={cn(
                  'max-w-[var(--editorial-measure)] text-[17px] md:text-[20px] font-bold tracking-[-0.02em] leading-[1.3] text-[var(--color-fg-muted)]',
                  'transition-colors duration-200 motion-reduce:transition-none',
                  'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
                )}
              >
                {article.dek}
              </p>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
