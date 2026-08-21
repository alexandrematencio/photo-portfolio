'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

/**
 * Sur les pages "classiques" (non-home), le scroll de la page se passe dans un
 * conteneur interne positionné SOUS la nav-bar. Le body ne scrolle pas → aucun
 * pixel de contenu ne peut visuellement entrer dans la zone du nav-bar (les
 * 64px du haut), peu importe la position de scroll.
 *
 * Sur la home (`/`), on passe à travers sans wrapper : le scroll reste sur
 * window, ce dont GSAP ScrollTrigger / Lenis / le morph HomeHero ont besoin.
 * La home est de toute façon plus haute que l'écran par construction (hero
 * plein viewport + spacer du morph + galerie) : le footer y est toujours en
 * fin de document, jamais suspendu au milieu de l'écran.
 *
 * ── Footer collé en bas, RÈGLE GLOBALE ────────────────────────────────────
 * La colonne interne (`flex flex-col` + `min-h-full`) fait au moins la hauteur
 * de la zone visible. `<main>` porte `flex: 1 0 auto` (cf. MainPadding) et
 * absorbe donc tout l'espace restant ; le footer, dernier enfant, se retrouve
 * mécaniquement au bas de l'écran quand la page est courte, et à la fin du
 * document quand elle est longue. Aucune hauteur à calculer par page, aucun
 * `position: fixed` : toute page présente ou future placée dans ce groupe de
 * routes en hérite sans rien déclarer.
 */
export function FramedScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  if (isHome) {
    return <>{children}</>;
  }

  // `data-scroll-container` : marqueur, pas un comportement. C'est CE nœud qui
  // porte le scroll de la page (le body ne scrolle pas), donc une page qui doit
  // piloter son propre défilement a besoin de le retrouver depuis son sous-arbre
  // (`closest`). /series s'en sert pour consommer les 70 px de débord vertical —
  // la réserve du footer — à la fin du défilement horizontal de sa rangée.
  return (
    <div
      data-scroll-container
      className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto overflow-x-hidden"
    >
      <div className="flex min-h-full flex-col">{children}</div>
    </div>
  );
}
