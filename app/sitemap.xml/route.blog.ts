import { getAllSeries, getArticles } from '@/lib/journal/articles';
import { SITE_INFO, withSlash } from '@/lib/seo/metadata';
import { articlePath, seriesPath } from '@/lib/site/sites';

/**
 * Sitemap du journal (build `SITE_TARGET=blog`). `lastmod` vient de Sanity
 * (`_updatedAt`) : c'est ce qui dit à Google qu'un article corrigé mérite
 * d'être relu. Route classique, pas `sitemap.blog.ts` : cf. robots.txt.
 */
export const dynamic = 'force-static';

export async function GET() {
  const [articles, series] = await Promise.all([getArticles(), getAllSeries()]);
  const touched = new Map(articles.map((a) => [a.slug, a.updatedAt ?? a.date]));
  const latest = articles.map((a) => a.updatedAt ?? a.date).sort().at(-1);
  const entries = [
    { loc: `${SITE_INFO.url}/`, lastmod: latest },
    // Une série a changé quand l'un de ses articles a changé.
    ...series.map((s) => ({
      loc: `${SITE_INFO.url}${withSlash(seriesPath(s.slug))}`,
      lastmod: s.articles.map((a) => touched.get(a.slug) ?? a.date).sort().at(-1),
    })),
    ...articles.map((a) => ({
      loc: `${SITE_INFO.url}${withSlash(articlePath(a.slug))}`,
      lastmod: a.updatedAt ?? a.date,
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
