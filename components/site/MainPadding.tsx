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
 *
 * `flex: 1 0 auto` : c'est la moitié « main » du footer collé en bas (l'autre
 * moitié est la colonne `min-h-full` de FramedScroll). `1 0 auto` et non
 * `1 1 0%` — main GRANDIT pour pousser le footer au bas de l'écran quand la
 * page est courte, mais ne RÉTRÉCIT jamais sous la hauteur de son contenu.
 *
 * /series : gouttière basse de 32 px au lieu de 64, pour que l'écart entre les
 * piles et le footer soit exactement celui du bord gauche (demande explicite —
 * cette page joue sur l'équilibre des quatre marges, pas sur le rythme
 * éditorial des pages de texte).
 */
export function MainPadding({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isSeries = pathname === '/series' || pathname === '/series/';

  return (
    <main
      id="main"
      style={
        isHome
          ? undefined
          : {
              flex: '1 0 auto',
              paddingTop: 64,
              paddingBottom: isSeries ? 32 : 64,
            }
      }
    >
      {children}
    </main>
  );
}
