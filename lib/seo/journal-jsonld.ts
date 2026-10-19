import type { Article, ArticleSummary, Inline, JournalSeries } from '@/lib/journal/types';
import { SITE_INFO, withSlash } from '@/lib/seo/metadata';
import { authorRef, type JsonLdObject } from '@/lib/seo/jsonld';
import { DICT, LOCALE, aboutPath, articlePath, homePath, seriesPath, type Lang } from '@/lib/journal/i18n';

/**
 * Données structurées du journal (blog.amatencio.com). Ce que Google en tire :
 * l'auteur et les dates dans le résultat, le rattachement de chaque article à
 * la même personne que le portfolio (`authorRef`, même `@id`), et la liste des
 * sources (`citation`) — un texte qui cite ses références se déclare comme tel.
 */
const CONTEXT = 'https://schema.org';

const url = (path: string) => `${SITE_INFO.url}${withSlash(path)}`;

function plain(nodes: Inline[]): string {
  return nodes.map((n) => (n.t === 'text' ? n.text : '')).join('').trim();
}

export function blogJsonLd(articles: ArticleSummary[], lang: Lang): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Blog',
    '@id': `${url(homePath(lang))}#blog`,
    name: DICT[lang].siteName,
    description: DICT[lang].siteDescription,
    url: url(homePath(lang)),
    inLanguage: LOCALE[lang].bcp47,
    author: authorRef(),
    publisher: authorRef(),
    blogPost: articles.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.dek,
      url: url(articlePath(a.slug, a.lang)),
      datePublished: a.date,
    })),
  };
}

export function blogPostingJsonLd(article: Article): JsonLdObject {
  const self = url(articlePath(article.slug, article.lang));
  return {
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    '@id': `${self}#article`,
    headline: article.seoTitle ?? article.title,
    name: article.title,
    description: article.seoDescription ?? article.dek,
    url: self,
    mainEntityOfPage: self,
    datePublished: article.date,
    dateModified: article.updatedAt ?? article.date,
    inLanguage: LOCALE[article.lang].bcp47,
    author: authorRef(),
    publisher: authorRef(),
    isPartOf: blogRef(article.lang),
    timeRequired: `PT${article.minutes}M`,
    wordCount: article.words,
    ...(article.series ? { articleSection: article.series } : {}),
    ...(article.seriesSlug
      ? { isPartOf: [blogRef(article.lang), { '@type': 'CollectionPage', '@id': `${url(seriesPath(article.seriesSlug, article.lang))}#series`, name: article.series }] }
      : {}),
    ...(article.references.length
      ? { citation: article.references.map((r) => plain(r.citation)).filter(Boolean) }
      : {}),
  };
}

function blogRef(lang: Lang) {
  return { '@type': 'Blog', '@id': `${url(homePath(lang))}#blog`, name: DICT[lang].siteName };
}

/**
 * La page d'une série : une `CollectionPage` dont l'objet principal est la
 * liste ORDONNÉE de ses articles (`ItemList`, positions = parties).
 */
export function seriesJsonLd(series: JournalSeries, description: string): JsonLdObject {
  const self = url(seriesPath(series.slug, series.lang));
  return {
    '@context': CONTEXT,
    '@type': 'CollectionPage',
    '@id': `${self}#series`,
    name: series.title,
    description,
    url: self,
    inLanguage: LOCALE[series.lang].bcp47,
    author: authorRef(),
    isPartOf: blogRef(series.lang),
    mainEntity: {
      '@type': 'ItemList',
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: series.articles.length,
      itemListElement: series.articles.map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: url(articlePath(a.slug, a.lang)),
        name: a.title,
      })),
    },
  };
}

export function seriesBreadcrumbJsonLd(series: JournalSeries): JsonLdObject {
  return breadcrumb([
    { name: 'Journal', item: url(homePath(series.lang)) },
    { name: series.title, item: url(seriesPath(series.slug, series.lang)) },
  ]);
}

export function journalBreadcrumbJsonLd(article: Article): JsonLdObject {
  const items = [{ name: 'Journal', item: url(homePath(article.lang)) }];
  if (article.series && article.seriesSlug) items.push({ name: article.series, item: url(seriesPath(article.seriesSlug, article.lang)) });
  items.push({ name: article.title, item: url(articlePath(article.slug, article.lang)) });
  return breadcrumb(items);
}

export function aboutBreadcrumbJsonLd(lang: Lang, title: string): JsonLdObject {
  return breadcrumb([
    { name: 'Journal', item: url(homePath(lang)) },
    { name: title, item: url(aboutPath(lang)) },
  ]);
}

function breadcrumb(items: { name: string; item: string }[]): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
  };
}
