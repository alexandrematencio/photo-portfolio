import { useLayoutEffect, useState, type RefObject } from 'react';
import gsap from 'gsap';
import { seriesWordmarkWidthFor } from '../shared/SeriesWordmark';
import { PAGE_TITLE_SIZE_MD } from '@/lib/site/typography';
import { OPEN_LEFT_COL_W } from './OpenSeriesView';
import { DUR, EASE } from './animations';
import type { Phase } from './chains';

/**
 * LE LETTRAGE « SERIES », ses deux tailles et le trajet entre les deux.
 *
 * **Grand (état d'accueil)** : 58 % de la largeur utile de la page. Ce n'est
 * pas un chiffre rond posé à l'œil, c'est un RAPPORT avec la home. « Selected
 * Works » y remplit toute la largeur, ce qui lui donne une capitale de
 * 0,138 × largeur utile (mesuré : 190 px à 1440, 256 à 1920). Le lettrage d'ici
 * étant sur UNE ligne et de six lettres, le même remplissage donnerait une
 * capitale d'environ 277 px à 1440 — une fois et demie la home, sur une page
 * qui a déjà une rangée de piles à tenir dans la même hauteur d'écran. À 58 %,
 * la capitale retombe à 0,845 fois celle de la home : la parenté se lit, la
 * hiérarchie aussi. La page la plus complexe porte le titre le plus modeste.
 *
 * Le plafond de 1 076 px est le même 58 % pris sur la largeur utile MAXIMALE de
 * la home (1 856 px, son `max-width: 1920` moins les gouttières) : au-delà de
 * 1920, les deux titres cessent de grandir ensemble.
 *
 * **Petit (série ouverte)** : le corps du titre de page — d'où la largeur
 * DÉDUITE de `PAGE_TITLE_SIZE_MD` plutôt qu'un rapport transcrit à la main.
 * Une série ouverte est une page de consultation comme `/archives` : son titre
 * se range au même corps, au même coin.
 *
 * ⚠️ Mais SEULEMENT tant que la BANDE DE GAUCHE le permet — et cette place
 * n'est plus transcrite : elle est MESURÉE sur la colonne des noms de séries
 * (`[data-open-left]`) au moment où le mot se replie. Voir `foldWidth()` dans
 * l'effet d'échelle plus bas.
 *
 * Ce qui a changé le 2026-08-24, et pourquoi. Le plafond valait
 * `176 + 32 + 20` : la colonne, PLUS la gouttière de grille, PLUS vingt pixels
 * de débord « admis ». Autrement dit le mot mangeait toute la gouttière et
 * mordait de vingt pixels sur la cellule de l'image. Or le « Back to All
 * Series » est ancré au bord GAUCHE de cette image : les deux libellés se
 * confondaient (capture d'Alexandre). La règle est désormais franche — le
 * lettrage ne sort pas de sa colonne, et les 32 px d'écart sont ceux de la
 * grille, tenus par le navigateur (`OPEN_GAP`).
 *
 * Le mot devient donc le TITRE de la bande de gauche : même bord gauche que
 * les noms de séries, même largeur qu'eux. Un seul bouton de réglage —
 * `OPEN_LEFT_COL_W` : élargir la colonne regrandit le lettrage du même geste.
 * Le `min()` avec le corps de page reste, il reprendrait la main si le titre
 * de page redescendait sous ~48 px.
 */
export const TITLE_WIDTH_PCT = '58%';
export const TITLE_MAX_WIDTH = 1076;

/**
 * Position d'accueil du lettrage (posé sur la rangée) et son repli en titre
 * de la bande de gauche quand une série s'ouvre (§3.7 invariant 17).
 * Rend `titleBottom`, le `bottom` du `<h1>`.
 */
export function useWordmarkFold({
  rowRef,
  titleRef,
  titleBoxRef,
  q,
  phase,
  reduced,
}: {
  rowRef: RefObject<HTMLDivElement | null>;
  titleRef: RefObject<HTMLSpanElement | null>;
  titleBoxRef: RefObject<HTMLHeadingElement | null>;
  q: <T extends Element>(sel: string) => T | null;
  phase: Phase;
  reduced: boolean;
}) {
  // Distance entre le bas du lettrage et le bas de la scène, à l'état
  // d'accueil. Mesurée et non écrite : voir l'effet ci-dessous.
  const [titleBottom, setTitleBottom] = useState(0);

  /**
   * Le lettrage se POSE SUR LA RANGÉE à l'état d'accueil : son bord bas est le
   * bord haut de la boîte de la rangée (demande Alexandre, 2026-08-24). Le
   * grand blanc de la page passe donc AU-DESSUS du titre, au lieu d'être
   * coupé en deux par lui.
   *
   * `bottom = row.clientHeight`, mesuré, et pas un nombre écrit : la rangée
   * fait la hauteur d'une pile (176) plus son bloc de libellés plus son
   * `paddingTop` de 48 — trois valeurs dont deux dépendent de la fonte rendue.
   * L'écart visible entre le bas des glyphes et la ligne « OPEN ↗ » est donc
   * exactement ce `paddingTop` : un seul nombre, déjà écrit une fois, qui sert
   * aux deux. Un `ResizeObserver` parce que ce sont des lignes de texte — elles
   * changent de hauteur avec la fonte servie, après le premier rendu.
   */
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setTitleBottom(row.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [rowRef]);


  /**
   * Le titre se réduit à la taille de celui d'`/archives` PENDANT le vol
   * d'ouverture, et regrandit pendant celui de fermeture. Même durée, même
   * `expo.inOut` que les vols : la page n'a qu'une seule signature de
   * mouvement, le titre ne s'en invente pas une seconde.
   *
   * `useLayoutEffect` et pas `useEffect` : les vols partent eux aussi d'un
   * layout effect, sur le commit de la même phase. Un effet passif jouerait une
   * frame plus tard — assez pour que le titre parte en retard sur des vols de
   * 0,9 s, et assez pour se voir.
   *
   * C'est un `transform` et jamais une largeur animée : l'origine étant le coin
   * haut-gauche, `scale` replie le mot vers cet angle et `y` emmène l'angle
   * lui-même en haut de page. Le petit titre atterrit ainsi exactement là où le
   * titre d'`/archives` se pose sur sa page — même corps, même coin. Rien ne
   * repasse par le layout à chaque frame.
   *
   * `y` se déduit de l'`offsetTop` de la BOÎTE (le `<h1>`), jamais de celui du
   * lettrage : le transform vit sur le lettrage, mesurer sa position reviendrait
   * à lire ce qu'on est en train d'écrire. La boîte, elle, ne bouge pas.
   *
   * ⚠️ L'échelle cible se recalcule à chaque commit ET au redimensionnement :
   * elle est le rapport d'une largeur FIXE (celle du petit titre, en px) sur
   * une largeur PROPORTIONNELLE (58 % de la page). Figée une fois, elle
   * afficherait le petit titre à une taille fausse dès que la fenêtre change —
   * et c'est précisément l'état où l'on reste le plus longtemps.
   *
   * `offsetWidth` et pas `getBoundingClientRect` : le premier donne la largeur
   * de LAYOUT, celle que le transform n'a pas touchée. Le second rendrait la
   * largeur déjà réduite, et l'échelle se composerait avec elle-même à chaque
   * passage.
   */
  useLayoutEffect(() => {
    const el = titleRef.current;
    // Largeur nulle = branche cachée (viewport mobile) : rien à mettre à
    // l'échelle, et surtout pas de division par zéro.
    if (!el || !el.offsetWidth) return;

    const small = phase !== 'closed' && phase !== 'closing';
    const flying = phase === 'opening' || phase === 'closing';

    /**
     * Largeur du lettrage replié — MESURÉE sur la colonne des noms de séries,
     * jamais recopiée de la grille qui la déclare.
     *
     * C'est le cœur du correctif du 2026-08-24. Une cote transcrite ici
     * (`176 + 32 + 20`) et une grille déclarée là-bas, c'est deux vérités qui
     * dérivent à la première retouche — et le recouvrement du « Back to All
     * Series » était exactement cette dérive, doublée d'un débord assumé. En
     * lisant le bord droit de la colonne, on obtient la seule chose qui compte
     * et qu'on ne peut pas se tromper à écrire : la place réellement
     * disponible. Les 32 px qui suivent sont le `gap` de la grille — le
     * navigateur les tient, personne ne les calcule.
     *
     * Toujours disponible quand on en a besoin : `small` n'est vrai que pour
     * `opening` / `open` / `switching`, trois phases posées dans le même lot
     * de state que `displayed`, donc la vue ouverte — et sa colonne — sont
     * montées au moment où ce layout effect tourne. `OPEN_LEFT_COL_W` n'est
     * qu'un filet.
     *
     * `getBoundingClientRect().left` du lettrage est licite malgré le
     * transform en cours : l'origine est le coin haut-gauche (`0 0`) et le
     * tween ne touche que `scale` et `y` — le bord gauche ne bouge donc
     * jamais. (C'est le même raisonnement que l'`offsetWidth` ci-dessous, qui
     * lit la largeur de LAYOUT et non celle déjà réduite.)
     */
    const foldWidth = () => {
      const nav = q<HTMLElement>('[data-open-left]');
      const room = nav
        ? nav.getBoundingClientRect().right - el.getBoundingClientRect().left
        : 0;
      return Math.min(
        seriesWordmarkWidthFor(PAGE_TITLE_SIZE_MD),
        room > 0 ? room : OPEN_LEFT_COL_W
      );
    };

    /**
     * Largeur de LAYOUT du lettrage, en SOUS-PIXELS.
     *
     * `offsetWidth` la donnait aussi, mais ARRONDIE à l'entier — et cet
     * arrondi ressortait à l'arrivée : le mot se posait à 176,06 px pour une
     * colonne de 176, soit 0,06 px pris sur la gouttière. Invisible, mais
     * c'est le genre d'écart qu'on ne veut pas avoir à excuser quand la règle
     * est « 32 px, coûte que coûte ».
     *
     * `getBoundingClientRect()` est fractionnaire, seulement il rend la
     * largeur DÉJÀ mise à l'échelle — s'en servir tel quel ferait composer
     * l'échelle avec elle-même à chaque passage. La diviser par l'échelle en
     * cours (gsap en est le seul auteur, y compris au milieu d'un vol)
     * remonte à la largeur non transformée, exacte.
     */
    const layoutWidth = () =>
      el.getBoundingClientRect().width /
      (Number(gsap.getProperty(el, 'scaleX')) || 1);

    const target = () => {
      const w = layoutWidth();
      if (!w) return null;
      return small
        ? { scale: foldWidth() / w, y: -(titleBoxRef.current?.offsetTop ?? 0) }
        : { scale: 1, y: 0 };
    };

    const to = target();
    if (to)
      gsap.to(el, {
        ...to,
        duration: flying && !reduced ? DUR[small ? 'open' : 'close'] : 0,
        ease: EASE,
        overwrite: 'auto',
      });

    // Au redimensionnement, on RE-POSE la cible sans la rejouer : le geste de
    // l'utilisateur est le redimensionnement, pas une ouverture.
    //
    // `overwrite: 'auto'` est OBLIGATOIRE : un resize peut tomber pendant le
    // vol de repli (0,9 s), et un `gsap.set` nu ne tue pas le tween en cours —
    // il rend une frame, puis les ticks du tween reprennent vers la cible
    // calculée pour l'ANCIENNE fenêtre, et rien dans les deps ne re-déclenche
    // l'effet. Le titre resterait posé à une échelle fausse jusqu'au prochain
    // changement de phase (§3.7 invariant 17 : échelle ET translation se
    // recalculent au redimensionnement).
    const onResize = () => {
      const next = target();
      if (next) gsap.set(el, { ...next, overwrite: 'auto' });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // `titleBottom` : la position d'accueil arrive après le premier rendu (elle
    // est mesurée) et bouge avec la fonte servie. Sans elle dans les deps, `y`
    // resterait calculé sur une boîte encore collée en haut de page.
  }, [phase, reduced, titleBottom, q, titleRef, titleBoxRef]);

  return titleBottom;
}
