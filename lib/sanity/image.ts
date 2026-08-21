import imageUrlBuilder, { type SanityImageSource } from '@sanity/image-url';
import { dataset, projectId, isSanityConfigured } from './env';

const builder = isSanityConfigured
  ? imageUrlBuilder({ projectId, dataset })
  : null;

/**
 * Largeur maximale servie pour une photo, tous usages confondus.
 *
 * Doit rester alignée sur `MAX_EDGE` de `scripts/upload-photos.ts` (2048) : les
 * photos importées depuis ce script ne sont de toute façon pas plus grandes, ce
 * plafond ne mord donc que sur les assets antérieurs, restés en pleine
 * résolution dans Sanity.
 *
 * ⚠️ Ce n'est PAS une protection à lui seul, seulement un garde-fou. L'asset
 * stocké reste joignable à son URL nue : sur un original en 6000 px, retirer le
 * `?w=` rend les 6000 px. Vérifié aussi : le paramètre `max-w=` du CDN Sanity ne
 * plafonne rien (6000×4000 renvoyés avec `?max-w=2048`), il ne peut donc pas
 * servir de barrière. Seule la réduction de l'asset à l'import ferme le trou.
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
