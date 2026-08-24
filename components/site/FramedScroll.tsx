'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';

/**
 * Sur les pages "classiques" (non-home), le scroll de la page se passe dans un
 * conteneur interne positionné SOUS la nav-bar. Le body ne scrolle pas → aucun
 * pixel de contenu ne peut visuellement entrer dans la zone du nav-bar (les
 * 64px du haut), peu importe la position de scroll.
 *
 * Nuance MOBILE (2026-08-24) : sous `md`, quand la barre du haut se cache au
 * défilement descendant (mode « scroll-triggered », lib/site/top-bar.ts), le
 * conteneur monte à `top: 0` — règle unlayered de globals.css sur
 * `[data-scroll-container]` — et le contenu récupère les 64 px. La garantie
 * ci-dessus reste entière tant que la barre est visible.
 *
 * Sur la home (`/`), on passe à travers sans wrapper : le scroll reste sur
 * window, ce dont GSAP ScrollTrigger / Lenis / le morph HomeHero ont besoin.
 * La home est de toute façon plus haute que l'écran par construction (hero
 * plein viewport + spacer du morph + galerie) : le footer y est toujours en
 * fin de document, jamais suspendu au milieu de l'écran.
 *
 * ── Footer TOUJOURS SOUS L'HORIZON, RÈGLE GLOBALE ─────────────────────────
 * Le footer ne se montre JAMAIS au chargement, quelle que soit la longueur du
 * corps de page (demande Alexandre, 2026-08-24) : il faut être allé le
 * chercher au défilement. C'est pour ça qu'il vit HORS de la colonne
 * `min-h-full` — celle-ci fait au moins la hauteur visible, `<main>` porte
 * `flex: 1 0 auto` (cf. MainPadding) et absorbe tout l'espace restant, si bien
 * que le footer, posé APRÈS elle, commence exactement au bas de l'écran.
 * Une page courte a donc pour seul débord la hauteur du footer.
 *
 * ⚠️ Le mettre DANS la colonne le collerait au bas de l'écran, VISIBLE, sur
 * toute page plus courte que le viewport — c'est l'état précédent, et c'est
 * précisément ce qu'on ne veut plus. Deux enfants distincts du conteneur de
 * scroll, jamais un seul.
 *
 * Aucune hauteur à calculer par page, aucun `position: fixed` : toute page
 * présente ou future placée dans ce groupe de routes en hérite sans rien
 * déclarer.
 */
export function FramedScroll({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  if (isHome) {
    return (
      <>
        {children}
        {footer}
      </>
    );
  }

  // `data-scroll-container` : marqueur, pas un comportement. C'est CE nœud qui
  // porte le scroll de la page (le body ne scrolle pas), donc une page qui doit
  // piloter son propre défilement a besoin de le retrouver depuis son sous-arbre
  // (`closest`). /series s'en sert pour consommer les 70 px de débord vertical —
  // la réserve du footer — à la fin de son défilement VERTICAL.
  return (
    <div
      data-scroll-container
      className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto overflow-x-hidden"
    >
      <div className="flex min-h-full flex-col">{children}</div>
      {footer}
    </div>
  );
}
