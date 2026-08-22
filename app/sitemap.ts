import type { MetadataRoute } from 'next';
import { withSlash } from '@/lib/seo/metadata';

// Requis pour `output: 'export'` sur les routes Metadata (sitemap, robots).
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://amatencio.photo';
  const now = new Date();
  const routes = [
    '/',
    '/about',
    '/about/digital-agency',
    '/series',
    '/archives',
    '/contact',
    '/socials',
    '/legal',
    '/privacy',
  ];
  // Slash final : le site est en `trailingSlash: true` — déclarer `/series`
  // enverrait Google sur une redirection au lieu de la page (cf. buildMetadata).
  return routes.map((path) => ({
    url: `${base}${withSlash(path)}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
