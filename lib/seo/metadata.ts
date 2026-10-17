import type { Metadata } from 'next';
import { IS_BLOG, PHOTO_URL } from '@/lib/site/sites';

// Nom, description et langue dépendent du site construit (lib/site/sites.ts) :
// le journal est en français, le portfolio en anglais.
const SITE_NAME = IS_BLOG ? 'Journal d’Alexandre Matencio' : 'Alexandre Matencio — Photographer';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const DEFAULT_DESC = IS_BLOG
  ? 'Le journal d’Alexandre Matencio : des textes longs et sourcés sur les marchés de collection, la conscience et ce que la recherche en dit.'
  : "Author photography — street, landscape and portrait. Portfolio of Alexandre Matencio, photographer based near Paris.";
const LOCALE = IS_BLOG ? 'fr_FR' : 'en_US';

/** Chemin de route terminé par un slash (cf. `trailingSlash: true`). */
export function withSlash(path: string): string {
  if (!path) return '/';
  return path.endsWith('/') ? path : `${path}/`;
}

export function buildMetadata(opts: {
  title?: string;
  /** Titre complet, sans le suffixe de marque (la home : le nom EST le titre). */
  absoluteTitle?: string;
  description?: string;
  path?: string;
  image?: string;
  /** Article du journal : `og:type=article` et ses dates (Open Graph). */
  article?: { publishedTime: string; modifiedTime?: string; section?: string };
}): Metadata {
  const title =
    opts.absoluteTitle ??
    (opts.title ? `${opts.title} — ${SITE_NAME}` : SITE_NAME);
  const description = opts.description ?? DEFAULT_DESC;
  // Slash final imposé : le site est en `trailingSlash: true` (next.config.ts,
  // GH Pages ne réécrit pas /series → /series/index.html). Une canonical sans
  // slash désignerait donc une URL qui REDIRIGE vers la vraie — l'inverse de ce
  // qu'une canonical est censée faire.
  const url = `${SITE_URL}${withSlash(opts.path ?? '/')}`;
  const image = opts.image ?? `${SITE_URL}/og-default.jpg`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: LOCALE,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
      ...(opts.article
        ? {
            type: 'article' as const,
            publishedTime: opts.article.publishedTime,
            modifiedTime: opts.article.modifiedTime,
            section: opts.article.section,
            authors: [`${PHOTO_URL}/about/`],
          }
        : { type: 'website' as const }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    // `max-image-preview: large` : Google a le droit de montrer la vignette en
    // grand dans ses résultats — c'est ce qu'un portfolio veut.
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    // Deux balises qui ne dépendent PAS de robots.txt : elles voyagent avec
    // chaque page, même copiée ou servie par un tiers. `noai`/`noimageai`
    // (DeviantArt, 2022) ne sont honorées que par quelques acteurs ;
    // `tdm-reservation` est le protocole européen (W3C TDMRep, directive DSM
    // art. 4) — c'est celui qui pèse.
    other: {
      robots: 'noai, noimageai',
      'tdm-reservation': '1',
      // Les mentions légales vivent sur le portfolio, pour les deux sites.
      'tdm-policy': `${PHOTO_URL}${withSlash('/legal')}`,
    },
  };
}

export const SITE_INFO = { name: SITE_NAME, url: SITE_URL, description: DEFAULT_DESC, locale: LOCALE };
