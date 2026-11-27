/**
 * Défilement « une scène par geste » de /work : molette, doigt, ↑ / ↓, et clic dans le menu de gauche.
 *
 * Même principe que la galerie de l'accueil (`lib/motion/step-scroll.ts`, d'après fullPage.js) : un geste
 * franc va à l'ancre suivante en 1 s, `ease` CSS, tout geste est ignoré pendant le glissement et la traîne
 * d'inertie d'un trackpad est avalée. Deux écarts, et leurs raisons :
 * - Le défilement de /work se passe dans `[data-scroll-container]`, pas sur `window`, et il n'y a pas de
 *   Lenis : on tweene `scrollTop` avec GSAP (comme le fait déjà l'ouverture d'un album).
 * - Hors zone, le défilement reste libre : sous la dernière scène on rejoint le footer à la molette, et on
 *   en revient d'un geste vers le haut.
 *
 * Les ancres sont MESURÉES à chaque geste, jamais mises en cache : la première scène se redimensionne.
 * La logique de geste (molette qui accélère, seuil du doigt) est la même que dans `step-scroll.ts` ; elle
 * est dupliquée parce que celle-ci est liée à Lenis et à `window`. Si l'une change, changer l'autre.
 */
import gsap from 'gsap';
import { CSS_EASE } from '@/lib/motion/step-scroll';

/** Scroll qui centre la scène dans le conteneur, borné. */
export function centerOf(scene: HTMLElement, scroller: HTMLElement): number {
  const y = scene.offsetTop + scene.offsetHeight / 2 - scroller.clientHeight / 2;
  return Math.min(Math.max(0, y), scroller.scrollHeight - scroller.clientHeight);
}

type Options = {
  scroller: HTMLElement;
  scenes: HTMLElement[];
  /** Vrai quand l'album est ouvert ou en vol : la page ne défile plus. */
  isLocked: () => boolean;
  reduced: boolean;
};

export type SceneStep = {
  /** Va à la scène `i` (clic dans le menu). */
  goTo(i: number): void;
  /** La scène la plus proche du repos, ou la cible du pas en cours. */
  active(): number;
  /** Notifié à chaque changement de scène active. Rend le désabonnement. */
  onActive(cb: (i: number) => void): () => void;
  destroy(): void;
};

/** Durée d'un pas (fullPage : 1000 ms), allongée un peu pour un saut de plusieurs scènes. */
const STEP_SECONDS = 1;
const EXTRA_PER_SCENE = 0.15;
const MAX_SECONDS = 1.8;
/** Écart sous lequel on est déjà sur une ancre. */
const EPS = 2;
/** Seuil de glissé au doigt, en part de la hauteur visible (fullPage : 5 %). */
const TOUCH_SENSITIVITY = 0.05;

export function bindSceneStep({ scroller, scenes, isLocked, reduced }: Options): SceneStep {
  let animating = false;
  /** Le geste en cours a déjà servi : on avale sa traîne. */
  let consumed = false;
  /** Scène visée pendant un pas ; `null` au repos. */
  let target: number | null = null;
  let current = 0;
  const listeners = new Set<(i: number) => void>();

  /** Première scène = haut de page (anneau de face, titre de la page visible) ; les autres, centrées. */
  const stops = () => scenes.map((s, i) => (i === 0 ? 0 : centerOf(s, scroller)));

  const nearest = (list: number[]) => {
    const y = scroller.scrollTop;
    let best = 0;
    list.forEach((p, i) => {
      if (Math.abs(p - y) < Math.abs(list[best] - y)) best = i;
    });
    return best;
  };

  const setCurrent = (i: number) => {
    if (i === current) return;
    current = i;
    listeners.forEach((cb) => cb(i));
  };

  // Scène active = la plus proche, sauf pendant un pas (la cible s'allume tout de suite).
  let raf = 0;
  const onScroll = () => {
    if (raf || target !== null) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (target === null) setCurrent(nearest(stops()));
    });
  };
  scroller.addEventListener('scroll', onScroll, { passive: true });

  /** L'ancre suivante dans le sens `dir`, si elle est à moins d'un écran et demi. */
  const nextIndex = (dir: 1 | -1): number | null => {
    const y = scroller.scrollTop;
    const reach = scroller.clientHeight * 1.5;
    const list = stops();
    if (dir > 0) {
      const i = list.findIndex((p) => p > y + EPS);
      return i >= 0 && list[i] - y <= reach ? i : null;
    }
    let i = -1;
    list.forEach((p, k) => {
      if (p < y - EPS) i = k;
    });
    return i >= 0 && y - list[i] <= reach ? i : null;
  };

  const go = (i: number) => {
    const to = stops()[i];
    if (to === undefined) return;
    target = i;
    setCurrent(i);
    consumed = true;
    const steps = Math.abs(i - nearest(stops()));
    const done = () => {
      animating = false;
      target = null;
    };
    if (reduced) {
      scroller.scrollTop = to;
      done();
      return;
    }
    animating = true;
    gsap.to(scroller, {
      scrollTop: to,
      duration: Math.min(MAX_SECONDS, STEP_SECONDS + Math.max(0, steps - 1) * EXTRA_PER_SCENE),
      ease: CSS_EASE,
      overwrite: true,
      onComplete: done,
      onInterrupt: done,
    });
  };

  // ── Molette ──────────────────────────────────────────────────────────────
  // Un trou de plus de 200 ms ouvre un geste neuf ; sinon on n'en reconnaît un que si la molette
  // ACCÉLÈRE. La traîne d'un trackpad décélère : sans ce tri, un coup de pouce sauterait trois scènes.
  let history: number[] = [];
  let lastWheel = 0;
  const avg = (n: number) => {
    const part = history.slice(Math.max(history.length - n, 0));
    return part.reduce((a, b) => a + b, 0) / Math.max(1, part.length);
  };
  const onWheel = (e: WheelEvent) => {
    if (isLocked() || e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const now = performance.now();
    if (now - lastWheel > 200) {
      history = [];
      consumed = false;
    }
    lastWheel = now;
    history.push(Math.abs(e.deltaY));
    if (history.length > 150) history.shift();
    if (avg(10) >= avg(70) && !animating) consumed = false;
    if (animating || consumed) {
      e.preventDefault();
      return;
    }
    const i = nextIndex(e.deltaY > 0 ? 1 : -1);
    if (i === null) return; // hors zone : défilement libre
    e.preventDefault();
    go(i);
  };

  // ── Doigt ────────────────────────────────────────────────────────────────
  let touchY: number | null = null;
  let touchDone = false;
  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
    touchDone = false;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (touchY === null || isLocked()) return;
    if (animating || touchDone) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    const dy = touchY - e.touches[0].clientY;
    if (Math.abs(dy) < 4) return;
    const i = nextIndex(dy > 0 ? 1 : -1);
    if (i === null) return;
    if (e.cancelable) e.preventDefault();
    if (Math.abs(dy) >= scroller.clientHeight * TOUCH_SENSITIVITY) {
      touchDone = true;
      go(i);
    }
  };
  const onTouchEnd = () => {
    touchY = null;
  };

  // ── Clavier : ↓ / PageDown / Espace = scène suivante, ↑ / PageUp / Maj+Espace = précédente ──
  // (← / → tournent l'anneau, `carousel-motion.ts`.)
  const onKey = (e: KeyboardEvent) => {
    if (isLocked() || e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return;
    let dir: 1 | -1 | 0 = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
    if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
    if (!dir) return;
    // Espace sur un bouton (le menu) l'active : on ne le détourne pas.
    if (e.key === ' ' && (e.target as HTMLElement | null)?.closest('button, a, [role="button"]')) return;
    if (animating) {
      e.preventDefault();
      return;
    }
    const i = nextIndex(dir);
    if (i === null) return;
    e.preventDefault();
    go(i);
  };

  const capture: AddEventListenerOptions = { capture: true, passive: false };
  scroller.addEventListener('wheel', onWheel, capture);
  scroller.addEventListener('touchstart', onTouchStart, { passive: true });
  scroller.addEventListener('touchmove', onTouchMove, capture);
  scroller.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKey);

  current = nearest(stops());

  return {
    goTo(i) {
      if (isLocked() || animating) return;
      go(i);
    },
    active: () => target ?? current,
    onActive(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    destroy() {
      gsap.killTweensOf(scroller);
      cancelAnimationFrame(raf);
      scroller.removeEventListener('scroll', onScroll);
      scroller.removeEventListener('wheel', onWheel, capture);
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove, capture);
      scroller.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
      listeners.clear();
    },
  };
}
