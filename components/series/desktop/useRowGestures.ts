import { useEffect, type RefObject } from 'react';
import type gsap from 'gsap';
import type { Phase } from './chains';

/**
 * Gestes de la rangée fermée : molette sur les deux axes et réserve du footer
 * (§3.7 invariant 14), rangement du footer, cliquer-glisser.
 */
export function useRowGestures({
  sceneRef,
  rowRef,
  phase,
  scrollContainer,
  showFooter,
  footerShown,
  footerTween,
}: {
  sceneRef: RefObject<HTMLElement | null>;
  rowRef: RefObject<HTMLDivElement | null>;
  phase: Phase;
  scrollContainer: () => HTMLElement | null;
  showFooter: (show: boolean) => void;
  footerShown: RefObject<boolean>;
  footerTween: RefObject<gsap.core.Tween | null>;
}) {
  // Molette → défilement horizontal de la rangée (spec §5), sur LES DEUX AXES.
  //
  // Écoutée sur le CONTENEUR DE SCROLL DE LA PAGE, plus sur la seule rangée :
  // toute la surface de la page répond au geste, pas uniquement la bande de
  // piles en bas d'écran (la nav-bar, elle, est `fixed` HORS de ce conteneur —
  // elle garde donc son comportement propre). Corollaire : la page ne défile
  // plus jamais verticalement d'elle-même, c'est ce gestionnaire qui décide,
  // et le seul défilement vertical possible est la révélation du footer en
  // bout de rangée.
  //
  // Les DEUX AXES mènent à la rangée (demande Alexandre, 2026-08-24) : molette
  // de souris comme geste horizontal de trackpad, c'est à l'utilisateur de
  // choisir. On retient l'axe DOMINANT du geste et on l'applique tel quel — un
  // geste vers le bas ou vers la droite avance dans la rangée, vers le haut ou
  // vers la gauche recule.
  //
  // ⚠️ MAIS LE FOOTER N'APPARTIENT QU'À L'AXE VERTICAL (demande Alexandre,
  // 2026-08-24). Les deux axes s'arrêtent au bout de la rangée ; seul un cran
  // vers le BAS consomme ensuite la réserve du footer. Un geste horizontal qui
  // pousse contre la butée ne fait plus rien — et c'est voulu : le footer est
  // le bas de la PAGE, pas la suite de la rangée. Le faire surgir au bout d'une
  // course latérale, c'est répondre à un geste par un mouvement perpendiculaire
  // — sur un trackpad, une inertie de fin de glissement suffisait à le tirer.
  // Le sens inverse suit la même règle : vers le haut on range le footer, vers
  // la gauche on repart dans la rangée (et le footer se range de lui-même dès
  // qu'elle quitte le bout, via l'écouteur `scroll` ci-dessous).
  //
  // ⚠️ L'axe horizontal était jusqu'ici laissé au natif (`deltaX` dominant →
  // early return). Le laisser passer maintenant le ferait jouer DEUX fois
  // au-dessus de la rangée, qui est elle-même en `overflow-x-auto` : d'où le
  // `preventDefault` sur les deux axes.
  //
  // Non-passive : on doit pouvoir preventDefault.
  useEffect(() => {
    const cont = scrollContainer();
    const row = rowRef.current;
    if (!cont || !row) return;

    const onWheel = (e: WheelEvent) => {
      // Branche cachée (viewport mobile) : ne jamais réagir — invariant 3.
      if (sceneRef.current?.offsetParent === null) return;

      if (phase !== 'closed') {
        // Vue ouverte : rien ne change à l'expérience — la colonne de vignettes
        // garde son défilement natif. Seule la PAGE est immobilisée, sans quoi
        // la vue ouverte remonterait de 70 px sous la nav-bar en découvrant un
        // footer qui n'a rien à faire là (il n'appartient qu'au bout de la
        // rangée). Pendant les vols (opening/closing/switching), tout est gelé :
        // un défilement en cours de vol déplacerait les éléments réels sous des
        // clones `position: fixed`, et le raccord se ferait à côté.
        const target = e.target as Element | null;
        const inCol = target?.closest?.('[data-open-col]');
        if (!inCol || phase !== 'open') e.preventDefault();
        return;
      }

      // Axe dominant du geste. Un trackpad renvoie presque toujours un peu des
      // deux ; prendre le plus grand évite qu'une diagonale involontaire
      // annule le geste voulu.
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = horizontal ? e.deltaX : e.deltaY;
      if (!delta) return;
      e.preventDefault();

      const maxLeft = row.scrollWidth - row.clientWidth;
      // Tolérance d'1 px : les navigateurs rendent un scrollLeft fractionnaire
      // (zoom, DPR non entier) et une égalité stricte ne serait jamais vraie.
      const atEnd = row.scrollLeft >= maxLeft - 1;

      if (delta > 0) {
        // Vers le bas ou vers la droite → on avance dans la rangée. Au bout,
        // les deux axes s'arrêtent ; seul le VERTICAL a le droit d'aller
        // chercher le footer, et seulement au cran SUIVANT (arriver au bout ne
        // le déclenche pas). La butée est ainsi un temps d'arrêt, pas un mur.
        if (atEnd) {
          if (!horizontal) showFooter(true);
        } else row.scrollLeft = Math.min(maxLeft, row.scrollLeft + delta);
      } else if (footerShown.current && !horizontal) {
        // Vers le haut, le footer se range d'abord : il occupe le cran qui
        // l'avait fait venir.
        showFooter(false);
      } else {
        // Vers la gauche (ou vers le haut footer déjà rangé) → on recule dans
        // la rangée. Si le footer était sorti, l'écouteur `scroll` de la rangée
        // le range dès qu'elle quitte le bout : c'est déjà le chemin du
        // cliquer-glisser et des flèches, on n'en ajoute pas un deuxième.
        row.scrollLeft = Math.max(0, row.scrollLeft + delta);
      }
    };

    cont.addEventListener('wheel', onWheel, { passive: false });
    return () => cont.removeEventListener('wheel', onWheel);
  }, [phase, scrollContainer, showFooter, footerShown, rowRef, sceneRef]);

  // Le footer n'existe qu'au bout de la rangée : dès qu'on s'en éloigne — au
  // cliquer-glisser, aux flèches du clavier, à la barre de défilement — il se
  // range. Sans ça il resterait suspendu au-dessus d'une rangée revenue au
  // milieu de sa course, sans plus rien à quoi être accroché.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const onScroll = () => {
      if (!footerShown.current) return;
      if (sceneRef.current?.offsetParent === null) return;
      const maxLeft = row.scrollWidth - row.clientWidth;
      if (row.scrollLeft < maxLeft - 1) showFooter(false);
    };
    row.addEventListener('scroll', onScroll, { passive: true });
    return () => row.removeEventListener('scroll', onScroll);
  }, [showFooter, footerShown, rowRef, sceneRef]);

  // Le vol en cours ne doit pas être doublé d'un glissement de footer.
  useEffect(
    () => () => {
      footerTween.current?.kill();
    },
    [footerTween]
  );

  // Cliquer-glisser sur la rangée. Seuil de 6 px avant de « voler » le clic.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let startX = 0;
    let startScroll = 0;
    let dragging = false;
    let moved = false;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startScroll = row.scrollLeft;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        row.setPointerCapture(e.pointerId);
      }
      if (moved) row.scrollLeft = startScroll - dx;
    };
    const onUp = () => {
      dragging = false;
    };
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    };
    row.addEventListener('pointerdown', onDown);
    row.addEventListener('pointermove', onMove);
    row.addEventListener('pointerup', onUp);
    row.addEventListener('click', onClickCapture, true);
    return () => {
      row.removeEventListener('pointerdown', onDown);
      row.removeEventListener('pointermove', onMove);
      row.removeEventListener('pointerup', onUp);
      row.removeEventListener('click', onClickCapture, true);
    };
  }, [rowRef]);
}
