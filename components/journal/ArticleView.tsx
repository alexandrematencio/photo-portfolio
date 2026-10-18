import Link from 'next/link';
import { PageShell } from '@/components/site/PageShell';
import { ArticleBody } from '@/components/journal/ArticleBody';
import { BackLink } from '@/components/journal/BackLink';
import { LanguageSwitch } from '@/components/journal/LanguageSwitch';
import { DICT, homePath, seriesPath } from '@/lib/journal/i18n';
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
}: {
  article: Article;
  /** Les articles de sa série, dans l'ordre de lecture (vide hors série). */
  series: ArticleSummary[];
  signature: string;
}) {
  const lang = article.lang;
  const t = DICT[lang];

  const published = new Intl.DateTimeFormat(t.dateLocale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(article.date),
  );
  const seriesLabel = series.length > 1 ? `${article.series} ${article.part} / ${series.length}` : article.series;
  const meta = [
    'Journal',
    seriesLabel,
    published,
    t.minutes(article.minutes),
    article.referenceCount > 0 ? t.references(article.referenceCount) : null,
  ].filter((m): m is string => Boolean(m));

  return (
    <PageShell
      title={article.title}
      back={<BackLink lang={lang} href={article.seriesSlug ? seriesPath(article.seriesSlug, lang) : homePath(lang)} />}
      language={<LanguageSwitch lang={lang} alternates={article.alternates} />}
      centered
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
                // La série mène à sa page : le sujet entier, pas seulement cet article.
                <Link
                  key={m}
                  href={seriesPath(article.seriesSlug, lang)}
                  className="underline decoration-[var(--color-line)] underline-offset-4 hover:text-[var(--color-fg)] hover:decoration-current"
                >
                  {m}
                </Link>
              ) : (
                <span key={m}>{m}</span>
              ),
            )}
          </p>
        </div>
      }
    >
      <ArticleBody article={article} series={series} signature={signature} />
    </PageShell>
  );
}
