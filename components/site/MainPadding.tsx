'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Wrapper du <main> appliquant 64 px de padding vertical (top & bottom) sur
 * toutes les pages éditoriales — règle non-négociable du brand book §6.6 :
 *   « distance entre body content et nav-bar / footer = 64 px ».
 *
 * Padding (pas margin) : évite le margin-collapsing avec les enfants et garantit
 * que les 64 px sont à l'INTÉRIEUR du <main>, jamais avalés par un parent.
 *
 * Style inline (pas Tailwind) : aucune classe à compiler, aucun cache CSS à
 * busted, le HTML qui sort du serveur contient `style="padding-top:64px;..."`
 * littéralement.
 *
 * Home (/) exclue : HomeHero est full-viewport, la nav-bar est masquée et le
 * morph gère son propre rythme.
 */
export function MainPadding({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <main
      id="main"
      style={isHome ? undefined : { paddingTop: 64, paddingBottom: 64 }}
    >
      {children}
    </main>
  );
}
