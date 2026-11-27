import type { Photo } from '@/lib/sanity/queries';

/** Réglages de l'anneau. Les changer ici, nulle part ailleurs. */
export const RING = {
  /** Photos par anneau, au plus (les premières de l'ordre manuel, cover en tête). */
  max: 8,
  /** Hauteur d'une carte (px), avant la mise à l'échelle de l'écran (`ringFit`). */
  cardHeight: 340,
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

/** Perspective des scènes (px), posée par CarouselScene. */
export const RING_PERSPECTIVE = 900;
/** Hauteur à l'écran de l'anneau au repos, à l'échelle 1 : la carte de face, vue à `setBack` derrière l'écran. */
export const RING_REST_HEIGHT = (RING.cardHeight * RING_PERSPECTIVE) / (RING_PERSPECTIVE + RING.setBack);

/** Mise à l'échelle de l'anneau selon l'écran (`--ring-fit`, carousel-motion.ts). */
export const RING_FIT = {
  /** Marge gardée au-dessus et au-dessous de l'anneau, dans sa scène (px). */
  pad: 40,
  /** Plancher : en dessous, l'anneau ne se lit plus ; la scène s'allonge plutôt. */
  min: 0.45,
  /** Largeur d'écran (px) à laquelle l'anneau a sa taille pleine ; en dessous, il rétrécit d'autant. */
  widthRef: 560,
} as const;

/**
 * Échelle de l'anneau dans une scène de hauteur `sceneHeight`, sur un écran large de `viewWidth` :
 * la plus petite des deux contraintes, bornée à [min, 1]. Arrondie au millième (pas de micro-écarts
 * réécrits à chaque redimensionnement).
 */
export function ringFit(sceneHeight: number, viewWidth: number): number {
  const byHeight = (sceneHeight - 2 * RING_FIT.pad) / RING_REST_HEIGHT;
  const byWidth = viewWidth / RING_FIT.widthRef;
  const v = Math.min(1, Math.max(RING_FIT.min, Math.min(byHeight, byWidth)));
  return Math.round(v * 1000) / 1000;
}

/**
 * Première scène : elle remplit l'écran sous l'en-tête (mesure exacte en JS, carousel-motion.ts),
 * jamais moins que l'anneau à son plancher et ses marges. Au-dessus, c'est l'anneau qui rétrécit :
 * la scène ne dépasse plus le bas de l'écran.
 */
export const FIRST_SCENE_MIN = Math.ceil(RING_REST_HEIGHT * RING_FIT.min + 2 * RING_FIT.pad);
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
