'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect } from 'react';
import { peekPageArrival, playPageArrival } from '@/lib/site/page-transition';

/**
 * Moitié ARRIVÉE des transitions de page latérales (`lib/site/page-transition.ts`) :
 * la nouvelle page entre par le bord que lui a laissé la page de départ.
 *
 * Posé APRÈS `FramedScroll` dans le layout : ses effets passent après ceux de
 * la page, qui peut donc lire le même témoin avant lui (/series y prend le
 * sens de son train). `useLayoutEffect` : la page doit être hors écran AVANT
 * le premier paint, sinon elle se montre une frame à sa place puis saute.
 *
 * La home n'est pas concernée : son arrivée est celle du logo (`home-return.ts`).
 */
export function PageArrival() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    if (pathname === '/') return;
    const arrival = peekPageArrival(pathname);
    if (!arrival) return;
    return playPageArrival(arrival, pathname);
  }, [pathname]);
  return null;
}
