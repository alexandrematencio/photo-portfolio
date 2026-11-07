import type { Dispatch, RefObject, SetStateAction } from 'react';
import gsap from 'gsap';
import type { PreparedSeries } from '@/lib/site/series';
import { centerSrcFor } from '../shared/photoSrc';
import { CENTER_RESERVE_PX } from './OpenSeriesView';
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
} from './animations';
import {
  SWITCH_MIN_DUR,
  type Captured,
  type Phase,
  type SwapChain,
  type SwitchChain,
} from './chains';

/**
 * Ce que les vols lisent du composant. Les mêmes valeurs, du même rendu, que
 * lorsque ces fonctions vivaient dans le corps de `DesktopSeries` : elles y
 * sont recréées à chaque rendu, exactement comme avant.
 */
export type FlightsContext = {
  activeIndex: number;
  onOpen: (slug: string, photoIndex?: number) => void;
  onSelectPhoto: (index: number) => void;
  sceneRef: RefObject<HTMLElement | null>;
  rowRef: RefObject<HTMLDivElement | null>;
  displayed: PreparedSeries | null;
  setPhase: Dispatch<SetStateAction<Phase>>;
  animating: RefObject<boolean>;
  reduced: boolean;
  chainRef: RefObject<SwapChain | null>;
  switchChainRef: RefObject<SwitchChain | null>;
  lastSwitchRef: RefObject<number>;
  indexRef: RefObject<number>;
  goToSeriesRef: RefObject<(dir: 1 | -1, entry: 'first' | 'last') => void>;
  hqReadyRef: RefObject<Set<string>>;
  warmHq: (src: string) => Promise<boolean>;
  settleColScroll: () => void;
  keepThumbVisible: (i: number, from?: number) => void;
  q: <T extends Element>(sel: string) => T | null;
  pileImg: (slug: string, photoId: string) => HTMLImageElement | null;
  colImg: (i: number) => HTMLImageElement | null;
};

/**
 * Les vols de /series (§3.7 invariants 1 à 15) : ouverture, fermeture,
 * changement de série et échange de photo, avec leurs chaînes. Sortis tels
 * quels du corps de `DesktopSeries` (audit 1.6) ; un hook sans hook, pour
 * que les refs puissent lui être passées pendant le rendu.
 */
export function useSeriesFlights(ctx: FlightsContext) {
  const {
    activeIndex,
    onOpen,
    onSelectPhoto,
    sceneRef,
    rowRef,
    displayed,
    setPhase,
    animating,
    reduced,
    chainRef,
    switchChainRef,
    lastSwitchRef,
    indexRef,
    goToSeriesRef,
    hqReadyRef,
    warmHq,
    settleColScroll,
    keepThumbVisible,
    q,
    pileImg,
    colImg,
  } = ctx;

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

    // Empilement des clones = empilement de la pile RÉELLE : la cover au
    // sommet, les autres dessous dans l'ordre (FolderStack pose
    // `zIndex: pile.length - i`). Sans z-index, l'ordre du DOM fait loi : le
    // dernier clone ajouté — une AUTRE photo, posée sur la même boîte, puisque
    // toutes les sources partagent celle de la cover (épaisseur désactivée,
    // repli des photos au-delà de la pile) — recouvrait la cover dès la
    // première frame, et `expo.inOut` laisse les vols quasi immobiles ~150 ms :
    // la cover « changeait de photo » au clic (bug réel signalé, 2026-09-11).
    const n = target.photos.length;
    const stackZ = (photo: { _id: string }, i: number) =>
      String(photo._id === target.cover._id ? n + 1 : n - i);

    // Le centre ne vole plus de la pile : il DÉCOLLE DE SA VIGNETTE une fois
    // celle-ci posée, comme au changement de série et à l'échange ↑ / ↓
    // (demande Alexandre, 2026-11-04). Rang de la vignette active dans la
    // cascade, pour caler le décollage sur SA pose.
    const openIndex = Math.min(indexRef.current, n - 1);
    let activeFlight = -1;
    target.photos.forEach((photo, i) => {
      const pile = pileImg(target.slug, photo._id);
      const pileRect = rectOf(pile);
      const col = colImg(i);
      const to = rectOf(col);
      if (!col || !to || !isOnScreen(to)) return;
      // Source : la vignette de pile si elle existe, sinon la boîte de la
      // cover — l'image clonée vient alors de la colonne (déjà chargée), seule
      // la POSITION de départ est empruntée à la pile.
      const from = pileRect ?? coverPileRect;
      const srcEl = pile ?? col;
      if (!from) return;
      const ghost = spawnGhost(layer, srcEl, from);
      ghost.style.zIndex = stackZ(photo, i);
      if (i === openIndex) activeFlight = flights.length;
      flights.push({ ghost, from, to });
    });

    // Clone du centre, posé INVISIBLE sur le rect de pose de la vignette
    // active, au-dessus de toute la couche. Source : le fichier du centre
    // s'il est déjà décodé, sinon la vignette (même ratio — `contain` évite
    // tout recadrage), affinée en place dès que le grand fichier est prêt.
    const liftFrom = activeFlight >= 0 ? flights[activeFlight].to : null;
    const centerImgEl = q<HTMLImageElement>('[data-center-img]');
    if (liftFrom && centerRect && centerImgEl) {
      const loaded = centerImgEl.complete && centerImgEl.naturalWidth > 0;
      const ghost = spawnGhost(layer, centerImgEl, liftFrom);
      ghost.style.objectFit = 'contain';
      ghost.style.zIndex = String(n + 2);
      ghost.style.opacity = '0';
      if (!loaded) {
        const thumbSrc = colImg(openIndex)?.src;
        if (thumbSrc) ghost.src = thumbSrc;
        const hq = centerImgEl.currentSrc || centerImgEl.src;
        if (hq) {
          void warmHq(hq).then((ok) => {
            if (ok && ghost.isConnected) ghost.src = hq;
          });
        }
      }
      coverFlight = { ghost, from: liftFrom, to: centerRect };
    }

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
    if (coverFlight) {
      // Décollage à 85 % du vol de la vignette active (`expo.inOut` : 99,6 %
      // du trajet parcouru), puis le vol croisé de l'échange.
      const lift = activeFlight * STAGGER + DUR.open * 0.85;
      tl.set(coverFlight.ghost, { opacity: 1 }, lift);
      flyCrossing(tl, [coverFlight], { duration: DUR.swap, at: lift });
    }
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
      // Empilement à la POSE = celui de la pile réelle (miroir de runOpen) :
      // tous les clones convergent sur la boîte de la cover, et c'est le clone
      // de la COVER qui doit finir au sommet — pas le centre, qui porte la
      // photo ACTIVE (une autre après un échange), ni le dernier ajouté.
      // Le centre reste juste sous la cover, au-dessus du reste : c'est le
      // grand vol, il ne doit pas passer derrière les vignettes qu'il croise.
      const n = from.photos.length;
      let g = 0;
      from.photos.forEach((photo, i) => {
        const src = colImg(i);
        const fromRect = rectOf(src);
        if (!fromRect || !isOnScreen(fromRect)) return;
        const to = rectOf(pileImg(from.slug, photo._id)) ?? coverTo;
        const ghost = captured.colGhosts[g++];
        if (!ghost || !to) return;
        ghost.style.zIndex = String(photo._id === from.cover._id ? n + 2 : n - i);
        flights.push({ ghost, from: fromRect, to });
      });
      const centerFrom = rectOf(q('[data-center-img]'));
      if (captured.centerGhost && coverTo && centerFrom) {
        captured.centerGhost.style.zIndex = String(n + 1);
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

  /**
   * UN MAILLON de la chaîne de changements de série (cf. SwitchChain).
   *
   * `captured` n'est fourni que pour le PREMIER vol de la chaîne (clones du
   * réel, pris avant que React ne re-rende la colonne). Pour les suivants, les
   * sortants sont des RECOPIES des clones de couverture à leur position
   * courante : un clone déjà volé n'est jamais réutilisé pour un second vol,
   * ses transforms composeraient faux (même règle qu'en `chainFlight`).
   */
  function runSwitch(
    scene: HTMLElement,
    captured: Captured | null,
    target: PreparedSeries
  ) {
    const chain =
      switchChainRef.current ?? beginSwitchChain(target.slug, DUR.switch);
    chain.epoch++;
    const layer = chain.layer;
    const centerWrap = q('[data-center-wrap]');
    const colItems = Array.from(scene.querySelectorAll('[data-col-item]'));
    // Le réel reste masqué toute la vie de la chaîne — CENTRE COMPRIS. Il se
    // révélait en vol jusqu'ici, ce qui imposait d'attendre son fichier avant
    // de jouer ; il n'est plus dévoilé qu'à la traîne. Pré-paint : pas de flash.
    gsap.set([centerWrap, ...colItems].filter(Boolean), { autoAlpha: 0 });

    // Colonne posée AVANT toute mesure (voir settleColScroll).
    settleColScroll();

    // ── Sortants ────────────────────────────────────────────────────────────
    const outCols: HTMLImageElement[] = [];
    let outCenter: HTMLImageElement | null = null;
    if (captured) {
      outCols.push(...captured.colGhosts);
      outCenter = captured.centerGhost;
    } else {
      for (const g of chain.cover) {
        const r = rectOf(g);
        if (r) outCols.push(spawnGhost(layer, g, r));
        g.remove();
      }
      if (chain.centerGhost) {
        const r = rectOf(chain.centerGhost);
        if (r) {
          outCenter = spawnGhost(layer, chain.centerGhost, r);
          outCenter.style.objectFit = 'contain';
        }
        chain.centerGhost.remove();
      }
    }
    chain.cover = [];
    chain.centerGhost = null;
    chain.outLayer = captured?.layer ?? null;
    chain.started = true;

    // ── Entrants ────────────────────────────────────────────────────────────
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
    // Rang de la vignette ACTIVE dans la cascade : le centre décolle d'elle.
    let activeFlight = 0;
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
      if (i === activeIndex) activeFlight = flights.length;
      flights.push({ ghost, from, to });
      chain.cover.push(ghost);
    });

    // Clone du centre : il prend la place que la vraie image occupait dans la
    // recette d'origine. Sa source suit la règle de netteté des échanges : le
    // 1600 px s'il est DÉJÀ décodé, sinon l'URL 280 px de la vignette de la
    // colonne (strictement la même chaîne que le clone entrant correspondant —
    // une URL unique, donc un seul fichier CDN), et il s'affine en place dès
    // que le 1600 px est décodé.
    const centerImg = q<HTMLImageElement>('[data-center-img]');
    const centerRect = rectOf(centerImg);
    const active = target.photos[activeIndex] ?? target.photos[0];
    const hqSrc = active ? centerSrcFor(active) : '';
    // Le centre SORT DE SA VIGNETTE, comme à l'échange ↑ / ↓ (demande
    // Alexandre, 2026-11-04) : il apparaissait en fondu sur place, d'un coup
    // au milieu de l'écran, alors que tout le reste de la série glisse en
    // place. Départ = rect de POSE de la vignette active (mesuré à plat, la
    // colonne est réglée) ; si elle est hors écran, repli sur l'ancien fondu.
    const activeThumb = rectOf(colImg(activeIndex));
    const liftFrom = activeThumb && isOnScreen(activeThumb) ? activeThumb : null;
    let centerGhost: HTMLImageElement | null = null;
    if (centerImg && centerRect) {
      // L'image réelle est déjà affichable (série revisitée) → on la garde ;
      // sinon la meilleure source décodée, sinon la vignette de colonne.
      const loaded = centerImg.complete && centerImg.naturalWidth > 0;
      const seed = loaded
        ? ''
        : hqReadyRef.current.has(hqSrc)
          ? hqSrc
          : (colImg(activeIndex)?.src ?? '');
      centerGhost = spawnGhost(layer, centerImg, liftFrom ?? centerRect);
      // Le rect cloné porte exactement le ratio de la photo (aspect-ratio posé
      // depuis Sanity), mais la source d'amorce, elle, peut être la vignette :
      // `contain` garantit qu'aucun recadrage ne s'invite le temps du vol.
      centerGhost.style.objectFit = 'contain';
      if (seed) centerGhost.src = seed;
      centerGhost.style.opacity = '0';
      chain.centerGhost = centerGhost;
      if (hqSrc && seed !== hqSrc) {
        void warmHq(hqSrc).then((ok) => {
          if (ok && centerGhost?.isConnected) centerGhost.src = hqSrc;
        });
      }
    }

    // ── Vol ─────────────────────────────────────────────────────────────────
    // Les temps de la recette suivent la durée demandée : cascade, fondus et
    // décalage d'entrée sont mis à l'échelle ensemble, sans quoi un vol
    // accéléré verrait sa cascade dépasser sa propre durée.
    const dur = chain.nextDur;
    const k = dur / DUR.switch;

    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        chain.tl = null;
        // Les sortants ont fini leur course (glissés hors champ ou fondus) :
        // ils ne couvrent plus rien, on les retire tout de suite. La
        // COUVERTURE, elle, reste posée jusqu'à la traîne.
        if (chain.outLayer) chain.outLayer.destroy();
        else {
          for (const g of outCols) g.remove();
          outCenter?.remove();
        }
        chain.outLayer = null;
        const next = chain.pending;
        chain.pending = null;
        // `next.slug === target.slug` : aller-retour ↓ puis ↑ pendant le vol —
        // la série demandée est déjà celle qu'on affiche. Sans ce test, le
        // `onOpen` ne changerait rien, la réconciliation sortirait par son
        // early-return et la chaîne resterait suspendue sans traîne.
        if (next && next.slug !== target.slug) {
          indexRef.current = next.index;
          onOpen(next.slug, next.index);
        } else {
          switchTail(chain);
        }
      },
    });
    if (outCols.length) {
      flyOutRight(tl, outCols, {
        duration: dur * 0.75,
        stagger: 0.015 * k,
        at: 0,
      });
    }
    if (outCenter) tl.to(outCenter, { autoAlpha: 0, duration: DUR.fade * k }, 0);
    // Fondu d'apparition calé sur la cascade des vols (même STAGGER).
    flights.forEach(({ ghost }, i) =>
      tl.to(ghost, { opacity: 1, duration: 0.12 * k }, (0.12 + i * STAGGER) * k)
    );
    flyCurved(tl, flights, {
      duration: dur,
      stagger: STAGGER * k,
      at: 0.12 * k,
    });
    if (centerGhost && centerRect && liftFrom) {
      // Décollage quand la vignette active est posée à quelques pixels près
      // (`expo.inOut` : à 85 % de sa durée, 99,6 % du trajet ; à 80 % il
      // restait ~8 px, visibles en dédoublement au décollage) — le clone du
      // centre apparaît PILE sur le sien, puis fait le vol croisé de
      // l'échange. Vol au-dessus de la colonne : il est ajouté après elle
      // dans la couche. Temps à l'échelle `k`, comme toute la recette.
      const lift = (0.12 + activeFlight * STAGGER) * k + dur * 0.85;
      tl.set(centerGhost, { opacity: 1 }, lift);
      flyCrossing(tl, [{ ghost: centerGhost, from: liftFrom, to: centerRect }], {
        duration: DUR.swap * k,
        at: lift,
      });
    } else if (centerGhost) {
      tl.to(centerGhost, { opacity: 1, duration: DUR.fade * k }, 0.25 * k);
    }
    chain.tl = tl;

    if (captured) {
      // Vol ISOLÉ (premier de la chaîne) : on laisse une chance courte au
      // 1600 px d'être décodé, pour que le centre parte net comme avant. En
      // CHAÎNE, plus aucune attente — c'est tout l'objet du chantier : le
      // clone démarre sur ce qui est disponible et s'affine en vol.
      void Promise.race([
        warmHq(hqSrc),
        new Promise<void>((r) => setTimeout(r, 300)),
      ]).then(() => tl.play());
    } else {
      tl.play();
    }
  }

  // ── Chaîne de changements de série (voir le type SwitchChain) ────────────

  function beginSwitchChain(headSlug: string, dur: number): SwitchChain {
    const chain: SwitchChain = {
      // z 61 : la couverture passe au-dessus des sortants quel que soit
      // l'ordre de création des couches (cf. createGhostLayer).
      layer: createGhostLayer(61),
      cover: [],
      centerGhost: null,
      outLayer: null,
      started: false,
      tl: null,
      headSlug,
      pending: null,
      nextDur: dur,
      epoch: 0,
    };
    switchChainRef.current = chain;
    return chain;
  }

  /**
   * Point d'entrée UNIQUE d'un changement de série — clic sur un nom de la
   * colonne de gauche comme flèches ↑ / ↓, et débordement de série par ← / →.
   * Pas de chaîne → nouveau vol. Vol en l'air → la cible en attente est
   * ÉCRASÉE (retarget) et le vol en cours ACCÉLÈRE ; il n'est jamais coupé.
   * Traîne de fin → reprise directe de la chaîne.
   */
  function requestSwitchTo(slug: string, index = 0) {
    if (!displayed) return;
    const chain = switchChainRef.current;
    // La tête de chaîne, pas `displayed` : pendant un vol, la série demandée
    // se calcule depuis là où l'on SE REND, pas depuis ce qui est affiché.
    const head = chain?.headSlug ?? displayed.slug;
    if (slug === head) return;
    // Mouvement réduit / branche cachée : pas de vol, donc pas de chaîne.
    if (reduced || sceneRef.current?.offsetParent === null) {
      indexRef.current = index;
      onOpen(slug, index);
      return;
    }
    const now = performance.now();
    const dur = Math.min(
      DUR.switch,
      Math.max(SWITCH_MIN_DUR, (now - lastSwitchRef.current) / 1000)
    );
    lastSwitchRef.current = now;

    if (!chain) {
      // Ouverture / fermeture / chaîne d'échanges en cours : on laisse finir.
      if (animating.current) return;
      animating.current = true;
      beginSwitchChain(slug, dur);
      indexRef.current = index;
      onOpen(slug, index);
      return;
    }
    chain.headSlug = slug;
    chain.nextDur = dur;
    if (chain.tl) {
      chain.pending = { slug, index }; // écrase : on file à la dernière demandée
      chain.tl.timeScale(Math.min(3, chain.tl.timeScale() * 1.6));
    } else {
      switchResume(chain);
      indexRef.current = index;
      onOpen(slug, index);
    }
  }

  /**
   * Reprise depuis la traîne : le fondu de la couche est tué et son opacité
   * REMISE À 1 — un fondu à moitié fait laisserait les clones translucides et
   * le fond transparaîtrait (même famille de bug que le blink de couverture).
   * Le réel révélé par la traîne est re-masqué par le runSwitch suivant, en
   * pré-paint.
   */
  function switchResume(chain: SwitchChain) {
    chain.epoch++;
    gsap.killTweensOf(chain.layer.el);
    chain.layer.el.style.opacity = '1';
  }

  /**
   * Traîne de fin de chaîne — le SEUL raccord clone → réel de toute la
   * chaîne : décodage du centre et des vignettes visibles, reveal du réel
   * SOUS les clones intacts, PUIS fondu de la couche (HANDOFF_DELAY).
   */
  function switchTail(chain: SwitchChain) {
    const scene = sceneRef.current;
    const myEpoch = ++chain.epoch;
    const settleImgs: (HTMLImageElement | null)[] = [
      q<HTMLImageElement>('[data-center-img]'),
    ];
    scene
      ?.querySelectorAll<HTMLImageElement>('[data-col-img]')
      .forEach((img) => {
        const r = rectOf(img);
        if (r && isOnScreen(r)) settleImgs.push(img);
      });
    void whenSettled(settleImgs, 4000).then(() => {
      if (switchChainRef.current !== chain || chain.epoch !== myEpoch) return;
      revealOpenReals();
      fadeOutLayer(chain.layer, {
        delay: HANDOFF_DELAY,
        onComplete: () => {
          if (switchChainRef.current !== chain) return;
          switchChainRef.current = null;
          animating.current = false;
          setPhase('open');
        },
      });
    });
  }

  /**
   * Rend au centre et aux vignettes leur apparence de feuille de style.
   * `clearProps` et non `autoAlpha: 1` : une opacité inline écraserait tout
   * état que la feuille de style voudrait poser sur une vignette (c'est le
   * voile `opacity-40` de l'ancienne marque d'actif qui l'a montré — la marque
   * est devenue une LED hors image, mais la règle reste : on rend la main au
   * CSS, on ne le double pas).
   */
  function revealOpenReals() {
    const scene = sceneRef.current;
    const targets = [
      q('[data-center-wrap]'),
      ...Array.from(scene?.querySelectorAll('[data-col-item]') ?? []),
    ].filter(Boolean);
    if (targets.length) gsap.set(targets, { clearProps: 'opacity,visibility' });
  }

  /**
   * Pose l'état de la chaîne D'UN COUP (Échap) : vol tué, clones retirés, réel
   * révélé, main rendue. Réservé à la fermeture — pour la navigation, un vol
   * commencé se joue toujours en entier.
   */
  function abortSwitchChain() {
    const chain = switchChainRef.current;
    if (!chain) return;
    chain.epoch++;
    chain.tl?.kill();
    gsap.killTweensOf(chain.layer.el);
    chain.outLayer?.destroy();
    chain.layer.destroy();
    revealOpenReals();
    switchChainRef.current = null;
    animating.current = false;
    setPhase('open');
  }

  // ── Chaîne d'échanges clavier (voir le type SwapChain) ───────────────────

  /**
   * Rect prédit de l'image centrale pour une photo de ratio donné — même
   * règle que le CSS d'OpenSeriesView (width = min(100%, maxH × ratio),
   * maxHeight, flex center). maxH applique CENTER_RESERVE_PX, le MÊME nombre
   * que CENTER_MAX_H — jamais une transcription : le littéral qui vivait ici
   * (300) n'a pas suivi le passage de la réserve à 288 et posait le clone
   * 12 px trop court, saut visible au raccord clone → réel. Et ne PAS mesurer
   * l'image courante à la place : sa hauteur dépend de SON ratio et fausserait
   * la prédiction pour la suivante.
   */
  function predictCenterRect(cellRect: DOMRect, ratio: number): DOMRect {
    const maxH = Math.min(
      cellRect.height,
      window.innerHeight - CENTER_RESERVE_PX
    );
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
    // de rect exploitable). `fromIndex` donne le sens de la ligne de pose.
    keepThumbVisible(toIndex, fromIndex);

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

  return {
    captureOpenGhosts,
    runOpen,
    runClose,
    runSwitch,
    requestSwitchTo,
    abortSwitchChain,
    requestSwapTo,
    abortChain,
  };
}
