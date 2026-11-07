'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * LE RETOUR ARRIÈRE RAMÈNE AU MÊME ENDROIT (2026-11-07, demande Alexandre).
 *
 * Le navigateur ne retient que le défilement de la fenêtre. Or sur le blog la
 * page défile dans un conteneur (`[data-scroll-container]`, FramedScroll) :
 * revenir en arrière, depuis un article ou depuis une autre langue,
 * ramenait en haut de page. On retient donc nous-mêmes la position de chaque
 * page, par chemin, dans `sessionStorage` (l'onglet seul, effacé à sa
 * fermeture), et on la rend quand on revient :
 *
 * - par le routeur (lien interne puis Retour) : `popstate` ;
 * - par un chargement complet (changement de langue, `<html lang>` oblige,
 *   puis Retour) : `performance` dit `back_forward`.
 *
 * Une navigation vers l'avant n'est jamais touchée : un lien `#p-<clé>`
 * (changement de langue, Concept Map) garde son ancre. Si le navigateur a
 * gardé la page entière en mémoire (bfcache), rien ne se remonte et rien
 * n'est à rendre.
 */

const KEY = 'journal:scroll:';
/** Repli si `sessionStorage` est refusé (navigation privée, stockage bloqué). */
const memory = new Map<string, number>();

function save(path: string, top: number) {
  memory.set(path, top);
  try {
    sessionStorage.setItem(KEY + path, String(Math.round(top)));
  } catch {}
}

function saved(path: string): number | undefined {
  try {
    const v = sessionStorage.getItem(KEY + path);
    if (v !== null) return Number(v);
  } catch {}
  return memory.get(path);
}

/** Vrai le temps d'un rendu : la page affichée vient de l'historique. */
let popped = false;
let firstRun = true;

export function ScrollMemory() {
  const pathname = usePathname();

  useEffect(() => {
    const onPop = () => {
      popped = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const box = document.querySelector<HTMLElement>('[data-scroll-container]');
    if (!box) return;

    let back = popped;
    if (firstRun) {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      back = nav?.type === 'back_forward';
    }
    // Remis à zéro au tour suivant, pas tout de suite : en dev, StrictMode
    // rejoue l'effet aussitôt, et ce second passage doit voir les mêmes drapeaux.
    const reset = window.setTimeout(() => {
      firstRun = false;
      popped = false;
    });

    const top = back ? saved(pathname) : undefined;
    let frame = 0;
    if (top !== undefined) {
      // Deux frames : le routeur fait défiler la page qui arrive vers son
      // segment (ce qui laissait 64 px) ; on passe après lui.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          box.scrollTop = top;
        });
      });
    }

    let pending = 0;
    const onScroll = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        // Pendant un Retour, l'adresse a déjà changé mais l'ancienne page est
        // encore là : son défilement ne doit pas s'écrire sous le nouveau chemin.
        if (location.pathname === pathname) save(pathname, box.scrollTop);
      });
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(reset);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pending);
      box.removeEventListener('scroll', onScroll);
    };
  }, [pathname]);

  return null;
}
