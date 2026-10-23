'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * LE SURLIGNÉ (2026-10-23, demande Alexandre) — la phrase que l'auteur a
 * marquée au jaune dans le Studio (décorateur `highlight`). Il remplace la
 * citation en exergue pour les nouveaux articles : la phrase reste à sa
 * place dans le texte, et le marqueur la tire quand le lecteur y arrive.
 *
 * Transposition de « ScrollTrigger - Highlight Text » de Ryan Mulligan
 * (codepen.io/hexagoncircle/pen/gOPMwvd) : un fond en dégradé plein dont la
 * LARGEUR passe de 0 à 100 %. Sur un élément en ligne coupé en plusieurs
 * lignes, ce fond court le long des lignes mises bout à bout : le trait
 * avance comme une main qui surligne, ligne après ligne. Déclenché une seule
 * fois, quand le haut de la phrase passe aux deux tiers de l'écran (le pen
 * dit « 100 px sous le centre »). Pas de GSAP : un IntersectionObserver
 * suffit pour un déclencheur à sens unique.
 *
 * L'état de départ (trait vide) est dans le HTML servi, via la CSS
 * `.journal-hl` de `globals.css` — même leçon que `TextReveal` : un état
 * posé au montage montrerait le jaune avant de l'effacer. Mouvement réduit :
 * la CSS le pose plein, sans transition. Sans JS : `<noscript>` dans
 * `ArticleBody`.
 */

let observer: IntersectionObserver | null = null;

function observe(el: Element) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // Déjà dépassée (arrivée par une ancre, rechargement en bas de page) :
        // allumée aussi, sans quoi elle resterait vide au retour.
        if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
          (entry.target as HTMLElement).dataset.on = '';
          observer?.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -35% 0px' },
  );
  observer.observe(el);
  return () => observer?.unobserve(el);
}

export function Highlight({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.dataset.on !== undefined) return;
    return observe(el);
  }, []);
  return (
    <mark ref={ref} className="journal-hl">
      {children}
    </mark>
  );
}
