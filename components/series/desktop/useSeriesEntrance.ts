import { useLayoutEffect, useRef, type RefObject } from 'react';
import { runEntrance, settleAtRest, type Entrance } from './entrance';
import { peekPageArrival } from '@/lib/site/page-transition';
import type { Phase } from './chains';

/** Entrée de la page (§3.7 invariant 18) et sa fin anticipée au premier geste d'ouverture. */
export function useSeriesEntrance(
  sceneRef: RefObject<HTMLElement | null>,
  rowRef: RefObject<HTMLDivElement | null>,
  wordmarkRef: RefObject<HTMLSpanElement | null>,
  phase: Phase
) {
  const entranceRef = useRef<Entrance | null>(null);

  /**
   * Le train entre par la droite et freine ; la bouée est relâchée quand il
   * est posé. Mécanique, physique et réglages : `entrance.ts`.
   *
   * UNE SEULE FOIS, au montage — d'où les dépendances vides, assumées :
   * l'entrée est un événement d'arrivée sur la page, pas un état à
   * réconcilier. Trois gardes avant de jouer :
   *
   *   - branche CACHÉE (`offsetParent`, §3.7 invariant 3) : sous `md` cette
   *     branche reste montée, c'est le CSS qui l'efface. Y jouer une entrée,
   *     ce serait animer une hauteur de capitale nulle — et la vraie entrée
   *     mobile n'existe pas (le titre y est un `PageTitle` fixe) ;
   *   - MOUVEMENT RÉDUIT lu directement sur `matchMedia` et non sur le hook :
   *     celui-ci rend `false` au premier rendu et ne se corrige qu'après la
   *     peinture (c'est un `useEffect`). L'entrée partirait donc pour de bon
   *     chez quelqu'un qui l'a explicitement refusée, le temps d'une frame ou
   *     deux (§3.2) ;
   *   - hauteur de capitale nulle : lettrage pas encore mesurable, rien à
   *     faire jaillir.
   *
   * `useLayoutEffect` : les états de départ (rangée hors écran, mot immergé)
   * doivent être posés AVANT la première peinture. Un effet passif laisserait
   * voir une frame de la page au repos, puis le saut.
   */
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    const row = rowRef.current;
    const wordmark = wordmarkRef.current;
    if (!scene || !row || !wordmark) return;

    if (
      scene.offsetParent === null ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !wordmark.getBoundingClientRect().height
    ) {
      // Renoncer, c'est RÉVÉLER : l'état de départ vient du HTML, personne
      // d'autre ne le défera.
      settleAtRest(row, wordmark);
      return;
    }

    const entrance = runEntrance({
      row,
      stacks: Array.from(row.querySelectorAll<HTMLElement>('[data-stack]')),
      wordmark,
      // Arrivée par la nav : le train entre du côté que lui laisse la page de
      // départ (lib/site/page-transition.ts). Chargement direct : la droite.
      side: peekPageArrival('/series')?.side ?? 1,
    });
    entranceRef.current = entrance;
    return () => {
      entrance.finish();
      entranceRef.current = null;
    };
  }, [sceneRef, rowRef, wordmarkRef]);

  /**
   * Un geste qui ouvre une série TERMINE l'entrée sur-le-champ.
   *
   * Ce n'est pas une politesse : les vols d'ouverture mesurent les rects des
   * piles et posent des clones `position: fixed` par-dessus (§3.7 invariant
   * 1). Une rangée encore en mouvement ferait glisser les éléments réels sous
   * des clones immobiles — le raccord de fin découvrirait la photo ailleurs
   * qu'où elle a été prise.
   */
  useLayoutEffect(() => {
    if (phase === 'closed') return;
    entranceRef.current?.finish();
    entranceRef.current = null;
  }, [phase]);
}
