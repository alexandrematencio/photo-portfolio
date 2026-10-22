import { indexableImageUrl, urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { SITE_INFO, withSlash } from '@/lib/seo/metadata';
import { AUTHOR_FULL_NAME, AUTHOR_NAME, AUTHOR_SAME_AS, AUTHOR_SHORT, copyrightNotice } from '@/lib/site/author';
import { ABOUT_URL, BLOG_URL, HUB_URL, PHOTO_URL } from '@/lib/site/sites';

/**
 * Constructeurs Schema.org — fonctions PURES, sans React.
 *
 * Pourquoi : Google Images n'affiche le crédit d'auteur et le badge
 * « Licensable » que si la page déclare `creator`, `creditText`,
 * `copyrightNotice`, `license` et `acquireLicensePage` sur chaque `ImageObject`
 * (ou si le fichier porte l'IPTC correspondant — ce que le CDN Sanity efface,
 * cf. spec §1). C'est donc la SEULE provenance lisible par les machines que ce
 * site peut offrir. Chaque page qui rend des photos monte un `ImageGallery`.
 */
export type JsonLdObject = Record<string, unknown>;

const CONTEXT = 'https://schema.org';

export function pageUrl(path: string): string {
  return `${SITE_INFO.url}${withSlash(path)}`;
}

/** Une page du PORTFOLIO, quel que soit le site construit : la personne, la
 *  licence et le contact y vivent, et le journal les désigne là-bas. */
function photoPageUrl(path: string): string {
  return `${PHOTO_URL}${withSlash(path)}`;
}

/** La personne a son @id sur la page About du hub, la seule (2026-10-22). */
export const AUTHOR_ID = `${ABOUT_URL}#person`;
/** Page qui porte la clause de réutilisation (spec R4). */
export const LICENSE_URL = photoPageUrl('/legal');
/** Page par laquelle on demande une licence — Google l'affiche en bouton. */
export const ACQUIRE_LICENSE_URL = photoPageUrl('/contact');

/**
 * Nœud Person INLINE, pas une simple référence `@id` : Google ne résout pas
 * les `@id` d'une page à l'autre, et le Person complet n'existe que sur
 * /about. Sans `@type` ni `name`, `copyrightHolder` serait vide pour lui.
 */
export function authorRef(): JsonLdObject {
  return { '@type': 'Person', '@id': AUTHOR_ID, name: AUTHOR_NAME };
}

export function personJsonLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Person',
    '@id': AUTHOR_ID,
    name: AUTHOR_NAME,
    alternateName: [AUTHOR_FULL_NAME, 'Alex Matencio', AUTHOR_SHORT],
    jobTitle: 'Art director, designer and photographer',
    description:
      'Art director, designer and photographer based in Villejuif, near Paris. Author photography — street, landscape and portrait.',
    // L'adresse de la personne, c'est le hub ; ses sites sont ses œuvres.
    url: HUB_URL,
    mainEntityOfPage: ABOUT_URL,
    sameAs: [...AUTHOR_SAME_AS, `${PHOTO_URL}/`, `${BLOG_URL}/`],
    address: { '@type': 'PostalAddress', addressLocality: 'Villejuif', addressCountry: 'FR' },
    knowsAbout: ['Street photography', 'Landscape photography', 'Portrait photography'],
    image: `${PHOTO_URL}/img/photo-profile.jpg`,
  };
}

export function webSiteJsonLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': `${SITE_INFO.url}/#website`,
    // Le NOM de la personne est le nom du site : c'est lui que Google affiche
    // au-dessus du titre dans les résultats.
    name: AUTHOR_NAME,
    alternateName: [AUTHOR_SHORT, 'ALXMTNC'],
    url: pageUrl('/'),
    description: SITE_INFO.description,
    inLanguage: 'en-US',
    author: authorRef(),
    copyrightHolder: authorRef(),
  };
}

/**
 * Une photo. `null` si elle n'a pas d'asset (rien à déclarer) ou si Sanity
 * n'est pas configuré. L'ancre `#photo-<slug>` de /archives est l'URL stable
 * d'une photo tant que /series/[slug] n'existe pas (spec §9 de /series).
 * `JSON.stringify` laisse tomber les clés `undefined` : pas de nettoyage ici.
 */
export function imageObjectJsonLd(photo: Photo): JsonLdObject | null {
  if (!photo.image?.asset?._ref) return null;
  const builder = urlFor(photo.image);
  if (!builder) return null;
  const anchor = `${pageUrl('/archives')}#photo-${photo.slug.current}`;
  const year = photo.year;
  return {
    '@type': 'ImageObject',
    '@id': anchor,
    url: anchor,
    name: photo.title,
    description: photo.image.alt ?? photo.caption,
    contentUrl: indexableImageUrl(photo.image),
    thumbnailUrl: builder.width(400).quality(75).auto('format').url(),
    creator: authorRef(),
    creditText: AUTHOR_NAME,
    copyrightHolder: authorRef(),
    copyrightNotice: copyrightNotice(year),
    copyrightYear: year,
    license: LICENSE_URL,
    acquireLicensePage: ACQUIRE_LICENSE_URL,
    dateCreated: photo.dateTaken,
    contentLocation: photo.location
      ? { '@type': 'Place', name: photo.location }
      : undefined,
  };
}

export function imageGalleryJsonLd(opts: {
  name: string;
  path: string;
  /** `@id` explicite quand une page porte PLUSIEURS galeries (/series). */
  id?: string;
  description?: string;
  photos: Photo[];
}): JsonLdObject {
  const image = opts.photos
    .map(imageObjectJsonLd)
    .filter((o): o is JsonLdObject => o !== null);
  return {
    '@context': CONTEXT,
    '@type': 'ImageGallery',
    '@id': opts.id ?? `${pageUrl(opts.path)}#gallery`,
    name: opts.name,
    url: pageUrl(opts.path),
    description: opts.description,
    author: authorRef(),
    copyrightHolder: authorRef(),
    license: LICENSE_URL,
    numberOfItems: image.length,
    image,
  };
}

export function breadcrumbJsonLd(
  items: { name: string; path?: string; url?: string }[]
): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      // `url` : une étape sur un autre hôte (le hub, pour /about).
      item: item.url ?? pageUrl(item.path ?? '/'),
    })),
  };
}
