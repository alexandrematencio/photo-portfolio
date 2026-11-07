import type { Box } from '@/lib/site/page-transition';

/* Les réglages du hero de la home, partagés par HomeHero et ses hooks
   (useScrollMorph, useMenuLeave). Sortis de HomeHero.tsx tels quels (audit 1.6). */

// Cibles de la transition (≈ taille finale du header)
export const GLYPH_INITIAL = 108;
export const GLYPH_TARGET = 28;
export const NAV_FONT_INITIAL = 32;
// 32 = pas de shrink, les nav-items gardent leur taille initiale (32px)
// en mode nav-bar fixed top. Seule la position morphe (vertical → horizontal).
export const NAV_FONT_TARGET = 32;
export const HEADER_HEIGHT = 64; // h-16 — identique sur toutes les pages (SiteHeader)
// Nav-bar final = pleine largeur, items space-between. Gauche : la gouttière
// de page, lue sur le token (20 sous `md`, 32 au-dessus) — c'est là que se
// pose le glyph de `SiteHeader`. Droite : 64, desktop seulement (les libellés
// sont cachés sous `md`).
export const pageGutter = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--page-gutter')) || 32;
export const PAD_RIGHT = 64;

// Timing du morph dans la timeline (en "unités" timeline, 1 = full)
// La durée totale en SECONDES est gérée par le `scrub` du ScrollTrigger.
export const FADE_FAST_DURATION = 0.15; // photo-profile, arrow, nom : vanish vite
export const MORPH_SLOW_DURATION = 1; // logo + nav items : morph lent, prend toute la timeline

/** Clic dans le menu du hero : le scroll-morph joué tout seul, en secondes
    (pour une timeline prise à 0 ; au prorata si le visiteur a déjà défilé).
    La page suivante entre EN MÊME TEMPS, en `EXIT_DURATION` (page-transition.ts). */
export const MENU_LEAVE_DURATION = 0.45;
/** Pas d'échantillonnage du morph pour le départ par le menu : bien plus
    d'images que les ~27 que dure le vol, l'arrondi au pas le plus proche ne
    se voit pas. */
export const MENU_LEAVE_SAMPLES = 120;

export const centerOf = (b: Box) => ({ x: b.left + b.width / 2, y: b.top + b.height / 2 });
