import { heroImageUrl } from '@/lib/sanity/image';
import type { SiteSettings } from '@/lib/sanity/queries';

/**
 * Données du hero prêtes à consommer par <HomeHero /> / <HomeHeroSplash />.
 *
 * - `defaultSrc` / `revealSrc` : URLs CDN Sanity (ou `null` si l'image n'est
 *   pas encore renseignée dans le Studio — le composant affiche alors la box
 *   vide plutôt que de crasher). Les deux images sont obligatoires côté Studio
 *   (validation), donc `null` ne devrait survenir qu'avant le 1ᵉʳ remplissage.
 * - `defaultAlt` : texte alternatif de l'image visible (a11y + SEO). L'image au
 *   survol est purement décorative → rendue avec `alt=""`, pas de champ ici.
 */
export type HeroImages = {
  defaultSrc: string | null;
  defaultAlt: string;
  revealSrc: string | null;
};

const FALLBACK_ALT = 'Portrait of A. Matencio';

export function resolveHeroImages(hero: SiteSettings['hero']): HeroImages {
  return {
    defaultSrc: heroImageUrl(hero?.defaultImage),
    defaultAlt: hero?.defaultImage?.alt?.trim() || FALLBACK_ALT,
    revealSrc: heroImageUrl(hero?.revealImage),
  };
}
