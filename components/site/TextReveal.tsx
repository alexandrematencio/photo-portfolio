'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { attachTextReveal } from '@/lib/motion/text-reveal';
import { peekPageArrival } from '@/lib/site/page-transition';

/**
 * Les règles voyagent AVEC le composant, dans le HTML servi : une page qui
 * l'adopte n'a rien d'autre à brancher. Les nombres de `.tr-u` sont ceux de
 * `FROM` (`text-reveal.ts`) — les deux bougent ensemble.
 *
 * Un caractère se brouille par son OMBRE, texte rendu transparent, jamais par
 * `filter` : un filtre par lettre, c'est un calque par lettre (`paint`, dans
 * `text-reveal.ts`). Seuls les atomiques (logo, SVG) gardent `filter`.
 *
 * L'animation de secours rend le texte si le JS ne prend jamais la main
 * (bundle en erreur) : 3 s, puis visible. `live` et `done` l'annulent.
 * Les mots sont insécables : des caractères en `inline-block` offriraient une
 * coupure de ligne entre chacun d'eux. Et un soulignement ne descend pas dans
 * un `inline-block` : sous un lien, chaque niveau le recopie explicitement.
 */
const STYLES = `
@keyframes text-reveal-failsafe { to { opacity: 1 } }
@media (prefers-reduced-motion: no-preference) {
  [data-text-reveal='pending'] { opacity: 0; animation: text-reveal-failsafe 0s 3s forwards }
}
[data-text-reveal] .tr-w { white-space: nowrap }
[data-text-reveal] .tr-w > .tr-u { display: inline-block }
[data-text-reveal] a * { text-decoration: inherit }
[data-text-reveal='live'] .tr-u:not(.tr-on) { transform: scale(1.8, 0.1); filter: blur(10px); opacity: 0.5 }
[data-text-reveal='live'] .tr-w > .tr-u:not(.tr-on) {
  filter: none; opacity: 1;
  -webkit-text-fill-color: transparent; text-decoration-color: transparent;
  text-shadow: 0 0 20px color-mix(in srgb, currentColor 50%, transparent);
}
[data-text-reveal='live'] .tr-far { visibility: hidden }
`;

/**
 * Corps de page qui se révèle au chargement, puis au défilement
 * (`lib/motion/text-reveal.ts` pour l'effet et ses réglages).
 *
 * L'ÉTAT DE DÉPART EST DANS LE HTML SERVI (`data-text-reveal="pending"`, cf. `STYLES`
 * ci-dessus) — même leçon que l'entrée de /series : l'export est statique,
 * le navigateur peint bien avant l'hydratation, et un état posé au montage
 * montrerait le texte net une fraction de seconde avant de le brouiller.
 * Trois chemins défont cet état sans rien jouer : mouvement réduit (CSS et
 * `matchMedia`, jamais `useReducedMotion` qui rend `false` au premier rendu),
 * pas de JS (`<noscript>`), et JS en panne (une animation CSS de secours).
 */
export function TextReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scroller = root.closest<HTMLElement>('[data-scroll-container]');
    if (!scroller || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.dataset.textReveal = 'done';
      return;
    }
    // Arrivée latérale en cours : le texte entre flou et se pose pendant la
    // seconde moitié du glissé, plutôt qu'après lui.
    const delay = peekPageArrival(pathname) ? 0.3 : 0.1;
    const stop = attachTextReveal(root, scroller, { delay });
    root.dataset.textReveal = 'live';
    return () => {
      stop();
      root.dataset.textReveal = 'pending';
    };
  }, [pathname]);

  return (
    <div ref={ref} data-text-reveal="pending">
      <style>{STYLES}</style>
      <noscript>
        <style>{'[data-text-reveal]{opacity:1!important;animation:none!important}'}</style>
      </noscript>
      {children}
    </div>
  );
}
