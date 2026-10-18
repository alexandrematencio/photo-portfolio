import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell } from '@/components/site/PageShell';
import { JournalIndex } from '@/components/journal/JournalIndex';
import { ArticleView } from '@/components/journal/ArticleView';
import { BackLink } from '@/components/journal/BackLink';
import { LanguageSwitch } from '@/components/journal/LanguageSwitch';
import { SeriesArticleList } from '@/components/journal/SeriesArticleList';
import {
  getAllSeries,
  getArticle,
  getArticles,
  getSeries,
  getSeriesBySlug,
  getSignature,
  summarize,
} from '@/lib/journal/articles';
import { frenchSpaces } from '@/lib/journal/french';
import { DICT, LANGS, articlePath, homePath, seriesPath, type Lang } from '@/lib/journal/i18n';
import type { JournalSeries } from '@/lib/journal/types';
import { buildMetadata } from '@/lib/seo/metadata';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  blogJsonLd,
  blogPostingJsonLd,
  journalBreadcrumbJsonLd,
  seriesBreadcrumbJsonLd,
  seriesJsonLd,
} from '@/lib/seo/journal-jsonld';
import { AUTHOR_NAME } from '@/lib/site/author';
import { EDITORIAL_H3, MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * LES TROIS PAGES DU JOURNAL, une fois pour les trois langues (2026-10-18).
 * Les fichiers de route (`app/(blog)/…`, `app/(blog-en)/en/…`,
 * `app/(blog-ru)/ru/…`) ne font que les appeler avec leur langue : une page
 * corrigée l'est partout, aucune version ne dérive.
 *
 * Référencement, par page : canonical sur sa propre adresse, liens
 * `hreflang` vers ses traductions (`alternates`), données structurées dans
 * la langue de la page.
 */

type SlugParams = { params: Promise<{ slug: string }> };

/**
 * L'export statique refuse une route dynamique sans AUCUNE page : une langue
 * encore sans article (traductions pas publiées) casserait tout le build.
 * Une adresse témoin la remplace, qui ne trouve rien et rend la 404.
 */
const NO_PAGE = [{ slug: '_' }];
const orPlaceholder = (params: { slug: string }[]) => (params.length ? params : NO_PAGE);

/** L'accueil dans toutes les langues où il y a au moins un article. */
async function homeAlternates() {
  const counts = await Promise.all(LANGS.map(async (l) => [l, (await getArticles(l)).length] as const));
  return Object.fromEntries(counts.filter(([, n]) => n > 0).map(([l]) => [l, homePath(l)]));
}

// ── Accueil ───────────────────────────────────────────────────────────────

export async function homeMetadata(lang: Lang): Promise<Metadata> {
  return buildMetadata({
    // Le nom du site EST le titre de cette page : pas de suffixe répété.
    absoluteTitle: DICT[lang].siteName,
    path: homePath(lang),
    lang,
    alternates: await homeAlternates(),
  });
}

export async function JournalHome({ lang }: { lang: Lang }) {
  const articles = (await getArticles(lang)).map(summarize);
  const t = DICT[lang];
  return (
    <>
      <JsonLd data={blogJsonLd(articles, lang)} />
      <PageShell
        centered
        title={
          <>
            Journal
            {/* Le compteur en exposant, comme le « (123) » de Stripe. Gris :
                un compteur est une donnée, pas un état (§4.3). */}
            <sup
              aria-hidden
              className="font-bold tabular-nums text-[var(--color-fg-muted)]"
              style={{ fontSize: '0.24em', verticalAlign: 'top', position: 'relative', top: '0.35em', marginLeft: '0.15em' }}
            >
              ({articles.length})
            </sup>
            <span className="sr-only"> — {t.articles(articles.length)}</span>
          </>
        }
      >
        <JournalIndex
          articles={articles}
          lang={lang}
          language={<LanguageSwitch lang={lang} alternates={await homeAlternates()} heading />}
        />
      </PageShell>
    </>
  );
}

// ── Article ───────────────────────────────────────────────────────────────

export async function articleParams(lang: Lang) {
  return orPlaceholder((await getArticles(lang)).map((a) => ({ slug: a.slug })));
}

export async function articleMetadata(lang: Lang, { params }: SlugParams): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug, lang);
  if (!article) return {};
  return buildMetadata({
    title: article.seoTitle ?? article.title,
    description: article.seoDescription ?? article.dek,
    path: articlePath(slug, lang),
    lang,
    alternates: article.alternates,
    article: {
      publishedTime: article.date,
      modifiedTime: article.updatedAt,
      section: article.series ?? undefined,
    },
  });
}

export async function JournalArticle({ lang, params }: SlugParams & { lang: Lang }) {
  const { slug } = await params;
  const article = await getArticle(slug, lang);
  if (!article) notFound();
  const [series, signature] = await Promise.all([getSeries(article.seriesSlug, lang), getSignature(lang)]);

  return (
    <>
      <JsonLd data={[blogPostingJsonLd(article), journalBreadcrumbJsonLd(article)]} />
      <ArticleView article={article} series={series} signature={signature} />
    </>
  );
}

// ── Série ─────────────────────────────────────────────────────────────────

export async function seriesParams(lang: Lang) {
  return orPlaceholder((await getAllSeries(lang)).map((s) => ({ slug: s.slug })));
}

/** Sans présentation dans le Studio : une phrase tirée des titres. */
function seriesDescription(series: JournalSeries): string {
  if (series.description) return series.description;
  const quote = (s: string) => (series.lang === 'en' ? `“${s}”` : series.lang === 'ru' ? `«${s}»` : `« ${s} »`);
  const titles = series.articles.map((a) => quote(a.title)).join(', ');
  return DICT[series.lang].seriesFallback(series.title, series.articles.length, titles, AUTHOR_NAME);
}

export async function seriesMetadata(lang: Lang, { params }: SlugParams): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug, lang);
  if (!series) return {};
  return buildMetadata({
    title: series.title,
    description: seriesDescription(series),
    path: seriesPath(slug, lang),
    lang,
    alternates: series.alternates,
  });
}

export async function JournalSeriesPage({ lang, params }: SlugParams & { lang: Lang }) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug, lang);
  if (!series) notFound();
  const t = DICT[lang];

  const minutes = series.articles.reduce((n, a) => n + a.minutes, 0);
  const references = series.articles.reduce((n, a) => n + a.referenceCount, 0);
  const meta = [
    t.seriesKicker,
    t.articles(series.articles.length),
    t.minutes(minutes),
    references > 0 ? t.references(references) : null,
  ].filter((m): m is string => Boolean(m));

  return (
    <>
      <JsonLd data={[seriesJsonLd(series, seriesDescription(series)), seriesBreadcrumbJsonLd(series)]} />
      <PageShell
        title={series.title}
        back={<BackLink lang={lang} href={homePath(lang)} />}
        language={<LanguageSwitch lang={lang} alternates={series.alternates} />}
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
        <SeriesArticleList articles={series.articles} lang={lang} />
      </PageShell>
    </>
  );
}
