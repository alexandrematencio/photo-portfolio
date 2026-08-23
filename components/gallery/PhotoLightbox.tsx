'use client';

/**
 * PhotoLightbox — CAROUSEL CONTRACT
 * =================================
 *
 * This component is a CAROUSEL, never a single-photo lightbox. Any code path
 * that visualizes a photograph MUST pass:
 *   • photos: the full array the user is browsing (in display order)
 *   • initialIndex: where in that array to start
 *
 * Single-photo callers are forbidden: the user expects to swipe / arrow-key
 * through the surrounding photos at all times. New pages or features that
 * surface photographs must lift the array up to a parent component and pass
 * `(photos, initialIndex)` to PhotoLightbox.
 *
 * Layout:
 *   • Desktop (≥ 768 px): `--color-bg-raised` outer bg + 32 px gutter + 32 px white
 *     "polaroid" frame around the image. Prev / next arrow buttons pinned to
 *     the left and right viewport edges (mix-blend-mode: difference). Hidden
 *     by default — fade in on mousemove, fade out after 500 ms of idle cursor.
 *     Click the backdrop closes the lightbox (traditional pattern).
 *   • Mobile (< 768 px): full-white viewport, 24 px padding all sides, image
 *     direct (no separate frame). "Open in new tab" icon sits 4 px above the
 *     image's top-left corner (outside the image, not over it). Touch swipe
 *     (≥ 50 px delta) navigates prev / next.
 *
 * Behaviour:
 *   • Wrap-around: last → first via next, first → last via prev.
 *   • Keyboard: Esc closes, ← / → navigate.
 *   • Scale-in: scale(0) → scale(1) over 500 ms cubic-bezier(0.22, 1, 0.36, 1)
 *     on every photo change. Loader bar bridges the gap during JPEG download.
 */

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { pushModalHistory } from '@/lib/utils/modalHistory';
import { cn } from '@/lib/utils/cn';
import {
  MICRO_LABEL_RIGHT_TRIM,
  MICRO_LABEL_XS,
} from '@/lib/site/typography';

type Props = {
  photos: Photo[];
  initialIndex: number;
  onClose: () => void;
};

/* Fonds de la lightbox — posés sur l'échelle de valeurs de globals.css, plus
   en hex ici. Desktop : le barreau « calque posé sur le papier », commun au
   tiroir du menu mobile (les deux valaient deux hex distincts à 0,4 point de
   L* l'un de l'autre, c'est-à-dire le même barreau écrit deux fois).
   Mobile : pas de cadre, le viewport EST le cadre — le fond prend donc la
   couleur du CADRE et non celle du calque. */
const BG_DESKTOP = 'var(--color-bg-raised)';
const BG_MOBILE = 'var(--color-frame)';
const FRAME_COLOR = 'var(--color-frame)';
const FRAME_THICKNESS = 32; // desktop only
const OUTER_GUTTER = 32; // desktop only
const MOBILE_PADDING = 24;

const SWIPE_THRESHOLD = 50; // px delta to trigger navigation

export function PhotoLightbox({ photos, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [loaded, setLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Prev/next arrow buttons (desktop only). Anchored 32 px away from the
  // photo frame on each side — positions are measured imperatively from the
  // frame's bounding rect, so they hug the image regardless of its aspect
  // ratio / size. Refs also let us toggle opacity + pointer-events on cursor
  // activity without re-rendering the carousel.
  const frameRef = useRef<HTMLDivElement>(null);
  const leftArrowRef = useRef<HTMLButtonElement>(null);
  const rightArrowRef = useRef<HTMLButtonElement>(null);

  // Swipe (mobile)
  const touchStartXRef = useRef<number | null>(null);

  const photo = photos[index];

  const next = () => setIndex((i) => (i + 1) % photos.length);
  const prev = () => setIndex((i) => (i - 1 + photos.length) % photos.length);

  // Detect mobile viewport — used to fork layout + behaviour.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Reset the scale-in animation each time the photo changes.
  useEffect(() => {
    setLoaded(false);
  }, [index]);

  // Keyboard: Esc closes, ← / → navigate. Also locks body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // photos.length is stable for a given carousel lifetime; index changes
    // don't need to re-bind listeners (prev/next close over current setIndex).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // Browser back integration. Push a history entry on mount so the next
  // back-button press CLOSES the lightbox instead of navigating to the
  // previous page (Google, About, …). The stack util coordinates nested modals
  // so each back press closes one layer at a time.
  // onCloseRef ensures the popstate handler always reads the latest onClose
  // even though we register it once on mount with empty deps.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    return pushModalHistory(() => onCloseRef.current());
  }, []);

  // Desktop: position prev/next arrows 32 px from the photo frame's edges.
  // A ResizeObserver re-measures on every frame size change — crucial because
  // the image scales from 0 → 1 on load (transforms affect bounding rects, so
  // a one-shot rAF measurement at mount would catch the collapsed scale(0)
  // state and stick the arrows at the centre of the viewport).
  useEffect(() => {
    if (isMobile) return;
    const frame = frameRef.current;
    if (!frame) return;
    const updatePositions = () => {
      const left = leftArrowRef.current;
      const right = rightArrowRef.current;
      if (!left || !right) return;
      const rect = frame.getBoundingClientRect();
      // Left arrow right-edge sits at (frame.left − 32 px); anchor via `right`.
      left.style.right = `${window.innerWidth - rect.left + 32}px`;
      // Right arrow left-edge sits at (frame.right + 32 px); anchor via `left`.
      right.style.left = `${rect.right + 32}px`;
    };
    const observer = new ResizeObserver(updatePositions);
    observer.observe(frame);
    window.addEventListener('resize', updatePositions);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePositions);
    };
  }, [isMobile, index]);

  // Desktop: reveal the prev/next arrows on cursor activity, hide them after
  // 500 ms of stillness. Imperative — no re-render per mousemove.
  useEffect(() => {
    if (isMobile) return;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const setVisible = (visible: boolean) => {
      const left = leftArrowRef.current;
      const right = rightArrowRef.current;
      if (!left || !right) return;
      const o = visible ? '1' : '0';
      const pe = visible ? 'auto' : 'none';
      left.style.opacity = o;
      right.style.opacity = o;
      left.style.pointerEvents = pe;
      right.style.pointerEvents = pe;
    };

    const onMove = () => {
      setVisible(true);
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setVisible(false), 500);
    };

    document.addEventListener('mousemove', onMove);
    return () => {
      document.removeEventListener('mousemove', onMove);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [isMobile]);

  // Mobile: touch swipe (≥ SWIPE_THRESHOLD px delta).
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartXRef.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const start = touchStartXRef.current;
    if (start == null) return;
    const endX = e.changedTouches[0].clientX;
    const delta = endX - start;
    touchStartXRef.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta < 0) next(); // swipe left → next
    else prev(); // swipe right → prev
  };

  if (typeof window === 'undefined') return null;
  if (!photo) return null;

  const builder = photo.image ? urlFor(photo.image) : null;
  // `urlFor` plafonne déjà à MAX_PHOTO_WIDTH (2048). On ne redemande donc PAS
  // 2400 ici : c'était la plus grande résolution servie du site, au-dessus de ce
  // que n'importe quel écran affiche dans cette boîte.
  const previewSrc = builder?.quality(88).auto('format').url();
  // Le viseur zoomable montre la même image que l'aperçu — jamais l'asset nu.
  // Avant : `builder.url()`, sans largeur, donc l'original pleine résolution.
  // Plus de lien « pleine résolution » (demande Alexandre, 2026-08-23) : le
  // site ne propose plus l'image en grand format, quel qu'il soit. La mesure
  // qui portait le sujet reste le plafond `MAX_PHOTO_WIDTH` de `urlFor` ; ceci
  // en retire simplement l'affordance.

  /** Taille de la croix — doublée (20 → 40). */
  const closeSize = isMobile ? 36 : 40;
  // Plus aucune réserve horizontale à prévoir : la croix ne vit plus à côté du
  // cadre mais au niveau de l'écran, dans la bande de la nav-bar. La largeur
  // de l'image redevient donc pleine — les 24 px qu'on lui prenait pour loger
  // la croix lui sont rendus.

  const imgW = photo.image?.dimensions?.width ?? 2400;
  const imgH = photo.image?.dimensions?.height ?? 1800;

  // Space reserved for the chrome. Vertical desktop chrome includes the
  // 16 px gap + caption text below the frame so the caption never spills past
  // the bottom gutter.
  const CAPTION_GAP = 16;
  const CAPTION_LINE = 14; // approx text-[10px] line-height: 1 with descenders
  const chromeX = isMobile
    ? MOBILE_PADDING * 2
    : (OUTER_GUTTER + FRAME_THICKNESS) * 2;
  const chromeY = isMobile
    ? MOBILE_PADDING * 2
    : (OUTER_GUTTER + FRAME_THICKNESS) * 2 + CAPTION_GAP + CAPTION_LINE;

  const bgColor = isMobile ? BG_MOBILE : BG_DESKTOP;
  const outerPadding = isMobile ? MOBILE_PADDING : OUTER_GUTTER;

  const imgEl = previewSrc ? (
    <Image
      src={previewSrc}
      alt={photo.image?.alt ?? photo.title}
      width={imgW}
      height={imgH}
      sizes="100vw"
      priority
      onLoad={() => setLoaded(true)}
      className="block w-auto h-auto"
      style={{
        maxWidth: `calc(100vw - ${chromeX}px)`,
        maxHeight: `calc(100vh - ${chromeY}px)`,
        transform: loaded ? 'scale(1)' : 'scale(0)',
        transformOrigin: 'center center',
        transition: 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    />
  ) : (
    <div
      className="flex items-center justify-center text-[var(--color-fg-muted)] text-sm"
      style={{ width: 400, height: 300 }}
    >
      Photo placeholder — no image available.
    </div>
  );

  return (
    <>
      {createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: bgColor, padding: outerPadding }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Loader bar — centered, fills 0→85%, snaps to 100% + fades on load.
          key={index} remounts the bar on photo change so the keyframe replays. */}
      {previewSrc && (
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 pointer-events-none flex flex-col items-center"
          style={{ zIndex: 30, transform: 'translate(-50%, -50%)', gap: 7 }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1,
              color: 'var(--color-fg)',
              opacity: loaded ? 0 : 1,
              transition: 'opacity 280ms ease-out 180ms',
            }}
          >
            loading
          </span>
          <div style={{ width: 100, height: 3 }}>
            <div
              key={index}
              className={`lightbox-loader-bar${loaded ? ' is-loaded' : ''}`}
              style={{
                height: '100%',
                // Orange d'état (brand book §4.3) : le chargement EST un
                // état, et c'est le seul endroit du site où la couleur
                // apparaît pendant qu'on regarde une photo — une fraction de
                // seconde, puis elle disparaît. Le mot « loading » au-dessus
                // reste en `--color-fg`.
                // Contraste : la barre est un élément GRAPHIQUE (seuil 3:1),
                // à 3,39:1 sur le backdrop desktop (barreau 1) et 3,75:1 sur le
                // blanc mobile. Passer le MOT en orange, lui, serait hors des
                // clous — 16 px en graisse normale demandent 4,5:1.
                backgroundColor: 'var(--color-link)',
                transformOrigin: 'left',
              }}
            />
          </div>
        </div>
      )}

      {/* Image stack — icons 4 px above the frame, caption 16 px below.
          • Mobile: bare image (no polaroid frame), white viewport = the frame.
          • Desktop: 32 px white polaroid frame around the image.
          The icon anchors and caption gap behave identically on both. */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className="relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Chrome wrappers: an outer span/div handles the load-driven fade
              (delayed 420 ms so it lands after the image's 500 ms scale-in),
              the inner element keeps its native hover transition. */}
          {isMobile ? (
            <div data-carousel-frame>{imgEl}</div>
          ) : (
            <div
              ref={frameRef}
              data-carousel-frame
              style={{ backgroundColor: FRAME_COLOR, padding: FRAME_THICKNESS }}
            >
              {imgEl}
            </div>
          )}
        </div>

        {/* Caption — desktop only, 16 px below the frame. */}
        {!isMobile && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              MICRO_LABEL_XS,
              'text-[var(--color-fg-muted)] flex items-center max-w-full leading-none'
            )}
            // La légende est CENTRÉE sous le cadre : le blanc de fin
            // d'interlettrage la décale d'un demi-cran vers la gauche. Le
            // retrait rend la boîte à sa largeur optique, donc le centrage
            // exact — même correction que pour un alignement à droite.
            style={{ marginTop: CAPTION_GAP, ...MICRO_LABEL_RIGHT_TRIM }}
          >
            <span className="text-[var(--color-fg)] truncate">
              {photo.title}
            </span>
            {/* marges inline : `mx-2` avalé par le reset global hors @layer.
                Le titre garde le gras de la constante, le reste redescend en
                normal : c'est la seule hiérarchie de cette ligne. */}
            <span className="font-normal opacity-50" style={{ marginLeft: 8, marginRight: 8 }}>
              ·
            </span>
            <span className="font-normal truncate">
              {photo.location} · {photo.year}
            </span>
          </div>
        )}
      </div>

      {/* Close — AU NIVEAU DE L'ÉCRAN, plus ancrée au cadre (demande Alexandre,
          2026-08-23). La lightbox occupe tout l'écran : c'est une page qu'on
          ferme, pas un panneau posé sur une autre. La croix va donc là où l'œil
          va chercher une fermeture de page — en haut à droite, dans la bande de
          64 px de la nav-bar, exactement où vit le bouton MENU (`top-0 right-0`,
          `h-16`, 32 px de retrait) sur toutes les autres pages.

          Deux bénéfices en prime : plus besoin de réserver de la largeur à
          l'image pour loger la croix dans la gouttière (elle récupère ses 24 px
          en desktop), et le même geste ferme sur les deux tailles d'écran.

          Encre du site (`--color-fg`) et PAS de `mix-blend-mode` : la croix est
          noire, comme demandé. */}
      <div
        className="fixed top-0 right-0 h-16 flex items-center"
        style={{
          paddingRight: 32,
          zIndex: 110,
          opacity: loaded ? 1 : 0,
          pointerEvents: loaded ? 'auto' : 'none',
          transition: loaded
            ? 'opacity 280ms ease-out 420ms'
            : 'opacity 160ms ease-out',
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="Close"
          className="flex items-center justify-center text-[var(--color-fg)] hover:opacity-60 transition-opacity motion-reduce:transition-none cursor-pointer"
        >
          <X size={closeSize} strokeWidth={2} />
        </button>
      </div>

      {/* Desktop prev/next arrows — pinned to left/right viewport edges,
          vertically centered. Hidden by default, revealed on cursor activity,
          re-hidden after 1 s idle. mix-blend-mode: difference keeps the white
          stroke readable on any backdrop (frame, photo, gutter). */}
      {!isMobile && (
        <>
          <button
            ref={leftArrowRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous photo"
            className="fixed top-1/2 flex items-center justify-center motion-reduce:transition-none"
            style={{
              // `right` is set imperatively to (window.innerWidth - frame.left + 32).
              transform: 'translateY(-50%)',
              zIndex: 25,
              padding: 12,
              background: 'transparent',
              border: 'none',
              mixBlendMode: 'difference',
              color: '#FFFFFF',
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 220ms ease-out',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={40} strokeWidth={2.5} />
          </button>
          <button
            ref={rightArrowRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next photo"
            className="fixed top-1/2 flex items-center justify-center motion-reduce:transition-none"
            style={{
              // `left` is set imperatively to (frame.right + 32).
              transform: 'translateY(-50%)',
              zIndex: 25,
              padding: 12,
              background: 'transparent',
              border: 'none',
              mixBlendMode: 'difference',
              color: '#FFFFFF',
              opacity: 0,
              pointerEvents: 'none',
              transition: 'opacity 220ms ease-out',
              cursor: 'pointer',
            }}
          >
            <ArrowRight size={40} strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>,
        document.body
      )}
    </>
  );
}
