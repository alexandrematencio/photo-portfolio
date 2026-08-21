import gsap from 'gsap';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

/**
 * Animations de la branche desktop de /series — vols de « fantômes ».
 *
 * Écart assumé vis-à-vis de la démo Codrops (et du nom `useFolderTimeline`
 * prévu par la spec §4) : la démo anime les éléments RÉELS dans une timeline
 * unique reconstruite au resize. Ici, chaque état (rangée fermée / vue
 * ouverte) est une mise en page CSS ordinaire, et chaque geste anime des
 * CLONES (`position: fixed`) mesurés sur l'état de départ vers des rects
 * mesurés sur l'état d'arrivée, rendu invisible le temps du vol.
 *
 * Pourquoi : la colonne de droite doit défiler nativement à la molette
 * (spec §5) — impossible si ses items sont des éléments transformés d'une
 * timeline pinnée. Et le resize se règle tout seul : les états sont du
 * layout CSS qui refluent, il n'y a plus de timeline à reconstruire en
 * préservant sa progression. Les fantômes ne vivent que le temps d'un
 * geste (≤ 0,8 s) ; un resize pendant ce court vol est accepté.
 *
 * Les recettes visuelles (spec §5, valeurs → brand book une fois calées) :
 * - chemin courbe à deux points avec DÉPASSEMENT avant la pose
 *   (curviness 0.45) — c'est lui qui donne la matière ;
 * - cascade ~20 ms entre vignettes ;
 * - échange de photos : flou et opacité culminent À MI-PARCOURS,
 *   les deux images arrivent nettes.
 */

gsap.registerPlugin(MotionPathPlugin);

export const DUR = {
  open: 0.8,
  close: 0.8,
  switch: 0.6,
  swap: 0.45,
  fade: 0.3,
} as const;

export const EASE = 'expo.inOut';
const STAGGER = 0.02;

// ── Couche de fantômes ───────────────────────────────────────────────────────

export type GhostLayer = {
  el: HTMLDivElement;
  destroy: () => void;
};

export function createGhostLayer(): GhostLayer {
  const el = document.createElement('div');
  el.setAttribute('data-series-ghosts', '');
  el.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:60;overflow:hidden;';
  document.body.appendChild(el);
  return { el, destroy: () => el.remove() };
}

/**
 * Retrait DOUX d'une couche de clones : fondu, puis suppression.
 *
 * Ne JAMAIS remplacer par un `layer.destroy()` sec. Même quand la géométrie
 * d'arrivée est exacte au pixel (cf. `flyCurved`), il reste un écart de
 * CONTENU entre le clone et l'élément réel — le recadrage `object-fit: cover`
 * se recalcule à la taille de boîte, ce qu'un transform ne sait pas reproduire.
 * Une suppression sèche montre donc cet écart d'un coup ; un fondu le dissout.
 *
 * `duration` couvre aussi la `transition-opacity` CSS des vignettes réelles
 * (~150 ms) : les deux se croisent au lieu de se succéder.
 */
export function fadeOutLayer(
  layer: GhostLayer,
  { duration = 0.28, onComplete }: { duration?: number; onComplete?: () => void } = {}
): void {
  gsap.to(layer.el, {
    opacity: 0,
    duration,
    ease: 'power1.out',
    onComplete: () => {
      layer.destroy();
      onComplete?.();
    },
  });
}

/**
 * Clone visuel d'une <img> posé dans la couche, à un rect viewport donné.
 * `currentSrc` (pas `src`) : on clone le fichier réellement affiché.
 */
export function spawnGhost(
  layer: GhostLayer,
  img: HTMLImageElement,
  rect: DOMRect
): HTMLImageElement {
  const ghost = document.createElement('img');
  ghost.src = img.currentSrc || img.src;
  ghost.alt = '';
  ghost.style.cssText = `position:absolute;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;object-fit:cover;will-change:transform;`;
  layer.el.appendChild(ghost);
  return ghost;
}

// ── Vols ─────────────────────────────────────────────────────────────────────

export type Flight = {
  ghost: HTMLImageElement;
  from: DOMRect;
  to: DOMRect;
};

/**
 * Vol le long du chemin de la démo de référence : le point intermédiaire est
 * à `midX` du trajet horizontal mais seulement `midY` du vertical. Avec les
 * défauts (0.95 / 0.095, les valeurs EXACTES de la démo Codrops), l'élément
 * GLISSE d'abord le long de l'horizon puis REMONTE se poser — ce n'est pas
 * une diagonale. La fermeture passe les fractions inverses (peu de X,
 * beaucoup de Y au point intermédiaire) pour parcourir le même chemin en
 * miroir. L'échelle voyage DANS les points du chemin, comme la démo.
 *
 * ⚠️ **L'échelle est NON UNIFORME (`scaleX`/`scaleY`), jamais `scale`.**
 * Source et destination n'ont pas le même rapport de forme : les boîtes de la
 * pile font toutes 299×176 (la cover, `object-fit: cover`) alors que chaque
 * vignette de colonne porte le ratio de SA photo. Un scale uniforme fait donc
 * atterrir la bonne largeur avec la hauteur du ratio de la pile — mesuré : 12 px
 * de trop sur l'une, 10 px de moins sur les autres, d'où des vignettes tantôt
 * collées tantôt espacées à l'arrivée, puis un saut sec au retrait des clones.
 * Bug réel signalé. Avec `transformOrigin: 'top left'` + scale par axe, la
 * boîte d'arrivée est exacte au pixel.
 *
 * Contrepartie assumée : le rapport de forme de l'image se déforme PENDANT le
 * vol (le recadrage `cover` ne peut pas être recalculé par un transform). Les
 * images concernées partent cachées sous la cover, ce qu'on voit est donc un
 * morphing depuis derrière la cover — et le résidu de recadrage à l'arrivée est
 * absorbé par le fondu croisé de `fadeOutLayer`, jamais par une coupe franche.
 */
export function flyCurved(
  tl: gsap.core.Timeline,
  flights: Flight[],
  {
    duration = DUR.open,
    stagger = STAGGER,
    midX = 0.95,
    midY = 0.095,
    at = 0,
  }: {
    duration?: number;
    stagger?: number;
    midX?: number;
    midY?: number;
    at?: number | string;
  } = {}
): void {
  flights.forEach(({ ghost, from, to }, i) => {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    tl.to(
      ghost,
      {
        duration,
        ease: EASE,
        transformOrigin: 'top left',
        motionPath: {
          path: [
            // Même dosage que la démo au point intermédiaire : un quart de la
            // croissance seulement, sur CHAQUE axe — l'élément grossit tard,
            // ce qui donne sa nervosité au geste.
            {
              x: dx * midX,
              y: dy * midY,
              scaleX: 1 + (sx - 1) * 0.25,
              scaleY: 1 + (sy - 1) * 0.25,
            },
            { x: dx, y: dy, scaleX: sx, scaleY: sy },
          ],
          curviness: 0.45,
        },
      },
      typeof at === 'number' ? at + i * stagger : at
    );
  });
}

let mbFilterSeq = 0;

/**
 * MOTION BLUR directionnel (pas un flou gaussien uniforme — première
 * tentative retoquée à juste titre) :
 *
 *   1. le clone <img> est emballé dans un wrapper tourné de l'angle de la
 *      trajectoire, l'image contre-tournée à l'intérieur reste droite ;
 *   2. un filtre SVG `feGaussianBlur stdDeviation="N 0"` (un seul axe) est
 *      posé sur le wrapper. Un filter CSS s'applique AVANT le transform de
 *      l'élément : le flou horizontal-local est donc tourné avec la boîte
 *      → à l'écran, il s'étire exactement le long du déplacement.
 *
 * La déviation est animée 0 → max → 0 (pic à mi-course, là où l'œil lit la
 * vitesse), l'image arrive nette.
 */
function wrapForMotionBlur(
  ghost: HTMLImageElement,
  angleDeg: number
): { wrapper: HTMLDivElement; fe: SVGFEGaussianBlurElement } {
  const parent = ghost.parentElement as HTMLElement;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = ghost.style.cssText;
  parent.appendChild(wrapper);
  ghost.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
  wrapper.appendChild(ghost);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  const filter = document.createElementNS(ns, 'filter');
  const id = `series-mb-${++mbFilterSeq}`;
  filter.setAttribute('id', id);
  // Région élargie : sans elle le flou serait rogné aux bords de la boîte.
  filter.setAttribute('x', '-30%');
  filter.setAttribute('y', '-30%');
  filter.setAttribute('width', '160%');
  filter.setAttribute('height', '160%');
  const fe = document.createElementNS(ns, 'feGaussianBlur');
  fe.setAttribute('in', 'SourceGraphic');
  fe.setAttribute('stdDeviation', '0 0');
  filter.appendChild(fe);
  svg.appendChild(filter);
  parent.appendChild(svg);

  wrapper.style.filter = `url(#${id})`;
  gsap.set(wrapper, { rotate: angleDeg });
  gsap.set(ghost, { rotate: -angleDeg });
  return { wrapper, fe };
}

/**
 * Échange de photos (spec §5) : deux vols droits et croisés, motion blur
 * directionnel et opacité légèrement creusée au sommet à mi-parcours,
 * arrivée nette. ≤ 0,5 s. Le blur reste le premier candidat au sacrifice
 * si les fps plongent (§7).
 */
export function flyCrossing(
  tl: gsap.core.Timeline,
  flights: Flight[],
  { duration = DUR.swap }: { duration?: number } = {}
): void {
  const half = duration / 2;
  for (const { ghost, from, to } of flights) {
    // Scale par axe, même raison que dans `flyCurved` : ici source et cible
    // partagent en principe le ratio de la photo, mais l'écrire par axe rend
    // l'atterrissage exact quoi qu'il arrive (rect prédit arrondi, image au
    // ratio inattendu) plutôt que « exact tant que l'hypothèse tient ».
    const sx = to.width / from.width;
    const sy = to.height / from.height;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const { wrapper, fe } = wrapForMotionBlur(ghost, angle);

    // Tout en origine CENTRE : la rotation est posée avant le vol, une
    // origine différente entre set et to ferait sauter la boîte. On anime
    // donc le déplacement des centres, et le scale centré ne déplace rien.
    tl.to(
      wrapper,
      {
        duration,
        ease: 'power2.inOut',
        transformOrigin: '50% 50%',
        x: dx,
        y: dy,
        scaleX: sx,
        scaleY: sy,
      },
      0
    );
    tl.to(fe, { attr: { stdDeviation: '14 0' }, duration: half, ease: 'power1.in' }, 0)
      .to(fe, { attr: { stdDeviation: '0 0' }, duration: half, ease: 'power1.out' }, half);
    tl.to(wrapper, { opacity: 0.85, duration: half, ease: 'power1.in' }, 0).to(
      wrapper,
      { opacity: 1, duration: half, ease: 'power1.out' },
      half
    );
  }
}

/** Sortie latérale droite (changement de série, spec §5). */
export function flyOutRight(
  tl: gsap.core.Timeline,
  ghosts: HTMLImageElement[],
  { duration = DUR.switch * 0.75, at = 0 }: { duration?: number; at?: number } = {}
): void {
  tl.to(
    ghosts,
    {
      duration,
      ease: 'power2.in',
      x: '+=320',
      opacity: 0,
      stagger: 0.015,
    },
    at
  );
}

// ── Aides de mesure ──────────────────────────────────────────────────────────

/** Rect viewport, ou null si l'élément est absent/sans surface. */
export function rectOf(el: Element | null): DOMRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? r : null;
}

/** Un rect cible hors écran ne mérite pas de fantôme (spec : colonne longue). */
export function isOnScreen(r: DOMRect): boolean {
  return r.bottom > 0 && r.top < window.innerHeight;
}

/** Précharge une image ; résout aussi en cas d'échec (on ne bloque jamais). */
export function preload(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
    if (img.complete) resolve();
  });
}

/**
 * Préchargement PLAFONNÉ : attend l'image au plus `ms` millisecondes puis
 * lance quoi qu'il arrive. Le geste ne doit jamais rester suspendu à un
 * réseau lent — on préfère une image qui se précise en vol.
 */
export function preloadCapped(src: string, ms = 350): Promise<void> {
  return Promise.race([
    preload(src),
    new Promise<void>((r) => setTimeout(r, ms)),
  ]);
}

/**
 * Résout quand les images données sont DÉCODÉES et qu'une frame a été
 * peinte (double rAF). C'est la garde anti-flash du raccord clone → réel :
 * changer la src d'une <img> laisse l'ANCIENNE image affichée jusqu'au
 * décodage de la nouvelle — retirer le clone avant, c'est dévoiler
 * l'ancienne photo un instant (bug réel signalé). Le timeout borne
 * l'attente : au pire le clone (basse déf, stable) reste un peu plus
 * longtemps, jamais de flash.
 */
export function whenSettled(
  imgs: (HTMLImageElement | null)[],
  timeoutMs = 2500
): Promise<void> {
  const list = imgs.filter((i): i is HTMLImageElement => Boolean(i));
  const decodes = Promise.all(list.map((img) => img.decode().catch(() => undefined)));
  const timeout = new Promise<void>((r) => setTimeout(r, timeoutMs));
  return Promise.race([decodes.then(() => undefined), timeout]).then(
    () =>
      new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      )
  );
}
