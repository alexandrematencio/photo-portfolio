import type { Metadata } from 'next';

const SITE_NAME = 'A. Matencio — Photographer';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const DEFAULT_DESC =
  "Author photography — street, landscape and portrait. Portfolio of A. Matencio.";

/** Chemin de route terminé par un slash (cf. `trailingSlash: true`). */
export function withSlash(path: string): string {
  if (!path) return '/';
  return path.endsWith('/') ? path : `${path}/`;
}

export function buildMetadata(opts: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
}): Metadata {
  const title = opts.title ? `${opts.title} — ${SITE_NAME}` : SITE_NAME;
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
      type: 'website',
      url,
      siteName: SITE_NAME,
      locale: 'en_US',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}

export const SITE_INFO = { name: SITE_NAME, url: SITE_URL, description: DEFAULT_DESC };
