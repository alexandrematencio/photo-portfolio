import Link from 'next/link';
import { PageShell } from '@/components/site/PageShell';
import { ArticleBody, type MapMarks } from '@/components/journal/ArticleBody';
import { ArticleMap } from '@/components/journal/concept-map/ArticleMap';
import type { MapView } from '@/lib/journal/conceptMapData';
import { BackLink } from '@/components/journal/BackLink';
import { LanguageSwitch } from '@/components/journal/LanguageSwitch';
import { ReadingProgress } from '@/components/journal/ReadingProgress';
import { TableOfContents } from '@/components/journal/TableOfContents';
import { TagSwatch } from '@/components/journal/TagSwatch';
import { DICT, articleDate, homePath, seriesPath, themePath } from '@/lib/journal/i18n';
import { articleSections } from '@/lib/journal/sections';
import type { Article, ArticleSummary } from '@/lib/journal/types';
import { EDITORIAL_H3, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * LA PAGE D'UN ARTICLE, sans ses données structurées : titre, sous-titre,
 * ligne de métadonnées, corps. Sortie de `JournalArticle` (pages.tsx) le
 * 2026-10-18 pour que l'aperçu du Studio (`ArticlePreview`) rende le
 * brouillon avec EXACTEMENT ce composant — ni serveur ni Sanity ici, il se
 * monte des deux côtés.
 */
export function ArticleView({
  article,
  series,
  signature,
  map,
}: {
  article: Article;
  /** Les articles de sa série, dans l'ordre de lecture (vide hors série). */
  series: ArticleSummary[];
  signature: string;
  /** Sa part de la Concept Map (`articleMapView`) ; absente dans l'aperçu du Studio et hors français. */
  map?: MapView | null;
}) {
  const lang = article.lang;
  const t = DICT[lang];

  const { sections } = articleSections(article);
  const published = articleDate(article.date);
  // La partie entre crochets, sans espaces : « Le prix du bien [2/2] ».
  const seriesLabel = series.length > 1 ? `${article.series} [${article.part}/${series.length}]` : article.series;
  const meta = [
    'Journal',
    seriesLabel,
    published,
    t.minutes(article.minutes),
    article.referenceCount > 0 ? t.references(article.referenceCount) : null,
  ].filter((m): m is string => Boolean(m));

  // Une marque par paragraphe couvert ; celui de la citation est le premier.
  const marks: MapMarks = {};
  for (const n of map?.nodes ?? [])
    if (n.kind === 'thesis' && n.articles[0] === `a:${article.slug}`)
      (n.covers ?? []).forEach((k, i) => (marks[k] = { id: n.id, label: n.label, anchor: i === 0 }));
  const body = <ArticleBody article={article} series={series} signature={signature} marks={map ? marks : undefined} />;

  return (
    <PageShell
      title={article.title}
      back={<BackLink lang={lang} href={article.seriesSlug ? seriesPath(article.seriesSlug, lang) : homePath(lang)} />}
      language={<LanguageSwitch lang={lang} alternates={article.alternates} />}
      progress={{ rail: <ReadingProgress variant="rail" />, top: <ReadingProgress variant="top" /> }}
      // Un sommaire d'une entrée n'aide personne à s'orienter.
      contents={sections.length > 1 ? <TableOfContents sections={sections} lang={lang} /> : undefined}
      centered
      rule
      titleSize="calc(var(--page-title-size) * var(--article-title-scale))"
      subtitle={
        <div className="flex flex-col gap-5" style={{ marginTop: 12 }}>
          <p className={EDITORIAL_H3}>{article.dek}</p>
          <p className={cn(MICRO_LABEL, 'flex flex-wrap gap-x-4 gap-y-1 text-[var(--color-fg-muted)]')}>
            {meta.map((m) =>
              // La date en <time> : la forme lisible pour le lecteur, la
              // forme ISO pour les machines.
              m === published ? (
                <time key={m} dateTime={article.date}>
                  {m}
                </time>
              ) : m === seriesLabel && article.seriesSlug ? (
                // La série mène à sa page : le sujet entier, pas seulement cet
                // article. Bleu du logo, souligné d'un filet fin du même bleu
                // (2026-10-22) ; orange au survol, filet compris.
                <Link
                  key={m}
                  href={seriesPath(article.seriesSlug, lang)}
                  className={cn(
                    'text-[var(--color-accent)] underline decoration-current decoration-1 underline-offset-4',
                    'transition-colors duration-200 motion-reduce:transition-none',
                    'hover:text-[var(--color-link)] hover:decoration-current focus-visible:text-[var(--color-link)] focus-visible:decoration-current',
                  )}
                >
                  {m}
                </Link>
              ) : (
                <span key={m}>{m}</span>
              ),
            )}
            {/* Les thématiques mènent à l'accueil filtré sur elles. */}
            {article.tags.map((tag) => (
              <Link
                key={tag.slug}
                href={themePath(tag.slug, lang)}
                className="inline-flex items-center gap-[6px] underline decoration-[var(--color-line)] underline-offset-4 hover:text-[var(--color-fg)] hover:decoration-current"
              >
                <TagSwatch color={tag.color} />
                {tag.title}
              </Link>
            ))}
          </p>
        </div>
      }
    >
      {map ? (
        <ArticleMap view={map} slug={article.slug}>
          {body}
        </ArticleMap>
      ) : (
        body
      )}
    </PageShell>
  );
}
