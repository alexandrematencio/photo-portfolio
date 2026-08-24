'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Wrapper du <main> appliquant l'air vertical entre le corps de page et le
 * chrome (nav-bar en haut, dalle du footer en bas) sur toutes les pages
 * éditoriales — règle du brand book §6.6.
 *
 * **En haut, la valeur est de MOITIÉ sur téléphone** (32 / 64, demande
 * Alexandre du 2026-08-24) : elle vient du token `--page-air-top`
 * (`app/globals.css`, bloc « CADRE DE PAGE » — §7.8), et non d'un nombre écrit
 * ici. Les 64 px avaient été posés pour le desktop et descendus tels quels ;
 * sur un écran de 390 ils prennent 7 % de la hauteur visible avant le premier
 * mot.
 *
 * ⚠️ Le BAS ne bouge pas, et ce n'est pas une omission : le calcul de scène de
 * `/series` (`100dvh − 160` dans `DesktopSeries`) additionne nav-bar (64) +
 * air haut (64) + gouttière basse (32). Il n'est juste qu'au-dessus de `md`,
 * là où l'air haut vaut toujours 64 — la branche desktop de `/series` étant
 * elle-même en `hidden md:block`. Diviser aussi le bas, ou poser 32 en haut
 * aux deux largeurs, ferait dépasser cette page sans le moindre signal.
 *
 * Padding (pas margin) : évite le margin-collapsing avec les enfants et garantit
 * que l'air est à l'INTÉRIEUR du <main>, jamais avalé par un parent.
 *
 * Style inline (pas Tailwind) : aucune classe à compiler, aucun cache CSS à
 * buster — et c'est aussi ce qui rend le token utilisable, un `var()` posé en
 * inline restant responsive puisque c'est la VARIABLE qui bascule au point de
 * rupture (cf. §7.8).
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
              paddingTop: 'var(--page-air-top)',
              paddingBottom: isSeries ? 32 : 64,
            }
      }
    >
      {children}
    </main>
  );
}
