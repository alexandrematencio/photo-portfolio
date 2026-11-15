'use client';

import { useEffect } from 'react';
import { langOfPath } from '@/lib/journal/i18n';
import { takeSwitch } from '@/lib/journal/langSwitch';

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
 *
 * Arrivée par un changement de langue (2026-11-16) : le lecteur n'était pas
 * forcément au début du paragraphe. `LanguageSwitch` a retenu la fraction
 * qu'il en avait lue ; on pose ici le même point du paragraphe en haut de
 * l'écran, au lieu de son premier mot. Une molette, un doigt ou une touche
 * avant que la page ait fini de se poser annulent la correction : le lecteur
 * reprend la main.
 */

/** La marge d'ancre des passages (`.journal-passage`, globals.css) ; celle de `LanguageSwitch`. */
const PASSAGE_TOP = 32;

/** Pose le point `frac` du paragraphe `el` à l'endroit où l'ancre le met d'ordinaire. */
function settleOn(el: HTMLElement, frac: number) {
  const box = document.querySelector<HTMLElement>('[data-scroll-container]');
  if (!box) return;
  const frame = box.getBoundingClientRect().top;
  const r = el.getBoundingClientRect();
  box.scrollTop += r.top + frac * r.height - (frame + PASSAGE_TOP);
}

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

    // Changement de langue : la fraction du paragraphe que le lecteur avait lue.
    const left = takeSwitch(langOfPath(window.location.pathname))?.passage as { id: string; frac: number } | undefined;
    let hash = '';
    try {
      hash = decodeURIComponent(window.location.hash.slice(1));
    } catch {}
    const target = left && typeof left.frac === 'number' && left.frac > 0 && hash === left.id ? document.getElementById(left.id) : null;
    let stop = () => {};
    if (target && left) {
      const frac = Math.min(1, left.frac);
      let live = true;
      const apply = () => live && settleOn(target, frac);
      // Après le saut d'ancre du navigateur, puis une fois les images posées.
      const f = requestAnimationFrame(() => requestAnimationFrame(apply));
      const onLoad = () => window.setTimeout(apply, 60);
      if (document.readyState !== 'complete') window.addEventListener('load', onLoad, { once: true });
      const cancel = () => {
        live = false;
      };
      const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
      events.forEach((ev) => window.addEventListener(ev, cancel, { once: true, passive: true }));
      const done = window.setTimeout(cancel, 2500);
      stop = () => {
        live = false;
        cancelAnimationFrame(f);
        window.clearTimeout(done);
        window.removeEventListener('load', onLoad);
        events.forEach((ev) => window.removeEventListener(ev, cancel));
      };
    }

    window.addEventListener('hashchange', arrive);
    return () => {
      stop();
      window.removeEventListener('hashchange', arrive);
      clear();
    };
  }, []);

  return null;
}
