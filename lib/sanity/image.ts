import imageUrlBuilder, { type SanityImageSource } from '@sanity/image-url';
import { dataset, projectId, isSanityConfigured } from './env';

const builder = isSanityConfigured
  ? imageUrlBuilder({ projectId, dataset })
  : null;

/**
 * Largeur maximale servie pour une photo, tous usages confondus.
 *
 * Doit rester alignée sur `MAX_EDGE` de `scripts/prepare-image.ts` (2048) et
 * sur `MAX_ASSET_EDGE` de `sanity/validation/assetWithinCap.ts`. Depuis le
 * 2026-09-11 (scripts/downsize-assets.ts), AUCUN asset référencé par le site
 * ne dépasse ce plafond : retirer `?w=` d'une URL rend au plus 2048 px, et le
 * Studio refuse de publier une photo plus grande. Ce plafond d'URL est donc
 * redevenu ce qu'il doit être — un garde-fou, pas la protection.
 *
 * Toujours vrai : le paramètre `max-w=` du CDN Sanity ne plafonne rien, et le
 * CDN ré-encode tout (métadonnées comprises). Seule la taille de l'asset
 * stocké compte.
 */
export const MAX_PHOTO_WIDTH = 2048;

/**
 * Constructeur d'URL d'image, **déjà plafonné** à `MAX_PHOTO_WIDTH`.
 *
 * Le plafond est posé ici et pas dans chaque appelant parce qu'il n'y a qu'une
 * façon de le rater : oublier `.width()`. C'est exactement ce qui arrivait au
 * bouton « Open original » de la lightbox — un `builder.url()` sans largeur, qui
 * servait donc l'original pleine résolution (jusqu'à 6356 px / 28 Mo) en un clic,
 * sans même ouvrir les outils de développement.
 *
 * Les appelants gardent la main : `.width(280)` l'emporte (le dernier appel
 * gagne). Demander PLUS que le plafond fonctionnerait aussi — c'est délibéré,
 * une vignette n'a pas à être bridée par une règle pensée pour les grands
 * formats — mais ça doit rester un geste conscient, jamais un oubli.
 */
export function urlFor(source: SanityImageSource) {
  if (!builder) return null;
  return builder.image(source).width(MAX_PHOTO_WIDTH);
}

/**
 * L'URL INDEXABLE d'une photo — celle que déclarent le `contentUrl` du JSON-LD
 * (lib/seo/jsonld.ts) ET le sitemap image (app/sitemap.ts). Un seul endroit :
 * deux chaînes qui divergent donneraient DEUX URL à indexer pour la même photo.
 * 1600 px : la largeur de la galerie de la home, le plus grand format servi hors
 * lightbox. Retourne `null` si Sanity n'est pas configuré.
 */
export function indexableImageUrl(
  source: SanityImageSource | undefined | null
): string | null {
  if (!source) return null;
  const b = urlFor(source);
  return b ? b.width(1600).quality(80).auto('format').url() : null;
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
