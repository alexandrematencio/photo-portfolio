import imageUrlBuilder, { type SanityImageSource } from '@sanity/image-url';
import { dataset, projectId, isSanityConfigured } from './env';

const builder = isSanityConfigured
  ? imageUrlBuilder({ projectId, dataset })
  : null;

export function urlFor(source: SanityImageSource) {
  if (!builder) return null;
  return builder.image(source);
}

/**
 * URL d'une image du hero (homepage), prête à passer à `next/image`.
 *
 * Largeur 1152 px, RATIO NATIF PRÉSERVÉ (le crop éditeur défini dans le
 * Studio reste honoré, mais aucun recadrage forcé côté CDN) : la box du hero
 * est un 3:2 paysage (2x3/4x6) en desktop et un carré en dessous de `lg`,
 * c'est le `object-cover` CSS de chaque box qui recadre — un crop CDN carré
 * re-carrait la photo avant même d'arriver au navigateur. 1152 px couvre la
 * box desktop 384 px jusqu'à un DPR 3, qualité 80, format auto (WebP/AVIF
 * servi par le CDN Sanity). Retourne `null` si Sanity n'est pas configuré ou
 * si la source est absente — l'appelant gère le fallback.
 */
export function heroImageUrl(
  source: SanityImageSource | undefined | null
): string | null {
  if (!builder || !source) return null;
  return builder
    .image(source)
    .width(1152)
    .quality(80)
    .auto('format')
    .url();
}
