'use client';

import Link from 'next/link';
import { DICT, articlePath, seriesPath, type Lang } from '@/lib/journal/i18n';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { StateDot } from '@/components/site/StateDot';
import { ListSelector } from '@/components/site/ListSelector';
import { EDITORIAL_SIDENOTE, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';
import type { ArticleSummary } from '@/lib/journal/types';
import { LoopFigure } from './LoopFigure';

/**
 * PAGE D'ACCUEIL DU JOURNAL — reprise de stripe.dev/blog (demande Alexandre,
 * 2026-10-17), traduite dans la grammaire du site (brand book §14.7) :
 *
 * - une colonne de filtres à gauche (« / Séries »), collante ;
 * - un index en lignes : « / Date », « / Titre », un « + » qui déplie le
 *   chapeau de l'article sans quitter la page ;
 * - au survol, la ligne s'inverse — encre sur papier devient papier sur
 *   encre. Stripe la passe en vert ; ici l'orange n'a pas le droit d'être une
 *   surface (§4.3), il reste ce qu'il est partout : le voyant de la ligne
 *   active.
 *
 * Sous `md`, la colonne de filtres devient un module `ListSelector` (le
 * composant unique du site pour une rangée de choix sur téléphone).
 */

const ALL = '__all';

/** Filtre des articles qui n'appartiennent à aucune série (clé interne ; le libellé vient du dictionnaire). */
const HORS_SERIE = '__none';

/** Colonne des dates — « 2026.10.17 » en chiffres tabulaires, comme Stripe. */
const DATE_COL = 128;

/** Largeur de la colonne de filtres au-dessus de `md`. */
const FILTER_COL = 220;

function stamp(date: string) {
  return date.replaceAll('-', '.');
}

export function JournalIndex({
  articles,
  lang,
  figureHref,
  language,
}: {
  articles: ArticleSummary[];
  lang: Lang;
  /** L'article d'où vient la Fig. 1, dans cette langue — sinon pas de vignette. */
  figureHref: string | null;
  /** Le sélecteur de langue, posé en tête de la colonne de filtres. */
  language: ReactNode;
}) {
  const t = DICT[lang];
  const [series, setSeries] = useState(ALL);

  const filters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) {
      const name = a.series ?? HORS_SERIE;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [
      { key: ALL, label: t.all, count: articles.length },
      ...[...counts].map(([name, count]) => ({ key: name, label: name === HORS_SERIE ? t.noSeries : name, count })),
    ];
  }, [articles, t]);

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

  const shown = series === ALL ? articles : articles.filter((a) => (a.series ?? HORS_SERIE) === series);

  return (
    <div className="flex flex-col md:grid md:gap-x-12" style={{ gridTemplateColumns: `${FILTER_COL}px minmax(0, 1fr)` }}>
      {/* FILTRES — téléphone */}
      <div className="md:hidden" style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 20 }}>{language}</div>
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
        {seriesLink && <div style={{ marginTop: 16 }}>{seriesLink}</div>}
      </div>

      {/* FILTRES — desktop, colonne collante */}
      <aside className="hidden md:flex flex-col gap-10 self-start sticky top-6" aria-label={t.filters}>
        {language}
        <div className="flex flex-col">
          <span
            className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}
            style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-line)' }}
          >
            / {t.seriesHeading}
          </span>
          <ul className="flex flex-col" style={{ paddingTop: 12 }}>
            {filters.map((f) => {
              const on = f.key === series;
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSeries(f.key)}
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
          {seriesLink && <div style={{ paddingTop: 16 }}>{seriesLink}</div>}
        </div>

        {figureHref && (
          <Link href={figureHref} className="flex flex-col gap-2 group" aria-label={t.figureLink}>
            <span className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)]')}>[ {t.figure.caption} ]</span>
            <LoopFigure bare lang={lang} />
          </Link>
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
              <Row key={a.slug} article={a} lang={lang} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Row({ article, lang }: { article: ArticleSummary; lang: Lang }) {
  const t = DICT[lang];
  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState(false);
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
          </Link>
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
