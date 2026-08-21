'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import gsap from 'gsap';
import { urlFor } from '@/lib/sanity/image';
import type { PreparedSeries } from '@/lib/site/series';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { cn } from '@/lib/utils/cn';
import { FolderStack } from './FolderStack';
import { OpenSeriesView } from './OpenSeriesView';
import {
  DUR,
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

type Captured = {
  layer: GhostLayer;
  colGhosts: HTMLImageElement[];
  centerGhost: HTMLImageElement | null;
};

type Pending =
  | { type: 'open' }
  | { type: 'close'; from: PreparedSeries }
  | { type: 'switch' };

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
  onOpen: (slug: string) => void;
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
      setDisplayed(target);
      setPhase(target ? 'open' : 'closed');
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
      runOpen(scene, displayed, () => {
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
          // un autoAlpha "instantané" fond quand même. Les clones ne sont donc
          // pas retirés d'un coup — ils se fondent PAR-DESSUS le réel qui
          // apparaît, sinon tout clignote (bug réel signalé) et l'écart de
          // recadrage clone/réel sauterait aux yeux.
          fadeOutLayer(layer, { onComplete: done });
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
        flights.push({ ghost: captured.centerGhost, from: centerFrom, to: coverTo });
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
    // Miroir du chemin d'ouverture : depuis la colonne, on DESCEND d'abord
    // (90 % du Y au point intermédiaire) puis on glisse le long de l'horizon
    // jusqu'à la pile.
    flyCurved(tl, flights, { duration: DUR.close, midX: 0.05, midY: 0.905, at: 0 });
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
          // se dissout par-dessus le réel.
          captured?.layer.destroy();
          fadeOutLayer(layer, { onComplete: done });
        });
      },
      paused: true,
    });
    if (captured) {
      flyOutRight(tl, captured.colGhosts, { at: 0 });
      if (captured.centerGhost) {
        tl.to(
          captured.centerGhost,
          { autoAlpha: 0, filter: 'blur(6px)', duration: DUR.fade },
          0
        );
      }
    }
    flights.forEach(({ ghost }, i) =>
      tl.to(ghost, { opacity: 1, duration: 0.12 }, 0.12 + i * 0.02)
    );
    flyCurved(tl, flights, { duration: DUR.switch, at: 0.12 });
    if (centerWrap) {
      tl.fromTo(
        centerWrap,
        { autoAlpha: 0, filter: 'blur(6px)' },
        { autoAlpha: 1, filter: 'blur(0px)', duration: DUR.fade },
        0.25
      );
    }
    // Colonne remise en haut pour la nouvelle série.
    const col = q('[data-open-col]');
    if (col) col.scrollTop = 0;

    const centerSrc = q<HTMLImageElement>('[data-center-img]')?.src ?? '';
    void preloadCapped(centerSrc).then(() => tl.play());
  }

  const runSwap = useCallback(
    async (toIndex: number) => {
      const scene = sceneRef.current;
      if (!scene || !displayed || toIndex === activeIndex) return;
      if (animating.current) return;
      animating.current = true;

      const next = displayed.photos[toIndex];
      const nextSrc = next.image
        ? (urlFor(next.image)?.width(1600).quality(82).auto('format').url() ?? '')
        : '';
      // Plafonné : le geste ne reste jamais suspendu à un réseau lent —
      // au pire l'image se précise en vol (règle commune à tous les vols).
      if (nextSrc) await preloadCapped(nextSrc, 300);

      const centerImg = q<HTMLImageElement>('[data-center-img]');
      const centerCell = q('[data-open-center]');
      const outThumb = colImg(activeIndex);
      const inThumb = colImg(toIndex);
      const centerRect = rectOf(centerImg);
      const cellRect = rectOf(centerCell);
      const inRect = rectOf(inThumb);

      if (!centerImg || !inThumb || !centerRect || !cellRect || !inRect) {
        onSelectPhoto(toIndex);
        animating.current = false;
        return;
      }

      // Rect prédit de la nouvelle image centrale : ajustement du ratio de la
      // photo entrante dans la cellule, centré — même règle que le CSS
      // (max-width / maxHeight / flex center). L'écart éventuel d'un pixel se
      // résorbe au raccord, l'image réelle prenant le relais du clone.
      const maxH = centerRect.height === 0 ? cellRect.height : Math.max(
        centerRect.height,
        Math.min(cellRect.height, centerRect.height)
      );
      const ratio =
        (next.image?.dimensions?.aspectRatio ?? 4 / 3);
      let w = Math.min(cellRect.width, maxH * ratio);
      let h = w / ratio;
      if (h > cellRect.height) {
        h = cellRect.height;
        w = h * ratio;
      }
      const predicted = new DOMRect(
        cellRect.left + (cellRect.width - w) / 2,
        cellRect.top + (cellRect.height - h) / 2,
        w,
        h
      );

      const layer = createGhostLayer();
      const flights: Flight[] = [];

      const outRect = rectOf(outThumb);
      const outGhost = spawnGhost(layer, centerImg, centerRect);
      if (outRect && isOnScreen(outRect)) {
        flights.push({ ghost: outGhost, from: centerRect, to: outRect });
      } else {
        // Vignette de destination hors écran (colonne défilée) : simple fondu.
        gsap.to(outGhost, { autoAlpha: 0, duration: DUR.swap * 0.6 });
      }
      const inGhost = spawnGhost(layer, inThumb.querySelector('img') ?? inThumb as unknown as HTMLImageElement, inRect);
      flights.push({ ghost: inGhost, from: inRect, to: predicted });

      const centerWrap = q('[data-center-wrap]');
      gsap.set(centerWrap, { autoAlpha: 0 });
      gsap.set(inThumb, { autoAlpha: 0 });

      const tl = gsap.timeline({
        onComplete: () => {
          onSelectPhoto(toIndex);
          // 1 frame pour que React committe la nouvelle src, PUIS attendre
          // son DÉCODAGE avant de retirer le clone : changer la src d'une
          // <img> laisse l'ancienne photo affichée jusqu'au décodage — le
          // clone doit couvrir tout ce laps, quelle que soit la connexion.
          requestAnimationFrame(() => {
            const imgEl = q<HTMLImageElement>('[data-center-img]');
            void whenSettled([imgEl], 4000).then(() => {
              gsap.set([centerWrap, inThumb].filter(Boolean), {
                clearProps: 'opacity,visibility',
              });
              fadeOutLayer(layer, {
                onComplete: () => {
                  animating.current = false;
                },
              });
            });
          });
        },
      });
      flyCrossing(tl, flights, { duration: DUR.swap });
    },
    [displayed, activeIndex, onSelectPhoto, q, colImg]
  );

  // ── Interactions ──────────────────────────────────────────────────────────

  const guard = useCallback(
    (fn: () => void) => () => {
      if (animating.current) return;
      fn();
    },
    []
  );

  const handleSelect = useCallback(
    (i: number) => {
      if (reduced) {
        onSelectPhoto(i);
        return;
      }
      void runSwap(i);
    },
    [reduced, onSelectPhoto, runSwap]
  );

  // Échap ferme (spec §5 — clavier de bout en bout).
  useEffect(() => {
    if (phase !== 'open') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !animating.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  // Molette verticale → défilement horizontal de la rangée (spec §5).
  // Non-passive : on doit pouvoir preventDefault. Le trackpad horizontal
  // passe nativement (deltaX) — on ne touche qu'au deltaY dominant.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (row.scrollWidth <= row.clientWidth) return;
      row.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    row.addEventListener('wheel', onWheel, { passive: false });
    return () => row.removeEventListener('wheel', onWheel);
  }, []);

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

  // Flèches dans la colonne de vignettes.
  const handleColKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!displayed) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleSelect(Math.min(activeIndex + 1, displayed.photos.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSelect(Math.max(activeIndex - 1, 0));
      }
    },
    [displayed, activeIndex, handleSelect]
  );

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
          onKeyDown={handleColKeyDown}
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
