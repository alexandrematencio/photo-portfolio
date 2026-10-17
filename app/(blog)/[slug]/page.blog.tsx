import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageShell } from '@/components/site/PageShell';
import { ArticleBody } from '@/components/journal/ArticleBody';
import { getArticle, getArticles, getSeries } from '@/lib/journal/articles';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import { blogPostingJsonLd, journalBreadcrumbJsonLd } from '@/lib/seo/journal-jsonld';
import { articlePath } from '@/lib/site/sites';
import { EDITORIAL_H3, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * Un article du journal (brand book §14), lu dans Sanity (documents `post`,
 * rubrique « Journal » du Studio), à `blog.amatencio.com/<adresse>/`.
 * Référencement : titre et description de l'onglet « Référencement » du
 * Studio s'ils existent, sinon titre et sous-titre ; `og:type=article` avec
 * ses dates ; un `BlogPosting` qui déclare l'auteur et les sources.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getArticles()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};
  return buildMetadata({
    title: article.seoTitle ?? article.title,
    description: article.seoDescription ?? article.dek,
    path: articlePath(slug),
    article: {
      publishedTime: article.date,
      modifiedTime: article.updatedAt,
      section: article.series ?? undefined,
    },
  });
}

const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' });

export default async function JournalArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();
  const series = await getSeries(article.series);

  const published = DATE.format(new Date(article.date));
  const meta = [
    'Journal',
    series.length > 1 ? `${article.series} ${article.part} / ${series.length}` : article.series,
    published,
    `${article.minutes} min de lecture`,
    article.referenceCount > 0 ? `${article.referenceCount} références` : null,
  ].filter((m): m is string => Boolean(m));

  return (
    <>
      <JsonLd data={[blogPostingJsonLd(article), journalBreadcrumbJsonLd(article)]} />
      <PageShell
        title={article.title}
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
                ) : (
                  <span key={m}>{m}</span>
                ),
              )}
            </p>
          </div>
        }
      >
        <ArticleBody article={article} series={series} />
      </PageShell>
    </>
  );
}
