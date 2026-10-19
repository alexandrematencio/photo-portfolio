'use client';

import Link from 'next/link';
import { DICT, THEME_PARAM, articlePath, seriesPath, type Lang } from '@/lib/journal/i18n';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { StateDot } from '@/components/site/StateDot';
import { ListSelector } from '@/components/site/ListSelector';
import { EDITORIAL_SIDENOTE, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { ArticleSummary } from '@/lib/journal/types';

/**
 * PAGE D'ACCUEIL DU JOURNAL — reprise de stripe.dev/blog (demande Alexandre,
 * 2026-10-17), traduite dans la grammaire du site (brand book §14.7) :
 *
 * - une colonne de filtres à gauche (« Séries »), collante ;
 * - un index en lignes : « Date », « Titre », un « + » qui déplie le
 *   chapeau de l'article sans quitter la page ;
 * - au survol, la ligne s'inverse — encre sur papier devient papier sur
 *   encre. Stripe la passe en vert ; ici l'orange n'a pas le droit d'être une
 *   surface (§4.3), il reste ce qu'il est partout : le voyant de la ligne
 *   active.
 *
 * Sous `md`, la colonne de filtres devient un module `ListSelector` (le
 * composant unique du site pour une rangée de choix sur téléphone).
 *
 * Une ligne qui appartient à une série le dit à droite (2026-10-19) : le nom
 * de la série et sa PILE — un trait par partie, celui de l'article plein, les
 * autres en retrait. La pile de `/series` ramenée au corps d'une étiquette.
 * Filtrée sur une série, la ligne ne garde que la pile : le nom est déjà dans
 * le filtre.
 *
 * Sous les séries, les THÉMATIQUES (2026-10-19) : un second groupe, qui se
 * combine au premier (série ET thématique). Il n'apparaît qu'à la première
 * thématique posée sur un article. Les compteurs d'un groupe se lisent dans
 * le filtre de l'autre — « (3) » promet trois lignes. La thématique choisie
 * s'écrit dans l'adresse (`?theme=`) : c'est le lien que posent les pages
 * d'article.
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

/** Colonne des dates — « 2026.10.17 » en chiffres tabulaires, comme Stripe. */
const DATE_COL = 128;

/** Largeur de la colonne de filtres au-dessus de `md`. */
const FILTER_COL = 220;

type Filter = { key: string; label: string; count: number };

function stamp(date: string) {
  return date.replaceAll('-', '.');
}

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
  const [theme, setThemeState] = useState(ALL);
  const mobileFilters = useRef<HTMLDivElement | null>(null);
  // La ligne survolée (ou focalisée) : sa couverture s'ouvre dans la colonne de gauche.
  const [active, setActive] = useState<string | null>(null);
  const covers = articles.filter((a) => a.cover);

  const inSeries = (a: ArticleSummary) => series === ALL || (a.series ?? HORS_SERIE) === series;
  const inTheme = (a: ArticleSummary) => theme === ALL || a.tags.some((tag) => tag.slug === theme);

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
      ...[...counts].map(([name, count]) => ({ key: name, label: name === HORS_SERIE ? t.noSeries : name, count })),
    ];
  }, [articles, t, theme]);

  // Les thématiques, par ordre alphabétique : la liste grandit avec le
  // journal, on y cherche un mot, pas un rang. Vide : pas de groupe.
  const themes = useMemo<Filter[]>(() => {
    const names = new Map<string, string>();
    for (const a of articles) for (const tag of a.tags) names.set(tag.slug, tag.title);
    if (names.size === 0) return [];
    const pool = articles.filter(inSeries);
    return [
      { key: ALL, label: t.all, count: pool.length },
      ...[...names]
        .sort(([, x], [, y]) => x.localeCompare(y, lang))
        .map(([slug, title]) => ({ key: slug, label: title, count: pool.filter((a) => a.tags.some((tag) => tag.slug === slug)).length })),
    ];
  }, [articles, t, lang, series]);

  // `?theme=<slug>` : lu au montage (l'export est statique, le HTML servi ne
  // connaît pas l'adresse), réécrit à chaque choix pour que l'adresse se partage.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get(THEME_PARAM);
    if (slug && articles.some((a) => a.tags.some((tag) => tag.slug === slug))) setThemeState(slug);
  }, [articles]);

  const setTheme = (key: string) => {
    setThemeState(key);
    const url = new URL(window.location.href);
    if (key === ALL) url.searchParams.delete(THEME_PARAM);
    else url.searchParams.set(THEME_PARAM, key);
    window.history.replaceState(window.history.state, '', url);
  };

  // Depuis le dépli d'une ligne : sur téléphone, les filtres sont loin
  // au-dessus — on y remonte pour que le tri se voie.
  const pickTheme = (key: string) => {
    setTheme(key);
    const box = mobileFilters.current;
    if (box && box.offsetParent !== null && box.getBoundingClientRect().top < 0) {
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

  return (
    <div className="flex flex-col md:grid md:gap-x-12" style={{ gridTemplateColumns: `${FILTER_COL}px minmax(0, 1fr)` }}>
      {/* FILTRES — téléphone */}
      <div ref={mobileFilters} className="md:hidden" style={{ marginBottom: 32, scrollMarginTop: 16 }}>
        <div style={{ marginBottom: 20 }}>{language}</div>
        {/* Deux modules collés en un bloc, comme la console d'`/archives`. */}
        <ListSelector
          hint={t.seriesHint}
          ariaLabel={t.filterBySeries}
          items={filters}
          value={series}
          onChange={setSeries}
          mark="dot"
          tone="plate"
          corners={themes.length ? 'top' : 'all'}
          lit={series !== ALL}
        />
        {themes.length > 0 && (
          <ListSelector
            hint={t.themeHint}
            ariaLabel={t.filterByTheme}
            items={themes}
            value={theme}
            onChange={setTheme}
            mark="dot"
            tone="plate-low"
            corners="bottom"
            lit={theme !== ALL}
          />
        )}
        {seriesLink && <div style={{ marginTop: 16 }}>{seriesLink}</div>}
      </div>

      {/* FILTRES — desktop, colonne collante */}
      <aside className="hidden md:flex flex-col gap-10 self-start sticky top-6" aria-label={t.filters}>
        {language}
        <FilterGroup heading={t.seriesHeading} items={filters} value={series} onChange={setSeries}>
          {seriesLink && <div style={{ paddingTop: 16 }}>{seriesLink}</div>}
        </FilterGroup>
        {themes.length > 0 && (
          <FilterGroup heading={t.themesHeading} items={themes} value={theme} onChange={setTheme} />
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

/** Un groupe de la colonne de filtres (desktop) : titre filé, une ligne par choix, voyant d'état. */
function FilterGroup({
  heading,
  items,
  value,
  onChange,
  children,
}: {
  heading: string;
  items: Filter[];
  value: string;
  onChange: (key: string) => void;
  /** Sous la liste (le lien vers la page de la série choisie). */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}
        style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-line)' }}
      >
        {heading}
      </span>
      <ul className="flex flex-col" style={{ paddingTop: 12 }}>
        {items.map((f) => {
          const on = f.key === value;
          return (
            <li key={f.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(f.key)}
                className={cn(
                  'flex w-full items-center gap-[10px] text-left text-[15px] font-bold tracking-[-0.02em] leading-[1.3] transition-colors motion-reduce:transition-none',
                  on ? 'text-[var(--color-fg)]' : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                )}
                style={{ paddingBlock: 6 }}
              >
                <StateDot on={on} />
                <span>
                  {f.label} <span className="font-normal tabular-nums">({f.count})</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {children}
    </div>
  );
}

/**
 * La marque de série d'une ligne : nom + pile. Purement visuelle (`aria-hidden`) —
 * le lien du titre porte la même information en toutes lettres pour les
 * lecteurs d'écran. Couleur héritée : grise au repos, papier sur la ligne
 * inversée, comme la date.
 *
 * Les traits font la hauteur des capitales de l'étiquette (11 px de corps) et
 * restent hors de l'orange : l'orange est un ÉTAT (StateDot), ici c'est une
 * donnée (brand book §4.3).
 */
const PILE_BAR = { width: 3, height: 9, gap: 2 } as const;

function SeriesMark({ name, part, total }: { name: string | null; part: number; total: number }) {
  return (
    <span aria-hidden className={cn(MICRO_LABEL, 'flex items-center gap-[10px] whitespace-nowrap')}>
      {name}
      <span className="flex items-center" style={{ gap: PILE_BAR.gap }}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            style={{
              width: PILE_BAR.width,
              height: PILE_BAR.height,
              backgroundColor: 'currentColor',
              opacity: i + 1 === part ? 1 : 0.3,
            }}
          />
        ))}
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
          'group relative flex items-center gap-3 transition-colors duration-200 ease-out motion-reduce:transition-none',
          'hover:bg-[var(--color-fg)] focus-within:bg-[var(--color-fg)]',
        )}
        style={{ paddingBlock: 14, paddingInline: 8 }}
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => setHot(false)}
        onFocus={() => setHot(true)}
        onBlur={() => setHot(false)}
      >
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
            <time dateTime={article.date}>{stamp(article.date)}</time>
            {/* Téléphone : la marque à droite de la date, au-dessus du titre. */}
            {mark && <span className="md:hidden">{mark}</span>}
          </span>
          <Link
            href={articlePath(article.slug, lang)}
            className={cn(
              'text-[21px] md:text-[28px] font-bold tracking-[-0.02em] leading-[1.15] text-[var(--color-fg)] md:truncate',
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
        </div>
        {/* Desktop : la marque en colonne à droite, juste avant le « + » — le
            titre se tronque avant elle. */}
        {mark && (
          <span
            className={cn(
              'hidden md:flex shrink-0 text-[var(--color-fg-muted)] transition-colors duration-200 motion-reduce:transition-none',
              'group-hover:text-[var(--color-bg)] group-focus-within:text-[var(--color-bg)]',
            )}
          >
            {mark}
          </span>
        )}
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

      {/* Dépli : grille 0fr → 1fr pour animer une hauteur inconnue ; le texte
          arrive 60 ms après la boîte (chevauchement, principe 5). */}
      <div
        id={panelId}
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden" inert={!open}>
          <div
            className={cn(
              'flex flex-col gap-3 transition-opacity duration-300 ease-out motion-reduce:transition-none',
              open ? 'opacity-100 delay-[60ms]' : 'opacity-0',
            )}
            style={{ padding: '4px 8px 24px' }}
          >
            <div className="md:grid" style={{ gridTemplateColumns: `${DATE_COL - 8}px minmax(0, 1fr)` }}>
              <span className={cn(MICRO_LABEL, 'hidden md:block text-[var(--color-fg-muted)]')} style={{ paddingLeft: 17 }}>
                {article.part > 0 ? t.part(article.part) : ''}
              </span>
              <div className="flex flex-col gap-3">
                <p className="text-[19px] md:text-[24px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--color-fg)]">
                  {article.dek}
                </p>
                <p className={cn(EDITORIAL_SIDENOTE, 'flex flex-wrap gap-x-4')}>
                  {article.series &&
                    (article.seriesSlug ? (
                      <Link href={seriesPath(article.seriesSlug, lang)} className="underline underline-offset-4 hover:text-[var(--color-fg)]">
                        {article.series}
                      </Link>
                    ) : (
                      <span>{article.series}</span>
                    ))}
                  <span>{t.minutes(article.minutes)}</span>
                  {article.referenceCount > 0 && <span>{t.references(article.referenceCount)}</span>}
                  {article.tags.map((tag) => (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => onTheme(tag.slug)}
                      className="underline decoration-[var(--color-line)] underline-offset-4 hover:text-[var(--color-fg)] hover:decoration-current"
                    >
                      {tag.title}
                    </button>
                  ))}
                </p>
                <Link
                  href={articlePath(article.slug, lang)}
                  className={cn(MICRO_LABEL, 'w-fit text-[var(--color-fg)] underline underline-offset-4')}
                >
                  {t.readArticle}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
