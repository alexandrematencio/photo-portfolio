'use client';

import { useEffect } from 'react';

/**
 * Coupe le « retour à la page précédente » au glissé horizontal à deux doigts
 * sur un pavé tactile (macOS et équivalents) : un geste accidentel sur la
 * Concept Map ou une page longue renvoyait le lecteur à la page d'avant.
 *
 * Deux moitiés, parce que les navigateurs ne décident pas au même endroit :
 * - Chrome, Edge et Firefox lisent `overscroll-behavior-x: none` sur la racine
 *   (globals.css) — le geste ne déborde plus vers l'historique ;
 * - Safari l'ignore pour l'historique, mais ne lance le glissé que si la page
 *   n'a pas consommé la molette : on annule donc un défilement HORIZONTAL que
 *   rien sous le pointeur ne peut absorber.
 *
 * Une bande qui défile en largeur (séries, galeries) garde son geste tant
 * qu'elle a de la place dans ce sens ; à son bord, on annule aussi.
 */
export function SwipeBackGuard() {
  useEffect(() => {
    const canScroll = (from: EventTarget | null, dx: number) => {
      for (let el = from instanceof Element ? from : null; el && el !== document.documentElement; el = el.parentElement) {
        if (el.scrollWidth <= el.clientWidth) continue;
        const { overflowX } = getComputedStyle(el);
        if (overflowX !== 'auto' && overflowX !== 'scroll') continue;
        if (dx < 0 ? el.scrollLeft > 0 : el.scrollLeft < el.scrollWidth - el.clientWidth - 1) return true;
      }
      return false;
    };

    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented || e.ctrlKey || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      if (!canScroll(e.target, e.deltaX)) e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  return null;
}
