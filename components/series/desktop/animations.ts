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
 * Recette visuelle : COPIE STRICTE de la démo 4 Codrops (`script4.js` de
 * https://github.com/Ibaliqbal/codrops-motion-path-transition, boutons
 * « bottom »/« left ») — voir `flyCurved`. La recette précédente (chemin en
 * fractions, motion blur directionnel) est MISE DE CÔTÉ, intacte, dans la
 * section « Recette précédente » en bas de fichier.
 */

gsap.registerPlugin(MotionPathPlugin);

export const DUR = {
  // La démo est à 1.1 s ; 0.9 s décidé avec Alexandre (2026-08-21), tout le
  // reste de la recette est repris tel quel.
  open: 0.9,
  close: 0.9,
  switch: 0.6,
  swap: 0.45,
  fade: 0.3,
} as const;

export const EASE = 'expo.inOut';
export const STAGGER = 0.035;

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
 * Délai entre le reveal du réel et le début du fondu des clones : la
 * `transition-opacity` CSS des vignettes réelles (~150 ms) doit être FINIE
 * avant qu'un clone ne perde son opacité. Tant que le clone est opaque et le
 * réel monte en dessous, la couverture reste à 100 % ; deux fondus
 * simultanés, eux, creusaient la couverture combinée à ~85 % au croisement
 * → ~15 % de fond clair à travers toute la colonne pendant ~120 ms (mesuré),
 * le « blink » signalé. 0,22 s = 150 ms de transition + marge.
 */
export const HANDOFF_DELAY = 0.22;

/**
 * Retrait DOUX d'une couche de clones : fondu, puis suppression.
 *
 * Ne JAMAIS remplacer par un `layer.destroy()` sec : même avec un raccord
 * exact au pixel ET au contenu (vol de boîte, cf. `flyCurved`), il reste des
 * écarts résiduels possibles (fichier/résolution de l'image réelle ≠ clone,
 * arrondi de rect) — le fondu les dissout, une coupe les montre.
 *
 * Après un reveal d'éléments portant une `transition-opacity` CSS, passer
 * `delay: HANDOFF_DELAY` : les clones restent INTACTS le temps que le réel
 * finisse de monter en dessous, PUIS fondent — jamais les deux à la fois.
 */
export function fadeOutLayer(
  layer: GhostLayer,
  {
    duration = 0.28,
    delay = 0,
    onComplete,
  }: { duration?: number; delay?: number; onComplete?: () => void } = {}
): void {
  gsap.to(layer.el, {
    opacity: 0,
    duration,
    delay,
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
 * Vol « démo 4 » — COPIE STRICTE de `script4.js` de la démo Codrops
 * (https://tympanus.net/Tutorials/MotionPathTransition/index4.html, boutons
 * « bottom »/« left »), transposée à nos clones :
 *
 * - `ease: 'expo.inOut'` sur toute la trajectoire — l'accélération franche au
 *   départ et la longue décélération à la pose viennent de LÀ, pas du chemin ;
 * - MotionPath à DEUX points, `curviness: 0.25` (quasi droit, coin arrondi).
 *   Au point intermédiaire (sens « open ») : la quasi-totalité du trajet
 *   horizontal est faite (il ne reste que 2,5 px — `targetX * 1.5` de la
 *   démo) mais seulement 25 px du vertical (`top ± 25`) → l'élément GLISSE le
 *   long de l'horizon puis REMONTE se poser ;
 * - l'échelle est aux TROIS QUARTS de sa course au point intermédiaire
 *   (`(1 - scale) * 0.25 + scale` dans la démo) : elle se joue pendant la
 *   glissade, pas pendant la montée ;
 * - cascade `STAGGER` (0.035 s) depuis le premier vol.
 *
 * Seul point NON transposé : le cas spécial « index 0 en ligne droite » de la
 * démo. Chez elle, le premier item ne bouge quasiment que sur un axe (la
 * droite EST le rail) — c'est une optimisation de chemin dégénéré. Chez nous,
 * chaque vol traverse l'écran sur les deux axes : une ligne droite ferait une
 * DIAGONALE en plein milieu de la scène, effet que la démo ne montre jamais.
 * Tous les vols sont donc courbes.
 *
 * `direction: 'close'` = le `tl.reverse()` de la démo, reconstruit : même
 * courbe parcourue en sens inverse (le vertical d'abord, la glissade ensuite,
 * l'échelle au dernier quart), et CASCADE INVERSÉE — le dernier vol de
 * l'ouverture part le premier, l'index 0 atterrit en dernier.
 *
 * ⚠️ **VOL DE BOÎTE (`width`/`height` animés), jamais un étirement en
 * transform** — seul écart d'implémentation avec la démo, dont les vignettes
 * gardent toutes le même ratio (scale uniforme possible chez elle). Source et
 * destination n'ont pas le même rapport de forme ici : les boîtes de la pile
 * font toutes 299×176 (la cover, `object-fit: cover`) alors que chaque
 * vignette de colonne porte le ratio de SA photo. Deux tentatives payées :
 * un `scale` uniforme atterrit à la MAUVAISE hauteur (±10-12 px, vignettes
 * tantôt collées tantôt espacées) ; un `scaleX`/`scaleY` par axe atterrit
 * exact au pixel mais DÉFORME le contenu (le recadrage `cover` ne se
 * recalcule pas sous un transform — 13 à 19 % d'étirement vertical mesurés à
 * la pose), et le raccord clone → réel « redressait » l'image d'un coup :
 * le blink de fin d'ouverture signalé. En animant la boîte elle-même,
 * `object-fit: cover` recadre à CHAQUE frame : le clone atterrit identique
 * au réel, au pixel ET au contenu. Coût : un layout par frame sur ~10 clones
 * `absolute` dans une couche `fixed` hors flux — mesuré sans jank.
 */
export function flyCurved(
  tl: gsap.core.Timeline,
  flights: Flight[],
  {
    duration = DUR.open,
    stagger = STAGGER,
    direction = 'open',
    at = 0,
  }: {
    duration?: number;
    stagger?: number;
    direction?: 'open' | 'close';
    at?: number;
  } = {}
): void {
  const n = flights.length;
  flights.forEach(({ ghost, from, to }, i) => {
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const dw = to.width - from.width;
    const dh = to.height - from.height;

    // Offsets ABSOLUS de la démo (pas des fractions) : 2,5 px restants sur
    // l'axe de la glissade, 25 px parcourus sur l'autre. Bornés au trajet
    // réel pour les déplacements plus courts que l'offset.
    const nudgeX = Math.sign(dx) * Math.min(2.5, Math.abs(dx));
    const nudgeY = Math.sign(dy) * Math.min(25, Math.abs(dy));

    const mid =
      direction === 'open'
        ? {
            x: dx - nudgeX,
            y: nudgeY,
            width: from.width + dw * 0.75,
            height: from.height + dh * 0.75,
          }
        : {
            x: nudgeX,
            y: dy - nudgeY,
            width: from.width + dw * 0.25,
            height: from.height + dh * 0.25,
          };
    const end = { x: dx, y: dy, width: to.width, height: to.height };

    tl.to(
      ghost,
      {
        duration,
        ease: EASE,
        motionPath: {
          path: [mid, end],
          curviness: 0.25,
        },
      },
      at + (direction === 'open' ? i : n - 1 - i) * stagger
    );
  });
}

/**
 * Échange de photos (clic sur une vignette de colonne) : deux vols droits et
 * croisés, SANS motion blur (retiré le 2026-08-21 — la version avec blur est
 * mise de côté en bas de fichier, `flyCrossingLegacy`), sur la même courbe
 * `expo.inOut` que la démo 4 — signature de mouvement unique sur la page.
 */
export function flyCrossing(
  tl: gsap.core.Timeline,
  flights: Flight[],
  { duration = DUR.swap }: { duration?: number } = {}
): void {
  for (const { ghost, from, to } of flights) {
    // Scale par axe, même raison que dans `flyCurved` : ici source et cible
    // partagent en principe le ratio de la photo, mais l'écrire par axe rend
    // l'atterrissage exact quoi qu'il arrive (rect prédit arrondi, image au
    // ratio inattendu) plutôt que « exact tant que l'hypothèse tient ».
    tl.to(
      ghost,
      {
        duration,
        ease: EASE,
        transformOrigin: 'top left',
        x: to.left - from.left,
        y: to.top - from.top,
        scaleX: to.width / from.width,
        scaleY: to.height / from.height,
      },
      0
    );
  }
}

// ── Recette précédente, MISE DE CÔTÉ (2026-08-21) ────────────────────────────
//
// Conservée intacte, prête à être rebranchée : dans DesktopSeries, remplacer
// l'appel à `flyCurved` / `flyCrossing` par `flyCurvedLegacy` /
// `flyCrossingLegacy` (l'API de flyCurvedLegacy prend `midX`/`midY` en
// fractions — 0.05/0.905 pour la fermeture — au lieu de `direction`).
// Rien d'autre à toucher.

/**
 * [LEGACY] Chemin en FRACTIONS du trajet (midX 0.95 / midY 0.095), curviness
 * 0.45, échelle au quart au point intermédiaire, pas de cas spécial pour le
 * premier vol, cascade dans le même sens à la fermeture. Remplacée par la
 * copie stricte de la démo 4 (`flyCurved` ci-dessus).
 */
export function flyCurvedLegacy(
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
 * [LEGACY] MOTION BLUR directionnel (pas un flou gaussien uniforme — première
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
 * [LEGACY] Échange de photos avec motion blur directionnel et opacité
 * légèrement creusée au sommet à mi-parcours, arrivée nette. Remplacée par
 * `flyCrossing` (sans blur, courbe démo 4).
 */
export function flyCrossingLegacy(
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
