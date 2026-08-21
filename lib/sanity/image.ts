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
 * Crop carré 768 × 768 (honore le hotspot/crop défini dans le Studio),
 * qualité 80, format auto (WebP/AVIF servi par le CDN Sanity). 768 px couvre
 * la box 224–256 px du hero jusqu'à un DPR ~3 (mobiles haute densité), tout
 * en gardant le poids livré bas (~50–90 Ko) pour un chargement rapide en
 * Europe/Ouest. Retourne `null` si Sanity n'est pas configuré ou si la source
 * est absente — l'appelant gère le fallback.
 */
export function heroImageUrl(
  source: SanityImageSource | undefined | null
): string | null {
  if (!builder || !source) return null;
  return builder
    .image(source)
    .width(768)
    .height(768)
    .fit('crop')
    .quality(80)
    .auto('format')
    .url();
}
