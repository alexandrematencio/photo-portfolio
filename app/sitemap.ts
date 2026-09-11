import type { MetadataRoute } from 'next';
import { urlFor } from '@/lib/sanity/image';
import { getAllPhotos } from '@/lib/sanity/queries';
import { withSlash } from '@/lib/seo/metadata';

// Requis pour `output: 'export'` sur les routes Metadata (sitemap, robots).
export const dynamic = 'force-static';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  // Sitemap IMAGE sur la page-catalogue : Google Images n'indexe une photo que
  // s'il la trouve, et une grille chargée en paresseux ne lui montre pas tout.
  // Même largeur que `contentUrl` du JSON-LD (1600) : une seule URL par photo
  // à indexer, pas deux.
  const photos = await getAllPhotos();
  const archiveImages = photos.flatMap((p) => {
    const b = p.image ? urlFor(p.image) : null;
    return b ? [b.width(1600).quality(80).auto('format').url()] : [];
  });

  // Slash final : le site est en `trailingSlash: true` — déclarer `/series`
  // enverrait Google sur une redirection au lieu de la page (cf. buildMetadata).
  return routes.map((path) => ({
    url: `${base}${withSlash(path)}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.7,
    ...(path === '/archives' ? { images: archiveImages } : {}),
  }));
}
