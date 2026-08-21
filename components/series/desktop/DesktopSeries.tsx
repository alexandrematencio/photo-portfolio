'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import gsap from 'gsap';
import type { PreparedSeries } from '@/lib/site/series';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { cn } from '@/lib/utils/cn';
import { centerSrcFor } from '../shared/photoSrc';
import { FolderStack } from './FolderStack';
import { OpenSeriesView } from './OpenSeriesView';
import {
  DUR,
  HANDOFF_DELAY,
  STAGGER,
  createGhostLayer,
  fadeOutLayer,
  flyCrossing,
  flyCurved,
  flyOutRight,
  isOnScreen,
  preloadCapped,
  rectOf,
  whenSettled,
  spawnGhost,
  type Flight,
  type GhostLayer,
} from './animations';

/**
 * Orchestration desktop de /series (spec §5).
 *
 * Machine à phases : closed → opening → open → (switching → open)* → closing
 * → closed. Les deux états (rangée / vue ouverte) sont des mises en page CSS
 * superposées (absolute inset-0) ; les gestes animent des clones — voir le
 * préambule d'animations.ts pour la justification de cet écart avec la démo.
 *
 * `displayed` = ce que la vue ouverte MONTRE ; `openSeries` (prop) = la
 * cible. Les effets réconcilient l'un vers l'autre en jouant l'animation
 * qui correspond. Pendant un vol, toute interaction est ignorée
 * (`animating`) — les fantômes vivent ≤ 0,8 s.
 */

type Phase = 'closed' | 'opening' | 'open' | 'closing' | 'switching';

/**
 * Durée du glissement du footer. Court exprès : le footer n'est pas un
 * événement de la page, c'est la butée de fin de rangée qui se montre. Assez
 * long pour ne pas claquer, assez court pour ne pas se faire remarquer.
 */
const FOOTER_REVEAL_DUR = 0.26;

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
const NAV_MIN_INTERVAL_MS = 80;
const SWAP_MIN_DUR = 0.22;

type Captured = {
  layer: GhostLayer;
  colGhosts: HTMLImageElement[];
  centerGhost: HTMLImageElement | null;
};

type Pending =
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
type SwapChain = {
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

export function DesktopSeries({
  series,
  openSeries,
  activeIndex,
  hydrated,
  initialSlug,
  onOpen,
  onClose,
  onSelectPhoto,
}: {
  series: PreparedSeries[];
  openSeries: PreparedSeries | null;
  activeIndex: number;
  hydrated: boolean;
  initialSlug: string | null;
  onOpen: (slug: string, photoIndex?: number) => void;
  onClose: () => void;
  onSelectPhoto: (index: number) => void;
}) {
  const sceneRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [displayed, setDisplayed] = useState<PreparedSeries | null>(null);
  const [phase, setPhase] = useState<Phase>('closed');
  const animating = useRef(false);
  const firstTransition = useRef(true);
  const pendingRef = useRef<Pending | null>(null);
  const capturedRef = useRef<Captured | null>(null);
  const reduced = useReducedMotion();
  // Chaîne d'échanges clavier en cours (voir le type SwapChain). Pendant sa
  // vie, `animating` reste vrai (clics et molette gelés comme pour tout vol),
  // mais le CLAVIER, lui, continue d'être admis selon la politique.
  const chainRef = useRef<SwapChain | null>(null);
  // Index LOGIQUE : là où l'UI est ou SE REND (cible du vol en cours). Le
  // clavier raisonne dessus — la prop `activeIndex`, elle, a un re-render de
  // retard quand un vol vient d'être committé dans le même tick.
  const indexRef = useRef(activeIndex);
  // Dernière version de goToSeries, pour les continuations asynchrones de la
  // chaîne (pendingSwitch joué à la fin de la traîne).
  const goToSeriesRef = useRef<(dir: 1 | -1, entry: 'first' | 'last') => void>(
    () => {}
  );
  const lastNavRef = useRef(0);
  // Cache de chauffe des images centrales (1600 px) : URLs dont le DÉCODAGE
  // est terminé (le fichier peut être en cache réseau sans être décodable à
  // temps — c'est le décodage qui garantit un échange de src sans flash).
  const hqReadyRef = useRef(new Set<string>());
  const hqWarmRef = useRef(new Map<string, Promise<boolean>>());

  /**
   * Chauffe une image centrale : téléchargement + DÉCODAGE, dé-doublonné.
   * Résout `true` seulement si l'image est réellement affichable — un échec
   * réseau ne doit jamais pousser une src cassée dans un clone.
   */
  const warmHq = useCallback((src: string): Promise<boolean> => {
    if (!src) return Promise.resolve(false);
    if (hqReadyRef.current.has(src)) return Promise.resolve(true);
    let p = hqWarmRef.current.get(src);
    if (!p) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      p = img
        .decode()
        .then(() => {
          hqReadyRef.current.add(src);
          return true;
        })
        .catch(() => false);
      hqWarmRef.current.set(src, p);
    }
    return p;
  }, []);
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
    []
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
  }, [scrollContainer]);

  // La prop reste la source de vérité ; les commits éagers (vol interrompu,
  // goToSeries) ne font que prendre de l'avance d'un tick sur elle.
  useEffect(() => {
    indexRef.current = activeIndex;
  }, [activeIndex]);

  // Préchargement des VOISINES (±1) quand la vue est posée sur une photo — le
  // pattern lightbox de §3.4, enfin branché. Le cas courant (un tap isolé)
  // trouve alors son 1600 px déjà décodé : le clone entrant part net, sans
  // passage par la vignette agrandie. Pendant une chaîne d'échanges, l'effet
  // se tient à l'écart (les commits défilent trop vite, et les préchargements
  // concurrenceraient les centres en cours de route) — la fin de traîne fait
  // sa propre chauffe.
  useEffect(() => {
    if (phase !== 'open' || !displayed) return;
    if (sceneRef.current?.offsetParent === null) return; // branche cachée
    if (chainRef.current) return;
    for (const i of [activeIndex + 1, activeIndex - 1]) {
      const photo = displayed.photos[i];
      if (photo) void warmHq(centerSrcFor(photo));
    }
  }, [phase, displayed, activeIndex, warmHq]);

  /**
   * Colonne de vignettes : en haut par défaut, défilée pour montrer la
   * vignette active quand l'entrée dans la série ne se fait pas sur la
   * première photo (navigation clavier arrivant sur la dernière). Appelée
   * AVANT la mesure des vols d'un switch — défiler APRÈS enverrait les clones
   * se poser sur des rects périmés, la colonne héritant du scroll de
   * l'ancienne série (DOM réutilisé) — et après un passage instantané.
   */
  const settleColScroll = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const col = scene.querySelector<HTMLElement>('[data-open-col]');
    if (!col) return;
    col.scrollTop = 0;
    const item = scene.querySelector<HTMLElement>(
      '[data-col-item][aria-current]'
    );
    if (!item) return;
    const r = item.getBoundingClientRect();
    const top = r.top - col.getBoundingClientRect().top;
    if (top + r.height > col.clientHeight) {
      col.scrollTop = top - (col.clientHeight - r.height) / 2;
    }
  }, []);

  /**
   * Ajustement MINIMAL de la colonne pour rendre la vignette `i` visible —
   * appelé AVANT la mesure d'un vol de chaîne (une vignette hors écran n'a
   * pas de rect exploitable). Par index et non par aria-current : le commit
   * React du nouvel index n'a pas encore peint au moment de la mesure. Pas
   * de scrollIntoView : il pourrait défiler AUSSI le conteneur de page — qui
   * ne doit jamais bouger tout seul (invariant 14).
   */
  const keepThumbVisible = useCallback((i: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const col = scene.querySelector<HTMLElement>('[data-open-col]');
    const item = scene.querySelector<HTMLElement>(`[data-col-item="${i}"]`);
    if (!col || !item) return;
    const c = col.getBoundingClientRect();
    const r = item.getBoundingClientRect();
    if (r.bottom > c.bottom) col.scrollTop += r.bottom - c.bottom;
    else if (r.top < c.top) col.scrollTop -= c.top - r.top;
  }, []);

  // ── Sélecteurs DOM (points de mesure des vols) ────────────────────────────

  const q = useCallback(<T extends Element>(sel: string): T | null => {
    return sceneRef.current?.querySelector<T>(sel) ?? null;
  }, []);

  const pileImg = useCallback(
    (slug: string, photoId: string) =>
      q<HTMLImageElement>(`[data-stack="${slug}"] [data-pile-item="${photoId}"]`),
    [q]
  );

  const colImg = useCallback(
    (i: number) => q<HTMLImageElement>(`[data-col-img="${i}"]`),
    [q]
  );

  // ── Réconciliation displayed ← openSeries ────────────────────────────────

  useEffect(() => {
    const prev = displayed;
    const target = openSeries;
    if ((prev?.slug ?? null) === (target?.slug ?? null)) return;

    // Arrivée par ancre (lien partagé), mouvement réduit, ou branche cachée
    // (viewport mobile : le CSS masque cette branche mais elle reste montée —
    // spec §4) : pas de vol, on saute directement à l'état cible.
    const hidden = sceneRef.current?.offsetParent === null;
    const instant =
      reduced ||
      hidden ||
      (firstTransition.current && target?.slug === initialSlug);
    firstTransition.current = false;

    if (instant) {
      // Pas de vol ici, donc rien à compenser : il suffit que la page soit à
      // plat pour que la vue ouverte se pose au bon endroit.
      if (target) flattenPage();
      setDisplayed(target);
      setPhase(target ? 'open' : 'closed');
      // Après le re-render : colonne posée sur la vignette active — un
      // passage instantané peut arriver sur la DERNIÈRE photo (clavier en
      // mouvement réduit, entrée à reculons).
      if (target) requestAnimationFrame(() => settleColScroll());
      return;
    }

    if (!prev && target) {
      pendingRef.current = { type: 'open' };
      setDisplayed(target);
      setPhase('opening');
    } else if (prev && !target) {
      // La vue reste rendue (displayed inchangé) : les clones seront pris
      // dans le layout effect, sur un DOM encore intact.
      pendingRef.current = { type: 'close', from: prev };
      setPhase('closing');
    } else if (prev && target) {
      // Capturer l'ANCIENNE colonne MAINTENANT, avant que React ne re-rende
      // la vue avec la nouvelle série.
      capturedRef.current = captureOpenGhosts(sceneRef.current);
      pendingRef.current = { type: 'switch' };
      setDisplayed(target);
      setPhase('switching');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSeries?.slug, reduced]);

  // ── Exécution des vols (pré-paint : useLayoutEffect) ─────────────────────

  useLayoutEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    const scene = sceneRef.current;
    if (!scene) return;
    animating.current = true;

    if (pending.type === 'open' && displayed) {
      // AVANT toute mesure : page à plat, rangée compensée. Voir flattenPage.
      flattenPage();
      runOpen(scene, displayed, () => {
        // La rangée est masquée dès `open` (invariant 12) : le transform de
        // compensation n'a plus de raison d'être et ne doit pas survivre à une
        // fermeture, qui repose sur les rects réels des piles.
        if (rowRef.current) gsap.set(rowRef.current, { y: 0 });
        setPhase('open');
        animating.current = false;
      });
    } else if (pending.type === 'close') {
      runClose(scene, pending.from, () => {
        setDisplayed(null);
        setPhase('closed');
        animating.current = false;
      });
    } else if (pending.type === 'switch' && displayed) {
      runSwitch(scene, capturedRef.current, displayed, () => {
        capturedRef.current = null;
        setPhase('open');
        animating.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Les quatre vols ───────────────────────────────────────────────────────

  function captureOpenGhosts(scene: HTMLElement | null): Captured | null {
    if (!scene) return null;
    const layer = createGhostLayer();
    const colGhosts: HTMLImageElement[] = [];
    scene
      .querySelectorAll<HTMLImageElement>('[data-col-img]')
      .forEach((img) => {
        const r = rectOf(img);
        if (r && isOnScreen(r)) colGhosts.push(spawnGhost(layer, img, r));
      });
    const centerImg = scene.querySelector<HTMLImageElement>('[data-center-img]');
    const centerRect = rectOf(centerImg);
    const centerGhost =
      centerImg && centerRect ? spawnGhost(layer, centerImg, centerRect) : null;
    return { layer, colGhosts, centerGhost };
  }

  function runOpen(scene: HTMLElement, target: PreparedSeries, done: () => void) {
    const layer = createGhostLayer();
    const left = q('[data-open-left]');
    const centerWrap = q('[data-center-wrap]');
    const colItems = scene.querySelectorAll('[data-col-item]');
    const stack = q(`[data-stack="${target.slug}"]`);
    const otherStacks = scene.querySelectorAll(
      `[data-stack]:not([data-stack="${target.slug}"])`
    );

    // Vue ouverte invisible le temps du vol — pré-paint, donc aucun flash.
    gsap.set([left, centerWrap, ...colItems].filter(Boolean), { autoAlpha: 0 });

    const flights: Flight[] = [];
    let coverFlight: Flight | null = null;
    const centerRect = rectOf(q('[data-center-img]'));

    // Boîte de la cover : point de départ de secours. La pile est plafonnée à
    // 5 vignettes (coût de chargement, cf. FolderStack) ; au-delà, une photo
    // n'a AUCUN élément source. Sans ce repli, sa vignette de colonne ne volait
    // pas — elle apparaissait simplement au raccord, rompant la continuité du
    // geste dès qu'une série dépasse 5 photos visibles.
    const coverPileRect = rectOf(pileImg(target.slug, target.cover._id));

    target.photos.forEach((photo, i) => {
      const pile = pileImg(target.slug, photo._id);
      const pileRect = rectOf(pile);
      if (pile && pileRect && photo._id === target.cover._id && centerRect) {
        coverFlight = {
          ghost: spawnGhost(layer, pile, pileRect),
          from: pileRect,
          to: centerRect,
        };
      }
      const col = colImg(i);
      const to = rectOf(col);
      if (!col || !to || !isOnScreen(to)) return;
      // Source : la vignette de pile si elle existe, sinon la boîte de la
      // cover — l'image clonée vient alors de la colonne (déjà chargée), seule
      // la POSITION de départ est empruntée à la pile.
      const from = pileRect ?? coverPileRect;
      const srcEl = pile ?? col;
      if (!from) return;
      flights.push({ ghost: spawnGhost(layer, srcEl, from), from, to });
    });

    // La pile réelle disparaît à l'instant où ses clones prennent le relais.
    if (stack) gsap.set(stack, { autoAlpha: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        // Garde anti-flash : ne révéler le réel (et retirer les clones posés
        // dessus) qu'une fois centre + vignettes visibles décodés.
        const settleImgs: (HTMLImageElement | null)[] = [
          q<HTMLImageElement>('[data-center-img]'),
        ];
        scene
          .querySelectorAll<HTMLImageElement>('[data-col-img]')
          .forEach((img) => {
            const r = rectOf(img);
            if (r && isOnScreen(r)) settleImgs.push(img);
          });
        void whenSettled(settleImgs).then(() => {
          gsap.set([left, centerWrap, ...colItems].filter(Boolean), {
            autoAlpha: 1,
          });
          // Les vignettes réelles portent une transition-opacity CSS (150 ms) :
          // un autoAlpha "instantané" fond quand même. Les clones restent donc
          // INTACTS le temps de ce fondu (HANDOFF_DELAY) — deux fondus
          // simultanés creusaient la couverture à ~85 % au croisement, tout le
          // fond transparaissait d'un coup (blink mesuré, bug réel signalé).
          fadeOutLayer(layer, { delay: HANDOFF_DELAY, onComplete: done });
        });
      },
      paused: true,
    });
    tl.to(otherStacks, { autoAlpha: 0, y: 8, duration: DUR.fade }, 0);
    flyCurved(tl, flights, { duration: DUR.open, at: 0 });
    if (coverFlight) flyCurved(tl, [coverFlight], { duration: DUR.open, at: 0.04 });
    if (left) tl.to(left, { autoAlpha: 1, duration: DUR.fade }, DUR.open - 0.35);

    // Mesures faites (sync, pré-paint) ; seul le DÉPART attend brièvement le
    // fichier de l'image centrale, pour que le raccord clone → réel soit net.
    const centerSrc = q<HTMLImageElement>('[data-center-img]')?.src ?? '';
    void preloadCapped(centerSrc).then(() => tl.play());
  }

  function runClose(scene: HTMLElement, from: PreparedSeries, done: () => void) {
    const captured = captureOpenGhosts(scene);
    const row = rowRef.current;
    const left = q('[data-open-left]');
    const centerWrap = q('[data-center-wrap]');
    const col = q('[data-open-col]');
    const stack = q(`[data-stack="${from.slug}"]`);
    const otherStacks = scene.querySelectorAll(
      `[data-stack]:not([data-stack="${from.slug}"])`
    );

    gsap.set([left, centerWrap, col].filter(Boolean), { autoAlpha: 0 });
    if (row) gsap.set(row, { autoAlpha: 1 });
    gsap.set(otherStacks, { autoAlpha: 0, y: 8 });
    if (stack) gsap.set(stack, { autoAlpha: 1 });
    // Les vignettes réelles de la pile restent cachées : les clones se posent dessus.
    const pileItems = stack
      ? stack.querySelectorAll<HTMLImageElement>('[data-pile-item]')
      : [];
    gsap.set(pileItems, { autoAlpha: 0 });

    const flights: Flight[] = [];
    let centerFlight: Flight | null = null;
    if (captured) {
      // Miroir de l'ouverture : repli sur la boîte de la cover pour les photos
      // au-delà du plafond de 5 vignettes de pile. Sans lui, leurs clones
      // n'avaient AUCUN vol — ils restaient plantés à leur place le temps de la
      // fermeture puis disparaissaient (mesuré : 3 clones immobiles sur une
      // série de 13). Le repli ne peut pas manquer : la cover est toujours dans
      // la pile, par construction.
      const coverTo = rectOf(pileImg(from.slug, from.cover._id));
      // L'ordre de capture suit les [data-col-img] À L'ÉCRAN, dans l'ordre du
      // DOM. On saute donc ici sur le MÊME critère (hors écran) et rien
      // d'autre, sinon clones et photos se désalignent.
      let g = 0;
      from.photos.forEach((photo, i) => {
        const src = colImg(i);
        const fromRect = rectOf(src);
        if (!fromRect || !isOnScreen(fromRect)) return;
        const to = rectOf(pileImg(from.slug, photo._id)) ?? coverTo;
        const ghost = captured.colGhosts[g++];
        if (ghost && to) flights.push({ ghost, from: fromRect, to });
      });
      const centerFrom = rectOf(q('[data-center-img]'));
      if (captured.centerGhost && coverTo && centerFrom) {
        centerFlight = { ghost: captured.centerGhost, from: centerFrom, to: coverTo };
      }
    }

    const tl = gsap.timeline({
      onComplete: () => {
        // clearProps CIBLÉS : 'all' effacerait aussi les styles inline posés
        // par React (padding de la rangée — bug réel : rangée collée au bord
        // après fermeture — et transform de décalage des vignettes de pile).
        // On n'efface que ce que GSAP a réellement touché sur chaque cible.
        gsap.set(pileItems, { clearProps: 'opacity,visibility' });
        if (stack) gsap.set(stack, { clearProps: 'opacity,visibility' });
        gsap.set(otherStacks, { clearProps: 'opacity,visibility,transform' });
        if (row) gsap.set(row, { clearProps: 'opacity,visibility' });
        // Fondu, pas suppression sèche : la pile réelle vient d'être révélée
        // sous les clones, on les dissout par-dessus (même raison qu'à
        // l'ouverture — l'écart de recadrage ne doit jamais se voir couper).
        if (captured) fadeOutLayer(captured.layer, { onComplete: done });
        else done();
      },
    });
    // Le `tl.reverse()` de la démo 4, reconstruit : même courbe à rebours
    // (descente d'abord, glissade ensuite) ET cascade inversée — flyCurved
    // s'en charge via `direction: 'close'`. Le centre, appelé à part, part
    // dès t=0 (miroir du vol de cover de l'ouverture, posé à 0.04).
    flyCurved(tl, flights, { duration: DUR.close, direction: 'close', at: 0 });
    if (centerFlight) {
      flyCurved(tl, [centerFlight], { duration: DUR.close, direction: 'close', at: 0 });
    }
    tl.to(otherStacks, { autoAlpha: 1, y: 0, duration: DUR.fade }, DUR.close - 0.3);
  }

  function runSwitch(
    scene: HTMLElement,
    captured: Captured | null,
    target: PreparedSeries,
    done: () => void
  ) {
    const layer = createGhostLayer();
    const centerWrap = q('[data-center-wrap]');
    const colItems = scene.querySelectorAll('[data-col-item]');
    gsap.set([centerWrap, ...colItems].filter(Boolean), { autoAlpha: 0 });

    // Colonne posée AVANT toute mesure (voir settleColScroll).
    settleColScroll();

    // Point d'apparition : la POSITION DE LA SÉRIE au moment du clic — son
    // nom dans la colonne de gauche (seule incarnation visible de la série en
    // vue ouverte). Les photos en jaillissent, glissent le long de l'horizon
    // et remontent en colonne (même chemin que l'ouverture). Repli coin
    // bas-gauche si le bouton est introuvable.
    const sceneRect = scene.getBoundingClientRect();
    const nameBtn = scene.querySelector(
      '[data-open-left] button[aria-current]'
    );
    const nameRect = rectOf(nameBtn);
    const spawnW = 110;
    const spawnH = 82;
    const baseX = nameRect ? nameRect.left : sceneRect.left + 40;
    const baseY = nameRect
      ? nameRect.top + nameRect.height / 2 - spawnH / 2
      : sceneRect.bottom - spawnH - 24;
    const flights: Flight[] = [];
    target.photos.forEach((photo, i) => {
      const to = rectOf(colImg(i));
      if (!to || !isOnScreen(to)) return;
      const img = colImg(i);
      if (!img) return;
      const from = new DOMRect(
        baseX + Math.min(i, 4) * 3,
        baseY + Math.min(i, 4) * 2,
        spawnW,
        spawnH
      );
      const ghost = spawnGhost(layer, img, from);
      ghost.style.opacity = '0';
      flights.push({ ghost, from, to });
    });

    const tl = gsap.timeline({
      onComplete: () => {
        const settleImgs: (HTMLImageElement | null)[] = [
          q<HTMLImageElement>('[data-center-img]'),
        ];
        scene
          .querySelectorAll<HTMLImageElement>('[data-col-img]')
          .forEach((img) => {
            const r = rectOf(img);
            if (r && isOnScreen(r)) settleImgs.push(img);
          });
        void whenSettled(settleImgs).then(() => {
          gsap.set([centerWrap, ...colItems].filter(Boolean), { autoAlpha: 1 });
          // Même garde anti-clignotement que runOpen : couvrir le fondu CSS.
          // La couche capturée (ancienne série) est déjà sortie par la droite,
          // on la retire sans fondu supplémentaire ; seule la couche entrante
          // se dissout par-dessus le réel, une fois son fondu CSS terminé.
          captured?.layer.destroy();
          fadeOutLayer(layer, { delay: HANDOFF_DELAY, onComplete: done });
        });
      },
      paused: true,
    });
    if (captured) {
      flyOutRight(tl, captured.colGhosts, { at: 0 });
      if (captured.centerGhost) {
        tl.to(captured.centerGhost, { autoAlpha: 0, duration: DUR.fade }, 0);
      }
    }
    // Fondu d'apparition calé sur la cascade des vols (même STAGGER).
    flights.forEach(({ ghost }, i) =>
      tl.to(ghost, { opacity: 1, duration: 0.12 }, 0.12 + i * STAGGER)
    );
    flyCurved(tl, flights, { duration: DUR.switch, at: 0.12 });
    if (centerWrap) {
      tl.fromTo(
        centerWrap,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: DUR.fade },
        0.25
      );
    }
    const centerSrc = q<HTMLImageElement>('[data-center-img]')?.src ?? '';
    void preloadCapped(centerSrc).then(() => tl.play());
  }

  // ── Chaîne d'échanges clavier (voir le type SwapChain) ───────────────────

  /**
   * Rect prédit de l'image centrale pour une photo de ratio donné — même
   * règle que le CSS d'OpenSeriesView (width = min(100%, maxH × ratio),
   * maxHeight, flex center). maxH réplique CENTER_MAX_H (100dvh − 300px) :
   * ne PAS mesurer l'image courante à la place, sa hauteur dépend de SON
   * ratio et fausserait la prédiction pour la suivante.
   */
  function predictCenterRect(cellRect: DOMRect, ratio: number): DOMRect {
    const maxH = Math.min(cellRect.height, window.innerHeight - 300);
    let w = Math.min(cellRect.width, maxH * ratio);
    let h = w / ratio;
    if (h > cellRect.height) {
      h = cellRect.height;
      w = h * ratio;
    }
    return new DOMRect(
      cellRect.left + (cellRect.width - w) / 2,
      cellRect.top + (cellRect.height - h) / 2,
      w,
      h
    );
  }

  /**
   * Point d'entrée unique d'un échange de photo (clavier comme clic de
   * vignette). Chaîne inexistante → nouveau vol (si rien d'autre n'anime).
   * Vol en l'air → la cible en attente est ÉCRASÉE (retarget, cf. SwapChain)
   * et le vol en cours ACCÉLÈRE (timeScale), il n'est jamais coupé. Traîne de
   * fin → reprise directe de la chaîne.
   */
  function requestSwapTo(toIndex: number, dur: number) {
    const chain = chainRef.current;
    if (!chain) {
      // Ouverture / fermeture / switch en cours : on laisse finir.
      if (animating.current) return;
      if (toIndex === indexRef.current) return;
      startChain(toIndex, dur);
      return;
    }
    if (chain.pendingSwitch) return; // on quitte déjà la série
    chain.nextDur = dur;
    chain.headIndex = toIndex;
    if (chain.tl) {
      chain.pending = toIndex; // écrase : on file droit à la dernière demandée
      chain.tl.timeScale(Math.min(3, chain.tl.timeScale() * 1.6));
    } else {
      chainResume(chain, toIndex);
    }
  }

  function startChain(toIndex: number, dur: number) {
    if (!sceneRef.current || !displayed) return;
    animating.current = true;
    const chain: SwapChain = {
      layer: createGhostLayer(),
      centerGhost: null,
      hiddenThumb: null,
      tl: null,
      headIndex: toIndex,
      pending: null,
      pendingSwitch: null,
      nextDur: dur,
      epoch: 0,
    };
    chainRef.current = chain;
    chainFlight(chain, toIndex);
  }

  /**
   * Reprise depuis la traîne : le fondu de la couche est tué (opacité
   * restaurée — les clones doivent recouvrir à 100 %), les continuations en
   * attente invalidées (epoch), le centre re-masqué s'il avait été révélé.
   */
  function chainResume(chain: SwapChain, toIndex: number) {
    chain.epoch++;
    gsap.killTweensOf(chain.layer.el);
    chain.layer.el.style.opacity = '1';
    gsap.set(q('[data-center-wrap]'), { autoAlpha: 0 });
    chainFlight(chain, toIndex);
  }

  function chainFlight(chain: SwapChain, toIndex: number) {
    chain.epoch++;
    const fromIndex = indexRef.current;
    // Commit à l'ENVOL : la src du centre part charger/décoder PENDANT le vol
    // (le raccord de fin n'attendra presque rien), la vignette active suit le
    // tap. Le réel reste masqué toute la vie de la chaîne, seuls les clones
    // sont visibles au centre.
    indexRef.current = toIndex;
    onSelectPhoto(toIndex);
    // La vignette cible doit être VISIBLE avant la mesure (hors écran → pas
    // de rect exploitable).
    keepThumbVisible(toIndex);

    const photo = displayed?.photos[toIndex];
    const inThumb = colImg(toIndex);
    const cellRect = rectOf(q('[data-open-center]'));
    const inRect = rectOf(inThumb);
    if (!photo || !inThumb || !cellRect || !inRect) {
      // Pas de vol possible (résilience) : droit à la traîne — l'état est
      // committé, le raccord révélera le réel.
      chainTail(chain);
      return;
    }
    const ratio = photo.image?.dimensions?.aspectRatio ?? 4 / 3;
    const predicted = predictCenterRect(cellRect, ratio);

    // Clone SORTANT : recopie du clone central à sa position courante — un
    // clone déjà volé n'est JAMAIS réutilisé pour un second vol, ses
    // transforms composeraient faux (flyCrossing pose x/y/scale relatifs au
    // rect d'apparition). Premier vol de la chaîne : clone de l'image réelle,
    // puis le centre réel est masqué sous lui.
    const prevGhost = chain.centerGhost;
    const centerSrcEl = prevGhost ?? q<HTMLImageElement>('[data-center-img]');
    const centerRect = rectOf(centerSrcEl);
    let outGhost: HTMLImageElement | null = null;
    if (centerSrcEl && centerRect) {
      outGhost = spawnGhost(chain.layer, centerSrcEl, centerRect);
    }
    if (prevGhost) prevGhost.remove();
    else gsap.set(q('[data-center-wrap]'), { autoAlpha: 0 });

    const prevHidden = chain.hiddenThumb;
    const inGhost = spawnGhost(
      chain.layer,
      inThumb.querySelector('img') ?? (inThumb as unknown as HTMLImageElement),
      inRect
    );
    // Netteté du clone entrant : il part de la MEILLEURE source disponible —
    // le 1600 px s'il est déjà décodé (préchargement des voisines), la
    // vignette 280 px sinon — et s'affine dès que le 1600 px est décodé, sans
    // attendre la traîne. L'échange de src d'un <img> garde l'ancienne image
    // affichée jusqu'au décodage de la nouvelle (invariant 9) : la montée en
    // netteté est sans flash. Sur réseau lent, la vignette reste visible le
    // temps que les octets arrivent — irréductible — mais plus jamais
    // « pixellisé jusqu'au raccord final ».
    const hqSrc = centerSrcFor(photo);
    if (hqSrc) {
      if (hqReadyRef.current.has(hqSrc)) {
        inGhost.src = hqSrc;
      } else {
        void warmHq(hqSrc).then((ok) => {
          if (ok && inGhost.isConnected) inGhost.src = hqSrc;
        });
      }
    }
    gsap.set(inThumb, { autoAlpha: 0 });
    chain.hiddenThumb = inThumb;
    chain.centerGhost = inGhost;

    const outTo = rectOf(colImg(fromIndex));
    const dur = chain.nextDur;
    const tl = gsap.timeline({
      onComplete: () => {
        chain.tl = null;
        // La vignette de la photo sortante remonte SOUS son clone posé, qui
        // fond ensuite — séquencé (HANDOFF_DELAY), jamais croisé : la
        // transition CSS de la vignette dure 150 ms.
        if (prevHidden) {
          gsap.set(prevHidden, { clearProps: 'opacity,visibility' });
        }
        if (outGhost) {
          gsap.to(outGhost, {
            autoAlpha: 0,
            delay: HANDOFF_DELAY,
            duration: 0.15,
            onComplete: () => outGhost.remove(),
          });
        }
        const next = chain.pending;
        chain.pending = null;
        if (next !== null) chainFlight(chain, next);
        else chainTail(chain);
      },
    });
    const flights: Flight[] = [];
    if (outGhost && centerRect) {
      if (outTo && isOnScreen(outTo)) {
        flights.push({ ghost: outGhost, from: centerRect, to: outTo });
      } else {
        // Vignette de retour hors écran : simple fondu du clone sortant.
        gsap.to(outGhost, { autoAlpha: 0, duration: dur * 0.6 });
      }
    }
    flights.push({ ghost: inGhost, from: inRect, to: predicted });
    flyCrossing(tl, flights, { duration: dur });
    chain.tl = tl;
  }

  /**
   * Traîne de fin de chaîne — le SEUL raccord clone → réel de toute la
   * chaîne : décodage du 1600 px du centre, reveal, puis fondu de la couche
   * par-dessus (même séquence anti-blink que partout, HANDOFF_DELAY). Un
   * changement de série demandé pendant la chaîne part une fois posée.
   */
  function chainTail(chain: SwapChain) {
    const myEpoch = ++chain.epoch;
    const centerImg = q<HTMLImageElement>('[data-center-img]');
    void whenSettled([centerImg], 4000).then(() => {
      if (chainRef.current !== chain || chain.epoch !== myEpoch) return;
      gsap.set([q('[data-center-wrap]'), chain.hiddenThumb].filter(Boolean), {
        clearProps: 'opacity,visibility',
      });
      fadeOutLayer(chain.layer, {
        delay: HANDOFF_DELAY,
        onComplete: () => {
          if (chainRef.current !== chain) return;
          chainRef.current = null;
          animating.current = false;
          const ps = chain.pendingSwitch;
          if (ps) {
            goToSeriesRef.current(ps.dir, ps.entry);
            return;
          }
          // Fin de chaîne : chauffe des voisines de la photo posée — l'effet
          // de préchargement s'est tenu à l'écart pendant la chaîne.
          for (const i of [indexRef.current + 1, indexRef.current - 1]) {
            const p = displayed?.photos[i];
            if (p) void warmHq(centerSrcFor(p));
          }
        },
      });
    });
  }

  /**
   * Pose l'état de la chaîne D'UN COUP (Échap) : clones retirés, réel révélé,
   * main rendue. Réservé à la fermeture — pour la navigation, un vol commencé
   * se joue toujours en entier.
   */
  function abortChain() {
    const chain = chainRef.current;
    if (!chain) return;
    chain.epoch++;
    chain.tl?.kill();
    gsap.killTweensOf(chain.layer.el);
    chain.layer.destroy();
    gsap.set([q('[data-center-wrap]'), chain.hiddenThumb].filter(Boolean), {
      clearProps: 'opacity,visibility',
    });
    chainRef.current = null;
    animating.current = false;
  }

  // ── Interactions ──────────────────────────────────────────────────────────

  const guard = useCallback(
    (fn: () => void) => () => {
      if (animating.current) return;
      fn();
    },
    []
  );

  function handleSelect(i: number) {
    if (reduced) {
      indexRef.current = i;
      onSelectPhoto(i);
      return;
    }
    requestSwapTo(i, DUR.swap);
  }

  // Passage de série : MÊME transition que le clic sur un nom de la colonne
  // de gauche (runSwitch via la réconciliation openSeries → displayed).
  // L'ordre est celui de la rangée (seriesOrder), cyclique. `entry` : 'last'
  // quand on entre à reculons (flèche gauche depuis la 1re photo).
  function goToSeries(dir: 1 | -1, entry: 'first' | 'last') {
    if (!displayed) return;
    const i = series.findIndex((s) => s.slug === displayed.slug);
    if (i < 0) return;
    const target = series[(i + dir + series.length) % series.length];
    const index = entry === 'last' ? Math.max(0, target.photos.length - 1) : 0;
    // Série unique : le tour cyclique retombe sur elle-même — simple échange.
    if (target.slug === displayed.slug) {
      if (index !== indexRef.current) handleSelect(index);
      return;
    }
    indexRef.current = index;
    onOpen(target.slug, index);
  }
  useEffect(() => {
    goToSeriesRef.current = goToSeries;
  });

  // Clavier en vue ouverte (spec §5 — de bout en bout) : Échap ferme, ← / →
  // reculent/avancent dans la série avec des vols ACCÉLÉRÉS au rythme des
  // taps, ↑ / ↓ passent à la série précédente / suivante (le sens suit la
  // colonne de noms : ↓ descend vers la série d'en dessous). Dépasser un bout
  // de série avec ← / → continue dans la voisine — à reculons, sur sa
  // DERNIÈRE photo. Un changement de série se joue toujours EN ENTIER,
  // touches ignorées pendant la transition, qu'importe la direction (décision
  // Alexandre 2026-08-22) ; demandé pendant une chaîne d'échanges, il part
  // dès qu'elle s'est posée.
  useEffect(() => {
    if (phase !== 'open') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Une fermeture part d'un état posé : la chaîne est posée d'un coup.
        abortChain();
        if (!animating.current) onClose();
        return;
      }
      // Branche cachée (viewport mobile) : ne jamais réagir — invariant 3.
      // (Échap reste au-dessus : l'état ouvert est partagé avec la branche
      // mobile, le fermer au clavier y est tout aussi légitime.)
      if (sceneRef.current?.offsetParent === null) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!displayed) return;
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key))
        return;
      // preventDefault même quand la touche est absorbée (cadence, politique,
      // switch en cours) : elle ne doit jamais retomber en défilement natif.
      e.preventDefault();
      const now = performance.now();
      const interval = now - lastNavRef.current;
      if (interval < NAV_MIN_INTERVAL_MS) return;
      lastNavRef.current = now;
      // Le vol SUIT le rythme : sa durée = l'intervalle entre les deux
      // derniers taps, bornée [SWAP_MIN_DUR, DUR.swap]. Jamais de pas sans
      // animation.
      const dur = Math.min(DUR.swap, Math.max(SWAP_MIN_DUR, interval / 1000));

      const chain = chainRef.current;
      // Switch / ouverture / fermeture en cours : on laisse finir.
      if (!chain && animating.current) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const dir: 1 | -1 = e.key === 'ArrowDown' ? 1 : -1;
        if (chain) chain.pendingSwitch ??= { dir, entry: 'first' };
        else goToSeries(dir, 'first');
        return;
      }

      const dir: 1 | -1 = e.key === 'ArrowRight' ? 1 : -1;
      if (chain?.pendingSwitch) return; // on quitte déjà la série
      const head = chain ? chain.headIndex : indexRef.current;
      const to = head + dir;
      if (to < 0 || to >= displayed.photos.length) {
        const entry: 'first' | 'last' = dir === 1 ? 'first' : 'last';
        if (chain) chain.pendingSwitch = { dir, entry };
        else goToSeries(dir, entry);
        return;
      }
      if (reduced) {
        indexRef.current = to;
        onSelectPhoto(to);
        keepThumbVisible(to);
        return;
      }
      requestSwapTo(to, dur);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Les fonctions de chaîne sont des fonctions de corps de composant (comme
    // runOpen/runSwitch) : les lister ferait re-souscrire à chaque render.
    // Tout ce dont elles dépendent (displayed, reduced, phase, la politique)
    // est déjà couvert par les deps ci-dessous ou stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, displayed, reduced, onClose, onSelectPhoto, keepThumbVisible]);

  // Molette verticale → défilement horizontal de la rangée (spec §5).
  //
  // Écoutée sur le CONTENEUR DE SCROLL DE LA PAGE, plus sur la seule rangée :
  // toute la surface de la page répond au geste, pas uniquement la bande de
  // piles en bas d'écran (la nav-bar, elle, est `fixed` HORS de ce conteneur —
  // elle garde donc son comportement propre). Corollaire : la page ne défile
  // plus jamais verticalement d'elle-même, c'est ce gestionnaire qui décide,
  // et le seul défilement vertical possible est la révélation du footer en
  // bout de rangée.
  //
  // Non-passive : on doit pouvoir preventDefault. Le trackpad horizontal passe
  // nativement (deltaX dominant) — on ne touche qu'au deltaY.
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

      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();

      const maxLeft = row.scrollWidth - row.clientWidth;
      // Tolérance d'1 px : les navigateurs rendent un scrollLeft fractionnaire
      // (zoom, DPR non entier) et une égalité stricte ne serait jamais vraie.
      const atEnd = row.scrollLeft >= maxLeft - 1;

      if (e.deltaY > 0) {
        // Vers le bas → vers la droite. Le footer n'apparaît qu'une fois la
        // rangée DÉJÀ au bout : arriver au bout ne le déclenche pas, il faut un
        // cran de plus. La butée est ainsi un temps d'arrêt, pas un mur, et le
        // footer ne surgit jamais par inadvertance.
        if (atEnd) showFooter(true);
        else row.scrollLeft = Math.min(maxLeft, row.scrollLeft + e.deltaY);
      } else {
        // Vers le haut → vers la gauche, mais le footer se range d'abord :
        // il occupe le cran qui l'avait fait venir.
        if (footerShown.current) showFooter(false);
        else row.scrollLeft = Math.max(0, row.scrollLeft + e.deltaY);
      }
    };

    cont.addEventListener('wheel', onWheel, { passive: false });
    return () => cont.removeEventListener('wheel', onWheel);
  }, [phase, scrollContainer, showFooter]);

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
  }, [showFooter]);

  // Le vol en cours ne doit pas être doublé d'un glissement de footer.
  useEffect(
    () => () => {
      footerTween.current?.kill();
    },
    []
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
  }, []);

  const isOpenish = phase !== 'closed';

  // Visibilité de la rangée fermée : cette classe est la SEULE autorité.
  //
  // Elle est visible en `closed`, et pendant `opening` / `closing` parce que
  // les piles sont alors la source ou la destination des vols — il faut
  // pouvoir mesurer leurs rects.
  //
  // ⚠️ Ne PAS se reposer sur l'`autoAlpha` que `runOpen` pose sur chaque pile :
  // le chemin `instant` (arrivée par ancre `/series#slug`, mouvement réduit,
  // branche cachée) saute `runOpen` entièrement. Les piles n'ont alors aucun
  // style GSAP, et cette classe est tout ce qui les masque. C'est exactement le
  // bug payé ici : arrivé par ancre puis changement de série, `phase` passait à
  // `switching`, la classe tombait, et TOUTE la rangée de covers réapparaissait
  // le temps de la transition. `switching` n'a besoin d'aucune pile (les vols
  // partent du NOM cliqué dans la colonne de gauche), donc la rangée reste
  // masquée.
  const rowHidden = phase === 'open' || phase === 'switching';

  return (
    <section
      ref={sceneRef}
      aria-label="Photographic series"
      className="relative"
      // 100dvh − 64 (nav fixe) − 64 (MainPadding haut) − 32 (MainPadding bas,
      // valeur propre à /series) : la scène occupe TOUTE la hauteur visible et
      // les piles se posent à 32 px du bas de l'écran — la même gouttière qu'à
      // gauche (paddingLeft de la rangée).
      //
      // Le footer n'entre PAS dans ce calcul, contrairement aux pages courtes :
      // sur /series il doit rester JUSTE SOUS L'HORIZON, à révéler d'un coup de
      // molette. Le blanc des trois quarts hauts est le sujet de la page ; y
      // faire tenir une bande sombre l'aplatirait. La règle « footer collé en
      // bas » (§7.6) reste satisfaite : il est bien en fin de contenu, la page
      // est simplement plus haute que l'écran de 70 px.
      style={{ height: 'calc(100dvh - 160px)', minHeight: 460 }}
    >
      <h1 className="sr-only">Series</h1>

      {/* ── Rangée fermée ─────────────────────────────────────────────────── */}
      <div
        ref={rowRef}
        data-closed-row
        tabIndex={phase === 'closed' ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') rowRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
          if (e.key === 'ArrowLeft') rowRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
        }}
        className={cn(
          'absolute inset-x-0 bottom-0 flex items-end gap-6 overflow-x-auto overscroll-x-contain',
          isOpenish && 'pointer-events-none',
          rowHidden && 'opacity-0'
        )}
        style={{
          paddingLeft: 32,
          paddingRight: 32,
          paddingTop: 48,
          // 0 : la gouttière basse est celle de <main> (32 px), pour qu'elle
          // égale exactement la gouttière gauche ci-dessus.
          paddingBottom: 0,
          scrollbarWidth: 'none',
        }}
      >
        {series.map((s) => (
          <FolderStack
            key={s.slug}
            series={s}
            disabled={isOpenish}
            onOpen={guard(() => onOpen(s.slug))}
          />
        ))}
      </div>

      {/* ── Vue ouverte ───────────────────────────────────────────────────── */}
      {displayed && (
        <div
          data-open-root
          className={cn(
            'absolute inset-0',
            phase !== 'open' && 'pointer-events-none'
          )}
          // paddingTop 24 (et non 48) : la scène ne fait plus toute la hauteur
          // visible depuis que le footer y tient, et le chrome de l'image
          // centrale (Close au-dessus, métadonnées en dessous) est en absolute
          // hors flux — l'espace qu'on ne lui laisse pas, il le prend sous le
          // footer, sans un mot. Cf. CENTER_MAX_H dans OpenSeriesView.
          style={{ paddingLeft: 32, paddingRight: 32, paddingTop: 24 }}
        >
          <OpenSeriesView
            allSeries={series}
            displayed={displayed}
            activeIndex={activeIndex}
            onClose={guard(onClose)}
            onSwitch={(slug) => guard(() => onOpen(slug))()}
            onSelect={handleSelect}
          />
        </div>
      )}
    </section>
  );
}
