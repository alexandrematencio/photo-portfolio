import { getArticles } from '@/lib/journal/articles';
import { SITE_INFO, withSlash } from '@/lib/seo/metadata';
import { articlePath } from '@/lib/site/sites';
import { AUTHOR_NAME } from '@/lib/site/author';

/**
 * Flux RSS du journal — blog.amatencio.com/feed.xml, annoncé dans le <head>
 * (layout du blog). Les lecteurs de flux et les agrégateurs le suivent, et il
 * signale chaque nouvel article plus vite qu'un sitemap. Généré au build
 * (export statique), comme tout le reste.
 */
export const dynamic = 'force-static';

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  const articles = await getArticles();
  const home = `${SITE_INFO.url}/`;
  const items = articles
    .map((a) => {
      const link = `${SITE_INFO.url}${withSlash(articlePath(a.slug))}`;
      return `    <item>
      <title>${xml(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
      <dc:creator>${xml(AUTHOR_NAME)}</dc:creator>
      ${a.series ? `<category>${xml(a.series)}</category>` : ''}
      <description>${xml(a.seoDescription ?? a.dek)}</description>
    </item>`;
    })
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xml(SITE_INFO.name)}</title>
    <link>${home}</link>
    <description>${xml(SITE_INFO.description)}</description>
    <language>fr-FR</language>
    <atom:link href="${SITE_INFO.url}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
