import type { Article, ArticleSummary, Inline } from '@/lib/journal/types';
import { SITE_INFO, withSlash } from '@/lib/seo/metadata';
import { authorRef, type JsonLdObject } from '@/lib/seo/jsonld';
import { articlePath } from '@/lib/site/sites';

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

export function blogJsonLd(articles: ArticleSummary[]): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Blog',
    '@id': `${url('/')}#blog`,
    name: SITE_INFO.name,
    description: SITE_INFO.description,
    url: url('/'),
    inLanguage: 'fr-FR',
    author: authorRef(),
    publisher: authorRef(),
    blogPost: articles.map((a) => ({
      '@type': 'BlogPosting',
      headline: a.title,
      description: a.dek,
      url: url(articlePath(a.slug)),
      datePublished: a.date,
    })),
  };
}

export function blogPostingJsonLd(article: Article): JsonLdObject {
  const self = url(articlePath(article.slug));
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
    inLanguage: 'fr-FR',
    author: authorRef(),
    publisher: authorRef(),
    isPartOf: { '@type': 'Blog', '@id': `${url('/')}#blog`, name: SITE_INFO.name },
    timeRequired: `PT${article.minutes}M`,
    wordCount: article.words,
    ...(article.series ? { articleSection: article.series } : {}),
    ...(article.references.length
      ? { citation: article.references.map((r) => plain(r.citation)).filter(Boolean) }
      : {}),
  };
}

export function journalBreadcrumbJsonLd(article?: Article): JsonLdObject {
  const items = [{ name: 'Journal', item: url('/') }];
  if (article) items.push({ name: article.title, item: url(articlePath(article.slug)) });
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, ...it })),
  };
}
