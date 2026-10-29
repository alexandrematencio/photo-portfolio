import { getAllArticles, getAllSeries } from '@/lib/journal/articles';
import { SITE_INFO, withSlash } from '@/lib/seo/metadata';
import { conceptMapAlternates } from '@/lib/journal/conceptMapData';
import { LANGS, LOCALE, aboutPath, homePath } from '@/lib/journal/i18n';
import type { Alternates } from '@/lib/journal/types';

/**
 * Sitemap du journal (build `SITE_TARGET=blog`). `lastmod` vient de Sanity
 * (`_updatedAt`) : c'est ce qui dit à Google qu'un article corrigé mérite
 * d'être relu. Route classique, pas `sitemap.blog.ts` : cf. robots.txt.
 *
 * Trois langues (2026-10-18) : chaque adresse déclare ses traductions
 * (`xhtml:link hreflang`), en plus des balises du <head> de chaque page.
 */
export const dynamic = 'force-static';

const abs = (path: string) => `${SITE_INFO.url}${withSlash(path)}`;

function links(alternates: Alternates): string {
  return (Object.entries(alternates) as [keyof typeof LOCALE, string][])
    .map(([l, path]) => `<xhtml:link rel="alternate" hreflang="${LOCALE[l].bcp47}" href="${abs(path)}"/>`)
    .join('');
}

export async function GET() {
  const [articles, mapAlternates, ...seriesByLang] = await Promise.all([getAllArticles(), conceptMapAlternates(), ...LANGS.map((l) => getAllSeries(l))]);
  const series = seriesByLang.flat();
  const touched = new Map(articles.map((a) => [`${a.lang}/${a.slug}`, a.updatedAt ?? a.date]));
  const homes = Object.fromEntries(
    LANGS.filter((l) => articles.some((a) => a.lang === l)).map((l) => [l, homePath(l)]),
  ) as Alternates;
  const entries = [
    ...(Object.entries(homes) as [string, string][]).map(([l, path]) => ({
      loc: abs(path),
      lastmod: articles.filter((a) => a.lang === l).map((a) => a.updatedAt ?? a.date).sort().at(-1),
      alternates: homes,
    })),
    // « À propos de ce journal » : dans les trois langues, sans date fiable à donner.
    ...LANGS.map((l) => ({
      loc: abs(aboutPath(l)),
      lastmod: undefined as string | undefined,
      alternates: Object.fromEntries(LANGS.map((x) => [x, aboutPath(x)])) as Alternates,
    })),
    // La Concept Map : dans chaque langue où ses libellés existent.
    ...Object.values(mapAlternates).map((path) => ({ loc: abs(path!), lastmod: undefined as string | undefined, alternates: mapAlternates })),
    // Une série a changé quand l'un de ses articles a changé.
    ...series.map((s) => ({
      loc: abs(s.alternates[s.lang]!),
      lastmod: s.articles.map((a) => touched.get(`${a.lang}/${a.slug}`) ?? a.date).sort().at(-1),
      alternates: s.alternates,
    })),
    ...articles.map((a) => ({
      loc: abs(a.alternates[a.lang]!),
      lastmod: a.updatedAt ?? a.date,
      alternates: a.alternates,
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (e) =>
      `  <url><loc>${e.loc}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}${
        Object.keys(e.alternates).length > 1 ? links(e.alternates) : ''
      }</url>`,
  )
  .join('\n')}
</urlset>
`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
