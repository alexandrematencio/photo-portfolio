import { useCallback, useRef, type RefObject } from 'react';
import gsap from 'gsap';

/**
 * Durée du glissement du footer. Court exprès : le footer n'est pas un
 * événement de la page, c'est la butée de fin de rangée qui se montre. Assez
 * long pour ne pas claquer, assez court pour ne pas se faire remarquer.
 */
const FOOTER_REVEAL_DUR = 0.26;

/**
 * Réserve du footer de /series : son état (révélé ou rangé), le glissement
 * qui le montre, et la remise à plat de la page avant un vol d'ouverture.
 * Aucun effet ici — les écouteurs qui s'en servent sont dans `useRowGestures`.
 */
export function useFooterReserve(
  sceneRef: RefObject<HTMLElement | null>,
  rowRef: RefObject<HTMLDivElement | null>,
  reduced: boolean
) {
  // Footer : révélé (true) ou rangé sous l'horizon (false). Un ref et non un
  // state — la molette le lit à chaque événement, un re-render par cran serait
  // du gaspillage et introduirait un décalage d'une frame.
  const footerShown = useRef(false);
  const footerTween = useRef<gsap.core.Tween | null>(null);

  // ── Footer accroché à la fin de la rangée ─────────────────────────────────
  //
  // Sur /series, la page déborde de EXACTEMENT la hauteur du footer (70 px) :
  // la scène occupe toute la hauteur visible et le footer reste juste sous
  // l'horizon (§3.7 invariant 11). Ce débord cesse d'être un scroll libre — il
  // devient la RÉSERVE que la fin du défilement horizontal consomme. D'où le
  // pilotage manuel : la molette ne fait plus jamais défiler la page
  // verticalement, c'est cette fonction qui décide, et seulement en bout de
  // rangée.

  const scrollContainer = useCallback(
    () =>
      sceneRef.current?.closest<HTMLElement>('[data-scroll-container]') ?? null,
    [sceneRef]
  );

  const showFooter = useCallback(
    (show: boolean) => {
      if (footerShown.current === show) return;
      const cont = scrollContainer();
      if (!cont) return;
      const max = cont.scrollHeight - cont.clientHeight;
      if (max <= 0) return;
      footerShown.current = show;
      const to = show ? max : 0;
      footerTween.current?.kill();
      if (reduced) {
        cont.scrollTop = to;
        return;
      }
      footerTween.current = gsap.to(cont, {
        scrollTop: to,
        duration: FOOTER_REVEAL_DUR,
        ease: 'power2.out',
        overwrite: true,
      });
    },
    [reduced, scrollContainer]
  );

  /**
   * Remet la page à plat, sans que la rangée bouge à l'écran.
   *
   * Appelée juste avant de mesurer les rects d'un vol d'ouverture : la vue
   * ouverte est en `absolute inset-0` de la scène, elle DOIT être mesurée sur
   * une page non défilée, sinon elle se pose 70 px trop haut — sous la nav-bar,
   * avec la colonne de vignettes qui court sous le footer (état vérifié en
   * capture avant ce correctif). Mais remettre à plat déplace aussi les piles
   * de 70 px vers le bas, et leurs rects sont le POINT DE DÉPART des vols : les
   * clones jailliraient d'ailleurs que là où l'utilisateur voit les piles. D'où
   * la compensation en transform — la rangée reste visuellement immobile, donc
   * `getBoundingClientRect` rend la position à l'écran, et la destination est
   * mesurée sur une page à plat. Les deux bouts du vol sont justes.
   *
   * Le transform est retiré au passage en `open`, où la rangée est de toute
   * façon masquée par sa classe (invariant 12).
   */
  const flattenPage = useCallback(() => {
    const cont = scrollContainer();
    if (!cont) return;
    footerTween.current?.kill();
    const off = cont.scrollTop;
    footerShown.current = false;
    if (off <= 0) return;
    cont.scrollTop = 0;
    if (rowRef.current) gsap.set(rowRef.current, { y: -off });
  }, [scrollContainer, rowRef]);

  return { footerShown, footerTween, scrollContainer, showFooter, flattenPage };
}
