/**
 * Barre du haut mobile en mode « scroll-triggered » (demande Alexandre,
 * 2026-08-24) : sur toutes les pages SAUF la home, la barre — glyph du
 * `SiteHeader` + bouton MENU de `MobileMenu`, deux éléments fixes distincts
 * qui occupent le même créneau de 64 px — s'efface quand on descend et
 * revient dès qu'on remonte, ou qu'on est dans les premiers 64 px de page.
 *
 * Répartition des rôles, pour qu'un seul écouteur suffise et que rien ne
 * repasse par React pendant le défilement :
 *
 * - `TopBarAutoHide` (components/site/TopBarAutoHide.tsx) écoute le conteneur
 *   de scroll et pose/retire `TOP_BAR_HIDDEN_ATTR` sur `<html>` ;
 * - les deux barres portent le marqueur `data-top-bar`, et le glissement est
 *   en pur CSS (globals.css, bloc « barre du haut mobile ») — transition de
 *   `translate`, chemin instantané en mouvement réduit (§3.2) ;
 * - le CONTENEUR DE SCROLL monte à `top: 0` du même geste (même bloc CSS) :
 *   le « bandeau » de la barre n'est pas un élément mais la zone de 64 px
 *   au-dessus du conteneur (`top-16`, FramedScroll) — sans cette moitié,
 *   cacher la barre ne rend pas un pixel au contenu (constaté par Alexandre,
 *   2026-08-24). Corollaire dans le contrôleur : en bas de page, la
 *   croissance du conteneur clampe `scrollTop`, et ce recul-là n'est pas un
 *   geste — il est filtré, sinon la barre resurgirait sitôt cachée ;
 * - la home n'est jamais concernée : le critère n'est pas le pathname mais la
 *   présence de `[data-scroll-container]`, absent de `/` par construction
 *   (FramedScroll) — le morph du hero y reste seul maître de la nav.
 *
 * `revealTopBar()` est la porte pour les surfaces qui ATTENDENT la barre sans
 * faire défiler quoi que ce soit : le calque immersif de /series mobile flotte
 * SOUS le glyph et MENU (z-40 contre 50/55) et leur réserve 64 px — ouvrir une
 * série barre cachée poserait un calque qui compte sur des contrôles absents.
 */

export const TOP_BAR_HIDDEN_ATTR = 'data-top-bar-hidden';

export const TOP_BAR_REVEAL_EVENT = 'nav:top-bar-reveal';

/** Redemande la barre — no-op sur desktop et sur la home (aucun écouteur). */
export function revealTopBar(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TOP_BAR_REVEAL_EVENT));
}
