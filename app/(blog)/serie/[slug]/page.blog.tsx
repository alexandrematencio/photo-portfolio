import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageShell } from '@/components/site/PageShell';
import { SeriesArticleList } from '@/components/journal/SeriesArticleList';
import { getAllSeries, getSeriesBySlug } from '@/lib/journal/articles';
import { frenchSpaces } from '@/lib/journal/french';
import type { JournalSeries } from '@/lib/journal/types';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { seriesBreadcrumbJsonLd, seriesJsonLd } from '@/lib/seo/journal-jsonld';
import { AUTHOR_NAME } from '@/lib/site/author';
import { seriesPath } from '@/lib/site/sites';
import { EDITORIAL_H3, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * La page d'une série du journal, à `blog.amatencio.com/serie/<slug>/`
 * (2026-10-17). Elle existe pour le référencement : un article répond à une
 * question, la série couvre un SUJET — c'est la page qu'on veut voir sortir
 * sur « marchés de collection », et celle qui relie entre eux les articles
 * qui en parlent. Texte : le champ « Présentation » de la série dans le Studio.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getAllSeries()).map((s) => ({ slug: s.slug }));
}

/** Sans présentation dans le Studio : une phrase tirée des titres. */
function seriesDescription(series: JournalSeries): string {
  if (series.description) return series.description;
  const titles = series.articles.map((a) => `« ${a.title} »`).join(', ');
  return `${series.title} : une série en ${series.articles.length} articles d'${AUTHOR_NAME} — ${titles}.`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) return {};
  return buildMetadata({
    title: series.title,
    description: seriesDescription(series),
    path: seriesPath(slug),
  });
}

export default async function JournalSeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();

  const minutes = series.articles.reduce((n, a) => n + a.minutes, 0);
  const references = series.articles.reduce((n, a) => n + a.referenceCount, 0);
  const meta = [
    'Journal · Série',
    `${series.articles.length} articles`,
    `${minutes} min de lecture`,
    references > 0 ? `${references} références` : null,
  ].filter((m): m is string => Boolean(m));

  return (
    <>
      <JsonLd data={[seriesJsonLd(series, seriesDescription(series)), seriesBreadcrumbJsonLd(series)]} />
      <PageShell
        title={series.title}
        centered
        titleSize="calc(var(--page-title-size) * var(--article-title-scale))"
        subtitle={
          <div className="flex flex-col gap-5" style={{ marginTop: 12 }}>
            {series.description && <p className={EDITORIAL_H3}>{frenchSpaces(series.description)}</p>}
            <p className={cn(MICRO_LABEL, 'flex flex-wrap gap-x-4 gap-y-1 text-[var(--color-fg-muted)]')}>
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </p>
          </div>
        }
      >
        <SeriesArticleList articles={series.articles} />
      </PageShell>
    </>
  );
}
