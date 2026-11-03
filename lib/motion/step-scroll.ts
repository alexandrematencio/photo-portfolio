/**
 * Défilement « un geste, une photo », d'après vincentvanduysen.com (relevé le
 * 2026-11-03 : fullPage.js v2, `scrollingSpeed: 1000`, transition CSS `ease`,
 * tout geste ignoré pendant le glissement).
 *
 * Différence assumée avec le modèle : fullPage confisque TOUTE la page, ici
 * seule la ZONE des arrêts est pas-à-pas. Un arrêt à moins d'un écran dans le
 * sens du geste → on y va ; aucun → défilement libre (Lenis). On entre donc
 * dans la galerie par le premier geste qui la touche, et on en sort au-dessus
 * de la première photo ou sous la dernière. Le hero et son scroll-morph
 * (scrubbé contre `window.scrollY`) ne sont jamais concernés.
 *
 * Les arrêts sont MESURÉS à chaque geste (rect + scrollY), jamais mis en
 * cache : le hero pinné et les images qui chargent déplacent le layout.
 *
 * Sans dépendance au projet : il ne connaît que Lenis et une fonction qui
 * rend les éléments à centrer.
 */
import type Lenis from 'lenis';

type Options = {
  lenis: Lenis;
  /** Les éléments sur lesquels s'arrêter, dans l'ordre du document. */
  getTargets: () => HTMLElement[];
  /** Durée d'un pas, en secondes. fullPage : 1000 ms. */
  duration?: number;
  /** Vrai quand la page est verrouillée (splash, lightbox) : on ne fait rien. */
  isLocked?: () => boolean;
};

/** `cubic-bezier(0.25, 0.1, 0.25, 1)` — le `ease` CSS que sert fullPage. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  const dbx = (t: number) =>
    3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = dbx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (bx(t) - x) / d;
    }
    return by(Math.min(1, Math.max(0, t)));
  };
}
export const CSS_EASE = cubicBezier(0.25, 0.1, 0.25, 1);

/** Écart sous lequel on considère qu'on est déjà sur un arrêt. */
const EPS = 2;
/** Seuil de glissé au doigt, en part de la hauteur d'écran (fullPage : 5 %). */
const TOUCH_SENSITIVITY = 0.05;

export function bindStepScroll({ lenis, getTargets, duration = 1, isLocked }: Options) {
  let animating = false;
  /** Le geste en cours a déjà servi : on avale sa traîne (inertie). */
  let consumed = false;

  const stops = () => {
    const vh = window.innerHeight;
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - vh;
    return getTargets()
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        // Centré ; plus haut que l'écran → calé en haut.
        const offset = r.height < vh ? (vh - r.height) / 2 : 0;
        return Math.min(max, Math.max(0, Math.round(r.top + y - offset)));
      });
  };

  /** L'arrêt suivant dans le sens `dir`, s'il est à moins d'un écran. */
  const nextStop = (dir: 1 | -1): number | null => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const list = stops();
    if (dir > 0) {
      const s = list.find((p) => p > y + EPS);
      return s !== undefined && s - y <= vh ? s : null;
    }
    const s = [...list].reverse().find((p) => p < y - EPS);
    return s !== undefined && y - s <= vh ? s : null;
  };

  const go = (target: number) => {
    animating = true;
    consumed = true;
    lenis.scrollTo(target, {
      duration,
      easing: CSS_EASE,
      lock: true,
      force: true,
      onComplete: () => {
        animating = false;
      },
    });
  };

  // ── Molette ────────────────────────────────────────────────────────────
  // Détection d'un NOUVEAU geste, reprise de fullPage : on garde les deltas
  // récents ; un trou de plus de 200 ms ouvre un geste neuf, et sinon on n'en
  // reconnaît un que si la molette ACCÉLÈRE (moyenne des 10 derniers ≥ moyenne
  // des 70 derniers). La traîne d'inertie d'un trackpad, elle, décélère : sans
  // ce tri, un seul coup de pouce ferait sauter deux ou trois photos.
  let history: number[] = [];
  let lastWheel = 0;
  const avg = (n: number) => {
    const part = history.slice(Math.max(history.length - n, 0));
    return part.reduce((a, b) => a + b, 0) / Math.max(1, part.length);
  };

  const onWheel = (e: WheelEvent) => {
    // Page verrouillée (lightbox, splash) : `overflow: hidden` coupe le
    // défilement natif, PAS Lenis, qui faisait glisser la page derrière la
    // lightbox (348 px pour trois crans, mesuré sur `main` le 2026-11-03).
    // On lui retire l'évènement, sans `preventDefault` : un défilement
    // interne à la lightbox reste natif.
    if (isLocked?.()) {
      e.stopPropagation();
      return;
    }
    if (e.ctrlKey) return; // pincement de zoom
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    const now = performance.now();
    if (now - lastWheel > 200) {
      history = [];
      consumed = false;
    }
    lastWheel = now;
    history.push(Math.abs(e.deltaY));
    if (history.length > 150) history.shift();
    const accelerating = avg(10) >= avg(70);
    if (accelerating && !animating) consumed = false;

    const swallow = () => {
      e.preventDefault();
      e.stopPropagation(); // Lenis écoute en phase bulle : il ne voit rien
    };

    if (animating || consumed) return swallow();

    const target = nextStop(e.deltaY > 0 ? 1 : -1);
    if (target === null) return; // hors zone : défilement libre
    swallow();
    go(target);
  };

  // ── Doigt ──────────────────────────────────────────────────────────────
  let touchY: number | null = null;
  let touchDone = false;
  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches.length === 1 ? e.touches[0].clientY : null;
    touchDone = false;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (touchY === null || isLocked?.()) return;
    if (animating || touchDone) {
      if (e.cancelable) e.preventDefault();
      return;
    }
    const dy = touchY - e.touches[0].clientY;
    if (Math.abs(dy) < 4) return;
    const target = nextStop(dy > 0 ? 1 : -1);
    if (target === null) return; // hors zone : défilement natif
    if (e.cancelable) e.preventDefault();
    if (Math.abs(dy) >= window.innerHeight * TOUCH_SENSITIVITY) {
      touchDone = true;
      go(target);
    }
  };
  const onTouchEnd = () => {
    touchY = null;
  };

  // ── Clavier ────────────────────────────────────────────────────────────
  // fullPage coupe le clavier sur le site de référence ; ici non (WCAG) : les
  // touches de page avancent d'une photo, comme la molette.
  const onKey = (e: KeyboardEvent) => {
    if (isLocked?.() || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
    let dir: 1 | -1 | 0 = 0;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
    if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
    if (!dir) return;
    if (animating) {
      e.preventDefault();
      return;
    }
    const target = nextStop(dir);
    if (target === null) return;
    e.preventDefault();
    go(target);
  };

  const capture: AddEventListenerOptions = { capture: true, passive: false };
  window.addEventListener('wheel', onWheel, capture);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, capture);
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('keydown', onKey);

  return () => {
    window.removeEventListener('wheel', onWheel, capture);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove, capture);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('keydown', onKey);
  };
}
