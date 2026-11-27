import type { Photo } from '@/lib/sanity/queries';

/** Réglages de l'anneau. Les changer ici, nulle part ailleurs. */
export const RING = {
  /** Photos par anneau, au plus (les premières de l'ordre manuel, cover en tête). */
  max: 8,
  /** Hauteur d'une carte (px, desktop). Mobile : `scale` CSS, cf. CarouselScene. */
  cardHeight: 420,
  /** Ratio largeur / hauteur : bornes, et repli quand Sanity n'a pas de dimensions. */
  minAspect: 0.6,
  maxAspect: 1.6,
  fallbackAspect: 0.8,
  /** Jeu minimal entre deux cartes, mesuré sur l'arc (px). */
  gap: 40,
  /** Part du cercle couverte par les cartes et leur jeu (la démo est vers 0,45). */
  fill: 0.55,
  /** Bornes du rayon (px). */
  minRadius: 360,
  maxRadius: 640,
  /** Recul de l'anneau derrière le plan de l'écran, au-delà du rayon (démo : 550 − 500). */
  setBack: 50,
} as const;

/** Première scène : elle remplit l'écran sous l'en-tête (mesure exacte en JS, carousel-motion.ts). */
export const FIRST_SCENE_MIN = 520; // px : l'anneau (420) et son inclinaison y tiennent
/** Hauteur approchée servie dans le HTML, avant la mesure : nav-bar 64 + en-tête de page ≈ 450 (desktop, grand titre centré de /work). */
export const FIRST_SCENE_SERVED_HEIGHT = `max(${FIRST_SCENE_MIN}px, calc(100svh - 64px - 450px))`;

export type RingCard = {
  photo: Photo;
  width: number; // px
  height: number; // px
  angle: number; // degrés, 0 = face au regard quand l'anneau est à 0
};

export type RingLayout = { cards: RingCard[]; radius: number; z: number };

export function aspectOf(p: Photo): number {
  const a = p.image?.dimensions?.aspectRatio;
  const v = typeof a === 'number' && Number.isFinite(a) && a > 0 ? a : RING.fallbackAspect;
  return Math.min(RING.maxAspect, Math.max(RING.minAspect, v));
}

export function ringLayout(photos: Photo[]): RingLayout {
  const picked = photos.slice(0, RING.max);
  const h = RING.cardHeight;
  const widths = picked.map((p) => Math.round(h * aspectOf(p)));
  const used = widths.reduce((s, w) => s + w + RING.gap, 0);
  const wanted = Math.min(RING.maxRadius, Math.max(RING.minRadius, used / (2 * Math.PI * RING.fill)));
  // `maxRadius` cède devant le besoin : jamais un cercle plus court que les cartes qu'il porte.
  const radius = Math.max(wanted, used / (2 * Math.PI));
  const circumference = 2 * Math.PI * radius;
  // Le jeu restant se partage également : l'anneau se referme quel que soit le clamp.
  const slack = Math.max(0, circumference - used) / Math.max(1, picked.length);
  const steps = widths.map((w) => w + RING.gap + slack);
  // Centre(0) = 0 ; centre(i) = centre(i−1) + pas(i−1)/2 + pas(i)/2. La somme des pas fait le
  // tour exact : l'écart du dernier centre au premier vaut pas(n−1)/2 + pas(0)/2.
  let center = 0;
  const cards = picked.map((photo, i) => {
    if (i > 0) center += steps[i - 1] / 2 + steps[i] / 2;
    return { photo, width: widths[i], height: h, angle: (center / radius) * (180 / Math.PI) };
  });
  return { cards, radius, z: -(radius + RING.setBack) };
}

/** Transform d'une cellule. `--spin` (glisser) et `--spread` / `--spin-spread` (vitesse) sont
 *  des variables CSS posées par carousel-motion.ts ; absentes, elles valent 0. */
export const cellTransform = (angle: number, radius: number) =>
  `rotateY(calc(${angle.toFixed(3)}deg + var(--spin, 0deg))) ` +
  `translateZ(calc(${radius.toFixed(1)}px + var(--spread, 0px) + var(--spin-spread, 0px)))`;
