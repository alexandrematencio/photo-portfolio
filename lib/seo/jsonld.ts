import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { SITE_INFO, withSlash } from '@/lib/seo/metadata';
import { AUTHOR_NAME, AUTHOR_SHORT, copyrightNotice } from '@/lib/site/author';

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

export const AUTHOR_ID = `${SITE_INFO.url}/about/#person`;
/** Page qui porte la clause de réutilisation (spec R4). */
export const LICENSE_URL = `${SITE_INFO.url}/legal/`;
/** Page par laquelle on demande une licence — Google l'affiche en bouton. */
export const ACQUIRE_LICENSE_URL = `${SITE_INFO.url}/contact/`;

function pageUrl(path: string): string {
  return `${SITE_INFO.url}${withSlash(path)}`;
}

export function personJsonLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'Person',
    '@id': AUTHOR_ID,
    name: AUTHOR_NAME,
    alternateName: AUTHOR_SHORT,
    jobTitle: 'Photographer',
    url: pageUrl('/about'),
    image: `${SITE_INFO.url}/img/photo-profile.jpg`,
  };
}

export function webSiteJsonLd(): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'WebSite',
    '@id': `${SITE_INFO.url}/#website`,
    name: SITE_INFO.name,
    url: pageUrl('/'),
    description: SITE_INFO.description,
    inLanguage: 'en-US',
    author: { '@id': AUTHOR_ID },
    copyrightHolder: { '@id': AUTHOR_ID },
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
    contentUrl: builder.width(1600).quality(80).auto('format').url(),
    thumbnailUrl: builder.width(400).quality(75).auto('format').url(),
    creator: { '@type': 'Person', '@id': AUTHOR_ID, name: AUTHOR_NAME },
    creditText: AUTHOR_NAME,
    copyrightHolder: { '@id': AUTHOR_ID },
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
    author: { '@id': AUTHOR_ID },
    copyrightHolder: { '@id': AUTHOR_ID },
    license: LICENSE_URL,
    numberOfItems: image.length,
    image,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLdObject {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: pageUrl(item.path),
    })),
  };
}
