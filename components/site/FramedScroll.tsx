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
 */
export function FramedScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  if (isHome) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-x-0 top-16 bottom-0 overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}
