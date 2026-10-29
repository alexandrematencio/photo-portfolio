'use client';

import { useEffect } from 'react';

/**
 * L'ARRIVÉE SUR UN PASSAGE (2026-10-29, phase 1 de la Concept Map). Un lien
 * `…/<article>/#p-<clé>` amène le lecteur sur un paragraphe précis ; un
 * filet orange se trace dans la marge gauche, le long du paragraphe, tient
 * le temps qu'on le repère, puis s'efface. L'orange est celui du `StateDot` :
 * « vous êtes ici ».
 *
 * Pourquoi pas `:target` seul : la navigation client de Next passe par
 * `pushState`, qui ne met pas `:target` à jour. On pose donc `data-arrived`
 * nous-mêmes, au montage (lien ouvert depuis l'extérieur, rechargement) et à
 * chaque `hashchange` (lien interne à la page). Le tracé et l'effacement sont
 * en CSS (`.journal-passage` dans globals.css) ; mouvement réduit : le filet
 * apparaît et disparaît sans transition.
 */

/** Durée pendant laquelle le filet reste tracé, effacement non compris. */
const HOLD_MS = 2400;

export function PassageArrival() {
  useEffect(() => {
    let timer: number | undefined;
    let current: HTMLElement | null = null;

    const clear = () => {
      window.clearTimeout(timer);
      if (current) delete current.dataset.arrived;
      current = null;
    };

    const arrive = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (!hash.startsWith('p-')) return;
      const el = document.getElementById(hash);
      if (!el) return;
      clear();
      current = el;
      // Une frame d'écart : l'état « non tracé » doit être peint avant que la
      // transition parte, sinon un second clic sur le même lien ne rejoue rien.
      requestAnimationFrame(() => {
        el.dataset.arrived = '';
        timer = window.setTimeout(clear, HOLD_MS);
      });
    };

    arrive();
    window.addEventListener('hashchange', arrive);
    return () => {
      window.removeEventListener('hashchange', arrive);
      clear();
    };
  }, []);

  return null;
}
