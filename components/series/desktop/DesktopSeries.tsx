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
import { SeriesWordmark } from '../shared/SeriesWordmark';
import { FolderStack } from './FolderStack';
import {
  INITIAL_ROW_TRANSFORM,
  INITIAL_WORDMARK_TRANSFORM,
  WORDMARK_MASK_CLIP,
} from './entrance';
import { OpenSeriesView } from './OpenSeriesView';
import { DUR } from './animations';

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

import {
  NAV_MIN_INTERVAL_MS,
  SWAP_MIN_DUR,
  pinThumb,
  type Captured,
  type Pending,
  type Phase,
  type SwapChain,
  type SwitchChain,
} from './chains';
import { useFooterReserve } from './useFooterReserve';
import { useWordmarkFold, TITLE_WIDTH_PCT, TITLE_MAX_WIDTH } from './useWordmarkFold';
import { useSeriesEntrance } from './useSeriesEntrance';
import { useRowGestures } from './useRowGestures';
import { useSeriesFlights } from './useSeriesFlights';


export function DesktopSeries({
  series,
  openSeries,
  activeIndex,
  onOpen,
  onClose,
  onSelectPhoto,
}: {
  series: PreparedSeries[];
  openSeries: PreparedSeries | null;
  activeIndex: number;
  hydrated: boolean;
  onOpen: (slug: string, photoIndex?: number) => void;
  onClose: () => void;
  onSelectPhoto: (index: number) => void;
}) {
  const sceneRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const titleBoxRef = useRef<HTMLHeadingElement>(null);
  // Le span INTÉRIEUR du lettrage : celui que l'entrée découpe en lettres.
  // Distinct de `titleRef`, que le repli met à l'échelle — voir le préambule
  // d'`entrance.ts` pour la raison de cette séparation.
  const wordmarkRef = useRef<HTMLSpanElement>(null);
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
  // Chaîne de changements de série en cours (voir le type SwitchChain). Même
  // régime que ci-dessus : `animating` reste vrai (clics de vignette et molette
  // gelés), mais ↑ / ↓ et les noms de la colonne de gauche restent vivants.
  const switchChainRef = useRef<SwitchChain | null>(null);
  const lastSwitchRef = useRef(0);
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
  const { footerShown, footerTween, scrollContainer, showFooter, flattenPage } =
    useFooterReserve(sceneRef, rowRef, reduced);

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
    // Séries VOISINES (↑ / ↓) : leur première photo, pour que le clone central
    // d'un changement de série parte net. Le vol ne l'attend plus (il joue
    // aussitôt et s'affine en place) — c'est la chauffe qui rend la netteté
    // gratuite, plus le temps mort qu'elle remplace.
    const si = series.findIndex((s) => s.slug === displayed.slug);
    if (si < 0) return;
    for (const d of [1, -1]) {
      const s = series[(si + d + series.length) % series.length];
      if (!s || s.slug === displayed.slug) continue;
      const p = s.photos[0];
      if (p) void warmHq(centerSrcFor(p));
    }
  }, [phase, displayed, activeIndex, series, warmHq]);

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
    // Repos = juste SOUS le vide de tête : la colonne s'ouvre sur sa première
    // vignette, le vide du haut ne se découvre qu'en remontant jusqu'à elle.
    col.scrollTop = col.querySelector<HTMLElement>('[data-col-head]')?.offsetHeight ?? 0;
    const item = scene.querySelector<HTMLElement>(
      '[data-col-item][aria-current]'
    );
    // En descente : une entrée à reculons arrive sur la DERNIÈRE photo, qui
    // doit se poser comme si on y était descendu — vide de queue compris.
    if (item) pinThumb(col, item, 1);
  }, []);

  /**
   * Ajustement MINIMAL de la colonne pour amener la vignette `i` SUR SA LIGNE
   * DE POSE — appelé AVANT la mesure d'un vol de chaîne (une vignette hors
   * écran n'a pas de rect exploitable). Par index et non par aria-current :
   * le commit React du nouvel index n'a pas encore peint au moment de la
   * mesure. Pas de scrollIntoView : il pourrait défiler AUSSI le conteneur de
   * page — qui ne doit jamais bouger tout seul (invariant 14).
   *
   * `from` = l'index QUITTÉ, d'où sort le sens de la ligne de pose (cf.
   * `pinThumb`). Son défaut vaut « descente », le sens d'un parcours qui
   * commence.
   */
  const keepThumbVisible = useCallback((i: number, from = i - 1) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const col = scene.querySelector<HTMLElement>('[data-open-col]');
    const item = scene.querySelector<HTMLElement>(`[data-col-item="${i}"]`);
    if (!col || !item) return;
    pinThumb(col, item, i < from ? -1 : 1);
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

  // Position d'accueil et repli du lettrage : `useWordmarkFold.ts`.
  const titleBottom = useWordmarkFold({ rowRef, titleRef, titleBoxRef, q, phase, reduced });

  // Entrée de la page et sa fin au premier geste d'ouverture : `useSeriesEntrance.ts`.
  useSeriesEntrance(sceneRef, rowRef, wordmarkRef, phase);

  // ── Les quatre vols : `useSeriesFlights.ts` ────────────────────────────────
  const {
    captureOpenGhosts,
    runOpen,
    runClose,
    runSwitch,
    requestSwitchTo,
    abortSwitchChain,
    requestSwapTo,
    abortChain,
  } = useSeriesFlights({
    activeIndex, onOpen, onSelectPhoto, sceneRef, rowRef, displayed, setPhase,
    animating, reduced, chainRef, switchChainRef, lastSwitchRef, indexRef, goToSeriesRef,
    hqReadyRef, warmHq, settleColScroll, keepThumbVisible, q, pileImg, colImg,
  });

  // ── Réconciliation displayed ← openSeries ────────────────────────────────

  useEffect(() => {
    const prev = displayed;
    const target = openSeries;
    if ((prev?.slug ?? null) === (target?.slug ?? null)) return;

    // Mouvement réduit, ou branche cachée (viewport mobile : le CSS masque
    // cette branche mais elle reste montée — spec §4) : pas de vol, on saute
    // directement à l'état cible.
    //
    // Le troisième cas — arrivée par ancre `/series#slug` — a disparu avec
    // l'ancre elle-même (cf. SeriesExperience) : la page ne peut plus s'ouvrir
    // sur une série au chargement, donc la toute première transition est
    // forcément un GESTE de l'utilisateur, et un geste s'anime.
    const hidden = sceneRef.current?.offsetParent === null;
    const instant = reduced || hidden;
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
      // la vue avec la nouvelle série. Sauf en CHAÎNE : le réel y est masqué
      // depuis le premier vol, ce qui est à l'écran ce sont les clones de
      // couverture — runSwitch les recopie lui-même (cf. SwitchChain).
      // ⚠️ Le test porte sur `started`, PAS sur l'existence de la chaîne : elle
      // est créée par `requestSwitchTo`, donc AVANT ce passage, dès le premier
      // vol — qui a besoin, lui, des clones du réel.
      capturedRef.current = switchChainRef.current?.started
        ? null
        : captureOpenGhosts(sceneRef.current);
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
      const captured = capturedRef.current;
      capturedRef.current = null;
      // Pas de `done` ici : un switch est un MAILLON de chaîne, c'est sa
      // traîne (switchTail) qui rend la main — au plus tôt à la fin du
      // dernier vol enchaîné.
      runSwitch(scene, captured, displayed);
    }
    // `displayed` dans les deps, et pas seulement `phase` : deux changements de
    // série qui s'enchaînent laissent `phase` sur 'switching', l'effet ne
    // rejouerait pas et le vol suivant ne partirait jamais. Les autres commits
    // de `displayed` sortent par le early-return de `pendingRef`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, displayed]);


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
  // de gauche — les deux passent par `requestSwitchTo`, donc par la chaîne.
  // L'ordre est celui de la rangée (seriesOrder), cyclique. `entry` : 'last'
  // quand on entre à reculons (flèche gauche depuis la 1re photo).
  function goToSeries(dir: 1 | -1, entry: 'first' | 'last') {
    if (!displayed) return;
    // Le pas se compte depuis la TÊTE de chaîne : trois ↓ d'affilée doivent
    // descendre de trois séries, même si aucun vol n'a eu le temps de se poser.
    const base = switchChainRef.current?.headSlug ?? displayed.slug;
    const i = series.findIndex((s) => s.slug === base);
    if (i < 0) return;
    const target = series[(i + dir + series.length) % series.length];
    const index = entry === 'last' ? Math.max(0, target.photos.length - 1) : 0;
    // Série unique : le tour cyclique retombe sur elle-même — simple échange.
    if (target.slug === base) {
      if (!switchChainRef.current && index !== indexRef.current) {
        handleSelect(index);
      }
      return;
    }
    requestSwitchTo(target.slug, index);
  }
  useEffect(() => {
    goToSeriesRef.current = goToSeries;
  });

  // Clavier en vue ouverte (spec §5 — de bout en bout) : Échap ferme, ↑ / ↓
  // reculent/avancent dans la SÉRIE COURANTE avec des vols ACCÉLÉRÉS au rythme
  // des taps, ← / → passent à la série précédente / suivante. Dépasser un bout
  // de série avec ↑ / ↓ continue dans la voisine — à reculons, sur sa DERNIÈRE
  // photo.
  //
  // ⚠️ Les deux axes ont été ÉCHANGÉS le 2026-08-22 (demande Alexandre) : les
  // flèches horizontales portaient les photos et les verticales les séries.
  // Chaque comportement a gardé son sens (→ prend ce que faisait ↓, ↓ prend ce
  // que faisait →), seules les touches ont permuté. L'axe vertical épouse
  // désormais la COLONNE DE VIGNETTES qu'il parcourt, et l'axe horizontal le
  // déplacement latéral d'une série à l'autre. Les flèches de la rangée fermée
  // (défilement horizontal) ne sont pas concernées : elles vivent dans l'état
  // fermé, où il n'y a ni photo courante ni série ouverte.
  //
  // Le changement de série suit désormais EXACTEMENT le régime de l'échange
  // de photo (décision Alexandre 2026-08-22, qui remplace le « bloquant » de
  // la veille) : le clavier reste vivant pendant la transition, le vol en
  // cours accélère, la cible est retargetée. D'où la phase 'switching' admise
  // ici. Demandé pendant une chaîne d'ÉCHANGES, il part encore à la fin de sa
  // traîne — couper un échange en cours casserait son raccord.
  useEffect(() => {
    if (phase !== 'open' && phase !== 'switching') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Une fermeture part d'un état posé : les chaînes sont posées d'un coup.
        abortChain();
        abortSwitchChain();
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

      // ── ← / → : changement de SÉRIE ────────────────────────────────────
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const dir: 1 | -1 = e.key === 'ArrowRight' ? 1 : -1;
        // Chaîne d'échanges en cours : le changement part à la fin de sa
        // traîne. `goToSeries` gère tout le reste (chaîne de switch en cours,
        // ouverture/fermeture qu'on laisse finir).
        if (chain) chain.pendingSwitch ??= { dir, entry: 'first' };
        else goToSeries(dir, 'first');
        return;
      }

      // ── ↑ / ↓ : photo précédente / suivante DANS la série ───────────────
      const dir: 1 | -1 = e.key === 'ArrowDown' ? 1 : -1;
      // On quitte déjà la série : les échanges attendent que le changement
      // soit posé (sa colonne de destination n'existe pas encore).
      if (switchChainRef.current) return;
      // Ouverture / fermeture en cours : on laisse finir.
      if (!chain && animating.current) return;
      if (chain?.pendingSwitch) return;
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
        keepThumbVisible(to, head);
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

  // Molette, footer et cliquer-glisser de la rangée : `useRowGestures.ts`.
  useRowGestures({ sceneRef, rowRef, phase, scrollContainer, showFooter, footerShown, footerTween });


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
      {/* ── Lettrage ──────────────────────────────────────────────────────
          POSÉ SUR LA RANGÉE, comme elle en `absolute` : son bord bas est le
          bord haut de la boîte des piles. Tout le blanc de la page est donc
          au-dessus de lui, d'un seul tenant.

          En absolu et pas en flux : c'est le bas qui est ancré, pas le haut, et
          la hauteur de la scène est fixée en `calc()`. Rien à pousser de toute
          façon — la rangée et la vue ouverte sont elles aussi en `absolute`.

          `pointer-events: none` : la BOÎTE est tendue `left:0 right:0` sur
          toute la scène, même quand le mot ne l'est pas — à l'accueil elle
          recouvre la zone de padding haut de la rangée, qui doit rester
          saisissable au cliquer-glisser. (Le second motif d'origine — le mot
          replié débordait sur la colonne centrale — a disparu avec le débord
          lui-même, cf. `foldWidth()`.) */}
      {/* Sans JS, personne ne défait les états de départ écrits dans le HTML —
          la rangée resterait hors écran et le titre sous la ligne d'eau. Une
          feuille de style dans un `<noscript>` est le seul chemin qui ne coûte
          rien quand le JS est là : le contenu n'est même pas analysé. */}
      <noscript>
        <style>{`[data-closed-row],[data-wordmark]{transform:none!important}`}</style>
      </noscript>

      <h1
        ref={titleBoxRef}
        className="series-title"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: titleBottom,
          paddingLeft: 32,
          paddingRight: 32,
          pointerEvents: 'none',
        }}
      >
        <span className="sr-only">Series</span>
        <span
          ref={titleRef}
          aria-hidden
          style={{
            display: 'block',
            width: TITLE_WIDTH_PCT,
            maxWidth: TITLE_MAX_WIDTH,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          {/* MASQUE — notre équivalent de l'`overflow: hidden` que la démo
              Codrops pose sur son `h1`. Il ne coupe qu'EN BAS (les trois
              autres côtés sont en valeurs négatives, donc hors boîte) : la
              boîte épouse les glyphes, le dépassement doit sortir par le haut.
              Détail des cotes : `entrance.ts`.

              Deux boîtes emboîtées et pas une : celle-ci découpe et ne bouge
              jamais, celle du dessous porte les lettres. Poser les deux sur le
              même nœud ferait voyager le masque avec son contenu — il suivrait
              le mot, qui ne sortirait donc jamais. */}
          <span style={{ display: 'block', clipPath: WORDMARK_MASK_CLIP }}>
            <span
              ref={wordmarkRef}
              data-wordmark
              style={{
                display: 'block',
                transform: INITIAL_WORDMARK_TRANSFORM,
                willChange: 'transform',
              }}
            >
              <SeriesWordmark />
            </span>
          </span>
        </span>
      </h1>

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
          // Le train attend hors écran, à droite, DÈS LE HTML servi (cf.
          // `entrance.ts`). GSAP reprend la main à l'hydratation.
          transform: INITIAL_ROW_TRANSFORM,
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
            // 'switching' garde la main : la colonne de noms est le seul
            // élément encore visible et cliquable pendant un changement (le
            // centre et les vignettes sont masqués par les vols), et cliquer un
            // autre nom doit retarger la chaîne — équivalent souris de ↓ ↓.
            phase !== 'open' && phase !== 'switching' && 'pointer-events-none'
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
            onSwitch={(slug) => requestSwitchTo(slug)}
            onSelect={handleSelect}
          />
        </div>
      )}
    </section>
  );
}
