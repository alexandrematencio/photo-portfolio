import type { MetadataRoute } from 'next';

// Requis pour `output: 'export'` sur les routes Metadata (sitemap, robots).
export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://amatencio.photo';
  const now = new Date();
  const routes = [
    '/',
    '/about',
    '/flat-gallery',
    '/contact',
    '/hire-me',
    '/mentions-legales',
    '/politique-de-confidentialite',
  ];
  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
