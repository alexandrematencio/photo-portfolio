'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  TOP_BAR_HIDDEN_ATTR,
  TOP_BAR_REVEAL_EVENT,
} from '@/lib/site/top-bar';

/**
 * Contrôleur du mode « scroll-triggered » de la barre du haut mobile — vue
 * d'ensemble et répartition des rôles dans `lib/site/top-bar.ts`.
 *
 * Ne rend rien : il écoute le conteneur de scroll de la page et pose/retire
 * `TOP_BAR_HIDDEN_ATTR` sur `<html>` ; le glissement des deux barres est en
 * pur CSS. Un seul écouteur pour les deux, aucun re-render pendant le
 * défilement, et un seul écrit DOM par bascule d'état.
 *
 * Trois choix à ne pas défaire :
 * - **Le critère « pas la home » est la présence de `[data-scroll-container]`**,
 *   jamais une liste de pathnames : FramedScroll ne pose le conteneur que hors
 *   de `/`, c'est déjà la partition exacte, et elle suivra toute page future.
 * - **Actif sous `md` seulement**, via matchMedia suivi en continu : au-dessus,
 *   aucun écouteur ne tourne (le CSS ne s'applique de toute façon pas là-haut,
 *   mais un écouteur qui calcule pour rien reste un écouteur qui tourne).
 * - **Un focus clavier dans la barre la fait revenir** : ses liens restent
 *   tabbables hors écran, un focus invisible serait un échec WCAG 2.4.7.
 */

/** Zone haute (px) où la barre est toujours montrée — sa propre hauteur. */
const SHOW_ZONE = 64;

/** Delta (px) par frame en dessous duquel un geste ne compte pas — filtre le
 *  bruit des trackpads et le rebond élastique d'iOS autour d'un point fixe. */
const JITTER = 2;

export function TopBarAutoHide() {
  const pathname = usePathname();

  // Ré-exécuté à chaque navigation : le conteneur peut apparaître/disparaître
  // (home ↔ pages classiques), et chaque page doit démarrer barre visible.
  useEffect(() => {
    const container = document.querySelector('[data-scroll-container]');
    if (!container) return; // home : le scroll est sur window, barre intouchée
    const root = document.documentElement;
    const mdUp = window.matchMedia('(min-width: 48rem)');

    let hidden = false;
    let lastY = 0;
    let raf = 0;

    const setHidden = (next: boolean) => {
      if (next === hidden) return;
      hidden = next;
      root.toggleAttribute(TOP_BAR_HIDDEN_ATTR, next);
    };

    // Lecture au rythme des frames, jamais par événement : le scroll momentum
    // en émet bien plus que 60/s, et une frame agrège naturellement le delta.
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.max(0, container.scrollTop); // l'élastique iOS passe sous 0
        const dy = y - lastY;
        lastY = y;
        if (y <= SHOW_ZONE) setHidden(false);
        else if (dy > JITTER) setHidden(true);
        else if (dy < -JITTER) {
          // Un recul qui laisse le scroll PINÉ au fond n'est pas un geste :
          // cacher la barre fait monter le conteneur à top:0 (globals.css),
          // donc grandir de 64 px — en bas de page, le navigateur clampe
          // alors `scrollTop` de ces 64 px, et lu comme une remontée ce
          // recul ferait resurgir la barre qu'on vient de cacher (boucle).
          // Un vrai geste vers le haut décolle du fond ; le clamp, lui,
          // atterrit exactement dessus. Filtre aussi le rebond élastique
          // iOS au-delà du fond, au même critère.
          const max = container.scrollHeight - container.clientHeight;
          if (y < max - 1) setHidden(false);
        }
      });
    };

    const reveal = () => setHidden(false);
    const onFocusIn = (e: FocusEvent) => {
      if (hidden && (e.target as Element | null)?.closest?.('[data-top-bar]')) {
        reveal();
      }
    };

    const attach = () => {
      lastY = Math.max(0, container.scrollTop);
      container.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener(TOP_BAR_REVEAL_EVENT, reveal);
      document.addEventListener('focusin', onFocusIn);
    };
    // Idempotent (removeEventListener sur un écouteur absent est un no-op) :
    // appelable depuis la bascule matchMedia comme depuis le cleanup.
    const detach = () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener(TOP_BAR_REVEAL_EVENT, reveal);
      document.removeEventListener('focusin', onFocusIn);
      cancelAnimationFrame(raf);
      raf = 0;
      setHidden(false);
    };

    const onBreakpoint = () => (mdUp.matches ? detach() : attach());
    onBreakpoint();
    mdUp.addEventListener('change', onBreakpoint);
    return () => {
      mdUp.removeEventListener('change', onBreakpoint);
      detach();
    };
  }, [pathname]);

  return null;
}
