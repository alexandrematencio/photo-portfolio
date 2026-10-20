import type { Metadata } from 'next';
import { IS_BLOG, PHOTO_URL } from '@/lib/site/sites';
import { DICT, LOCALE as JOURNAL_LOCALE, type Lang } from '@/lib/journal/i18n';
import type { Alternates } from '@/lib/journal/types';

// Nom, description et langue dépendent du site construit (lib/site/sites.ts) :
// le journal est en français (et en anglais, en russe : `opts.lang`), le
// portfolio en anglais.
const SITE_NAME = IS_BLOG ? DICT.fr.siteName : 'Alexandre Matencio — Photographer';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const DEFAULT_DESC = IS_BLOG
  ? DICT.fr.siteDescription
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
  /** Journal : la langue de la page (nom du site, locale Open Graph). */
  lang?: Lang;
  /**
   * Journal : la même page dans chaque langue (chemins). Devient les liens
   * `hreflang` — que Google lit, et que le script de langue suit
   * (`languageScript`, lib/journal/i18n.ts).
   */
  alternates?: Alternates;
}): Metadata {
  const dict = IS_BLOG && opts.lang ? DICT[opts.lang] : null;
  const siteName = dict?.siteName ?? SITE_NAME;
  const locale = IS_BLOG && opts.lang ? JOURNAL_LOCALE[opts.lang].og : LOCALE;
  const title =
    opts.absoluteTitle ??
    (opts.title ? `${opts.title} — ${siteName}` : siteName);
  const description = opts.description ?? dict?.siteDescription ?? DEFAULT_DESC;
  // Slash final imposé : le site est en `trailingSlash: true` (next.config.ts,
  // GH Pages ne réécrit pas /series → /series/index.html). Une canonical sans
  // slash désignerait donc une URL qui REDIRIGE vers la vraie — l'inverse de ce
  // qu'une canonical est censée faire.
  const url = `${SITE_URL}${withSlash(opts.path ?? '/')}`;
  // Repli du journal : le glyphe seul (scripts/make-og-journal.ts) — une photo
  // du portfolio y passerait pour l'illustration de l'article.
  const image = opts.image ?? `${SITE_URL}/${IS_BLOG ? 'og-journal.png' : 'og-default.jpg'}`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: url, ...(opts.alternates ? { languages: hreflang(opts.alternates) } : {}) },
    openGraph: {
      title,
      description,
      url,
      siteName,
      locale,
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

/**
 * `hreflang` : chaque langue où la page existe, plus `x-default` — la
 * version que reçoit un lecteur dont la langue n'est pas servie. C'est
 * l'anglais, comme dans `languageScript` ; le français à défaut.
 */
function hreflang(alternates: Alternates): Record<string, string> {
  const abs = (path: string) => `${SITE_URL}${withSlash(path)}`;
  const out: Record<string, string> = {};
  for (const [lang, path] of Object.entries(alternates) as [Lang, string][]) {
    out[JOURNAL_LOCALE[lang].bcp47] = abs(path);
  }
  const fallback = alternates.en ?? alternates.fr;
  if (fallback) out['x-default'] = abs(fallback);
  return out;
}

export const SITE_INFO = { name: SITE_NAME, url: SITE_URL, description: DEFAULT_DESC, locale: LOCALE };
