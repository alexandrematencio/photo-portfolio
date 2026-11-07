import type { PreparedSeries } from '@/lib/site/series';
import { colLeadReserve } from '../shared/colLead';
import type { GhostLayer } from './animations';

/** Phases de la machine desktop — voir le préambule de `DesktopSeries.tsx`. */
export type Phase = 'closed' | 'opening' | 'open' | 'closing' | 'switching';

/**
 * Pose la vignette `item` sur sa LIGNE DE POSE dans la colonne : la vignette
 * active avance librement tant qu'elle est en deçà, puis s'y arrête et c'est
 * la colonne qui roule sous elle (`colLead.ts` pour le pourquoi et la mesure
 * de la réserve).
 *
 * UNE LIGNE PAR SENS (`dir`), et c'est indispensable : deux lignes appliquées
 * en même temps se contrediraient dès que la colonne montre moins de deux
 * fois `COL_LEAD` vignettes — chaque appel renverrait l'active vers l'autre
 * ligne, la colonne oscillerait d'un rang à chaque touche. Le sens vient donc
 * de l'index QUITTÉ, jamais d'une devinette sur la position courante.
 *
 * Deux bornes, dans cet ordre de priorité :
 *   1. l'active ne franchit pas la ligne de pose de son sens ;
 *   2. mais elle ne sort JAMAIS par le bord opposé — le vol de chaîne mesure
 *      son rect juste après, et un rect hors écran ne vole pas.
 * D'où le `min`/`max` : sur une série de verticales où une seule vignette
 * occupe presque toute la colonne, c'est la visibilité qui gagne, pas la ligne.
 *
 * Le défilement se clampe tout seul sur la course disponible — vides de tête
 * et de queue compris. C'est ce clamp qui fabrique le vide de bout de série :
 * la dernière vignette atteint sa ligne de pose, et sous elle il n'y a plus
 * que la queue.
 */
export function pinThumb(col: HTMLElement, item: HTMLElement, dir: 1 | -1) {
  const reserve = colLeadReserve(col);
  const c = col.getBoundingClientRect();
  const r = item.getBoundingClientRect();
  const delta =
    dir === 1
      ? Math.min(Math.max(0, r.bottom - (c.bottom - reserve)), r.top - c.top)
      : Math.max(Math.min(0, r.top - (c.top + reserve)), r.bottom - c.bottom);
  col.scrollTop += delta;
}

/**
 * Cadence clavier. NAV_MIN_INTERVAL_MS borne le coût d'une touche MAINTENUE
 * (répétition système ~30/s — autant de requêtes 1600 px et de re-renders
 * sans borne) tout en restant sous le tapotement humain le plus rapide
 * (~10-12/s) : aucun tap volontaire n'est avalé.
 *
 * Le vol d'échange ACCÉLÈRE avec le rythme : sa durée = l'intervalle entre
 * les deux derniers taps, bornée [SWAP_MIN_DUR, DUR.swap]. Jamais de pas
 * « instantané » qui sauterait l'animation (décision Alexandre 2026-08-22 —
 * la première version skippait les vols dès qu'on accélérait à peine).
 * Plancher 0,22 s : le vol reste lisible comme un mouvement (décision
 * Alexandre, même date).
 */
export const NAV_MIN_INTERVAL_MS = 80;
export const SWAP_MIN_DUR = 0.22;

/**
 * Plancher de durée d'un CHANGEMENT DE SÉRIE. Même doctrine que
 * SWAP_MIN_DUR : la transition accélère avec le rythme des demandes, elle
 * n'est jamais sautée. 0,3 s garde le même rapport au plafond que 0,22 s sur
 * un échange de 0,45 s — le vol reste lisible comme un mouvement.
 */
export const SWITCH_MIN_DUR = 0.3;

export type Captured = {
  layer: GhostLayer;
  colGhosts: HTMLImageElement[];
  centerGhost: HTMLImageElement | null;
};

export type Pending =
  | { type: 'open' }
  | { type: 'close'; from: PreparedSeries }
  | { type: 'switch' };

/**
 * Chaîne d'échanges au clavier : une suite de vols de swap enchaînés SANS
 * jamais repasser par l'état posé entre deux. Le maillon central : le clone
 * qui couvre le centre à la fin d'un vol devient (recopié) le clone SORTANT
 * du vol suivant — on ne dépend donc JAMAIS du décodage de l'image réelle
 * pendant la chaîne, le raccord (whenSettled + handoff) n'a lieu qu'une
 * fois, à la toute fin. Un clone déjà volé n'est jamais RÉUTILISÉ pour un
 * second vol : ses transforms composeraient faux — on en recrée un,
 * pixel-identique, à sa position courante.
 */
export type SwapChain = {
  layer: GhostLayer;
  /** Clone posé sur le centre (résultat du dernier vol). */
  centerGhost: HTMLImageElement | null;
  /** Vignette réelle masquée (source du clone central). */
  hiddenThumb: Element | null;
  /** Vol en l'air (null = en traîne : raccord/fondu de fin). */
  tl: gsap.core.Timeline | null;
  /** Index où la chaîne SE REND (dernier vol parti ou cible en attente). */
  headIndex: number;
  /**
   * Cible en attente, ÉCRASÉE par chaque nouveau tap (politique « retarget »,
   * décidée par Alexandre le 2026-08-22 après essai des trois candidates sur
   * pages de test) : quand on tape plus vite que le vol plancher, le vol
   * suivant file DIRECTEMENT vers la dernière photo demandée — l'affichage ne
   * prend jamais de retard sur le doigt, les intermédiaires sont sautées.
   * Les deux politiques écartées (file complète, cadence plafonnée) sont
   * archivées, fonctionnelles et annotées, dans
   * FREELANCE/RESOURCES/existing-components/series-swap-overdrive-policies/.
   */
  pending: number | null;
  /** Changement de série demandé pendant la chaîne : joué après la traîne. */
  pendingSwitch: { dir: 1 | -1; entry: 'first' | 'last' } | null;
  /** Durée du prochain vol (suit le rythme des taps). */
  nextDur: number;
  /** Invalidation des continuations asynchrones de traîne. */
  epoch: number;
};

/**
 * Chaîne de CHANGEMENTS DE SÉRIE — transposition stricte de la chaîne
 * d'échanges de photos ci-dessus (demande Alexandre du 2026-08-22, qui
 * remplace la règle « un changement de série est bloquant » décidée la
 * veille : on n'attend plus la fin de la transition pour enchaîner).
 *
 * Les trois mêmes principes :
 *   1. un vol commencé se joue EN ENTIER — il ACCÉLÈRE (timeScale), il n'est
 *      jamais coupé ;
 *   2. politique « retarget » : une demande pendant un vol ÉCRASE la cible en
 *      attente — on file droit à la dernière série demandée, les
 *      intermédiaires sont sautées ;
 *   3. le raccord clone → réel n'a lieu qu'UNE fois, à la fin de la traîne.
 *      Conséquence directe : le CENTRE est cloné lui aussi. Avant la chaîne,
 *      l'image centrale réelle se révélait pendant le vol, ce qui obligeait à
 *      attendre son fichier (`preloadCapped`, jusqu'à 350 ms) avant même de
 *      jouer — exactement le temps mort qu'on supprime ici.
 */
export type SwitchChain = {
  /** Couche des clones de COUVERTURE (z 61, au-dessus des sortants). */
  layer: GhostLayer;
  /** Clones posés sur la colonne à l'issue du dernier vol. */
  cover: HTMLImageElement[];
  /** Clone posé sur l'image centrale. */
  centerGhost: HTMLImageElement | null;
  /** Couche des sortants du vol en cours (1er vol : clones du réel). */
  outLayer: GhostLayer | null;
  /**
   * Un vol a déjà couvert l'écran de clones. Décide qui fournit les SORTANTS
   * du prochain vol : le réel (faux — capture avant le re-render) ou la
   * couverture (vrai — recopie). La chaîne existe avant son premier vol, ce
   * booléen est donc le seul test valable.
   */
  started: boolean;
  /** Vol en l'air (null = en traîne : raccord/fondu de fin). */
  tl: gsap.core.Timeline | null;
  /** Série où la chaîne SE REND (dernier vol parti ou cible en attente). */
  headSlug: string;
  /** Cible en attente, ÉCRASÉE par chaque nouvelle demande (retarget). */
  pending: { slug: string; index: number } | null;
  /** Durée du prochain vol (suit le rythme des demandes). */
  nextDur: number;
  /** Invalidation des continuations asynchrones de traîne. */
  epoch: number;
};
