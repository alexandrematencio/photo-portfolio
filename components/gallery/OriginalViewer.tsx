'use client';

/**
 * OriginalViewer — full-screen zoomable view of the original Sanity asset.
 *
 * Triggered from the "Open original" button in PhotoLightbox. Replaces the
 * previous `target="_blank"` link so the user stays in-app and can:
 *   • pinch to zoom — manual, continuous (touch)
 *   • Ctrl/wheel zoom — manual, continuous (desktop)
 *   • double-tap (mobile) / double-click (desktop): one-shot TOGGLE between
 *     fit-to-screen (scale 1) and the original's max zoom (= 1 image pixel
 *     per 1 screen pixel). Zooms in CENTERED on the tap / click point.
 *   • drag / pan while zoomed in
 *   • Esc or the close button to exit → returns to the lightbox
 *
 * Why imperative double-tap: the library's built-in `doubleClick.mode = 'toggle'`
 * toggles between scale=1 and scale=step (NOT step-added). Combined with a
 * non-max step value, double-taps appear to "step zoom" instead of jumping to
 * full size in a single gesture. We disable the built-in handler and drive
 * `setTransform` ourselves — one tap = full max zoom or full fit-screen,
 * centered on the touch point, no intermediate state.
 *
 * Renders into a portal at z-[200] so it sits above the PhotoLightbox (z-100).
 * Body scroll locked while open.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from 'react-zoom-pan-pinch';
import { pushModalHistory } from '@/lib/utils/modalHistory';

type Props = {
  src: string;
  alt?: string;
  /** Natural width of the original asset (from Sanity image dimensions). */
  naturalWidth?: number;
  /** Natural height of the original asset. */
  naturalHeight?: number;
  onClose: () => void;
};

/** How long the hint chip stays visible after the image finishes loading. */
const HINT_DURATION_MS = 3000;
/** Max delay between two taps to count as a double-tap (mobile). */
const DOUBLE_TAP_DELAY_MS = 300;
/** Animation duration for the imperative zoom toggle. */
const TOGGLE_ANIM_MS = 280;

export function OriginalViewer({
  src,
  alt,
  naturalWidth,
  naturalHeight,
  onClose,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const lastTapRef = useRef(0);

  // Esc + scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Browser back integration — see lib/utils/modalHistory. Push a history
  // entry on mount so back closes the viewer first (one layer above the
  // lightbox in the modal stack), not navigates to the previous page.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    return pushModalHistory(() => onCloseRef.current());
  }, []);

  // Hint chip: show for HINT_DURATION_MS once the image is loaded, then fade.
  // The visibility is gated on `loaded` so the chip never shows during the
  // (slow) download — only once the user can actually act on the hint.
  useEffect(() => {
    if (!loaded) return;
    setHintVisible(true);
    const t = window.setTimeout(() => setHintVisible(false), HINT_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [loaded]);

  if (typeof window === 'undefined') return null;

  // Compute maxScale so that scale=1 fits the viewport and scale=maxScale is
  // 1 image pixel : 1 screen pixel (native). Falls back to lib default (8) if
  // we don't know the dimensions.
  // At scale=1, the <img> displays at fitDisplay = natural × fitRatio where
  // fitRatio = min(vw/nw, vh/nh) (object-contain). To reach 1:1 pixels we
  // scale up by 1 / fitRatio.
  let maxScale = 8;
  if (naturalWidth && naturalHeight) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fitRatio = Math.min(vw / naturalWidth, vh / naturalHeight);
    // If the image is already smaller than the viewport (fitRatio > 1), there's
    // nothing to zoom into past 1:1, so clamp maxScale to at least 2 for a
    // little hover-zoom feel; otherwise compute the true 1:1 scale.
    maxScale = fitRatio < 1 ? Math.max(1.5, 1 / fitRatio) : 2;
  }

  /**
   * One-shot toggle: jump to maxScale (centered at the gesture point) if
   * currently fit-screen, otherwise reset to fit. No step-by-step zoom.
   *
   * The dialog is `fixed inset-0` so viewport coords (clientX/Y) equal the
   * TransformWrapper container coords — we feed them directly into the
   * setTransform formula.
   *
   * Image point under (cx, cy) is at image coord ((cx - posX) / scale, …).
   * To keep that point under (cx, cy) after zoom, the new position must be:
   *   newPosX = cx - ((cx - posX) / scale) * newScale
   *           = cx - (cx - posX) * (newScale / scale)
   */
  const toggleZoom = (clientX: number, clientY: number) => {
    const ref = transformRef.current;
    if (!ref) return;
    const { scale, positionX, positionY } = ref.state;

    if (scale >= maxScale - 0.05) {
      ref.resetTransform(TOGGLE_ANIM_MS, 'easeOut');
      return;
    }

    const ratio = maxScale / scale;
    const newX = clientX - (clientX - positionX) * ratio;
    const newY = clientY - (clientY - positionY) * ratio;
    ref.setTransform(newX, newY, maxScale, TOGGLE_ANIM_MS, 'easeOut');
  };

  // Mouse double-click → toggle.
  const onDoubleClick: React.MouseEventHandler = (e) => {
    toggleZoom(e.clientX, e.clientY);
  };

  // Touch double-tap detection → toggle. We ignore multi-touch (pinch) so the
  // library's pinch handler retains full control over those gestures.
  const onTouchEnd: React.TouchEventHandler = (e) => {
    if (e.touches.length > 0 || e.changedTouches.length > 1) return;
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
      const t = e.changedTouches[0];
      toggleZoom(t.clientX, t.clientY);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Original image viewer — pinch or double-click to zoom in or out"
      className="fixed inset-0 z-[200] bg-black/95"
    >
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={1}
        maxScale={maxScale}
        // Built-in double-click disabled — we own the toggle behavior via
        // setTransform so it's a single instant jump (1 ↔ maxScale) centered
        // on the gesture, not a step-by-step increment.
        doubleClick={{ disabled: true }}
        pinch={{ step: 5 }}
        wheel={{ step: 0.1 }}
        limitToBounds={true}
        centerOnInit={true}
      >
        <TransformComponent
          wrapperStyle={{ width: '100vw', height: '100vh' }}
          contentStyle={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={src}
            alt={alt ?? ''}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onDoubleClick={onDoubleClick}
            onTouchEnd={onTouchEnd}
            style={{
              maxWidth: '100vw',
              maxHeight: '100vh',
              objectFit: 'contain',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
          />
        </TransformComponent>
      </TransformWrapper>

      {/* Loader while the original (can be 10+ MB) downloads. */}
      {!loaded && (
        <div
          aria-hidden
          className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1] flex flex-col items-center gap-2 text-white/80"
        >
          <span className="text-sm">loading original…</span>
          <div className="w-24 h-[3px] bg-white/20 overflow-hidden rounded">
            <div
              className="h-full bg-white/80 animate-pulse"
              style={{ width: '60%' }}
            />
          </div>
        </div>
      )}

      {/* Hint chip — visible for HINT_DURATION_MS after the image loads, then
          fades out. Generous padding for breathing room. */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-[1] px-6 py-3 text-[11px] uppercase text-white/90 bg-black/60 backdrop-blur-sm rounded-full"
        style={{
          opacity: hintVisible ? 1 : 0,
          transition: hintVisible
            ? 'opacity 280ms ease-out 240ms'
            : 'opacity 520ms ease-out',
        }}
      >
        pinch / double-tap to zoom in or out
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close original viewer"
        className="fixed top-4 right-4 z-[2] flex items-center justify-center w-10 h-10 rounded-full bg-white/85 hover:bg-white text-black transition-colors"
      >
        <X size={20} strokeWidth={2} />
      </button>
    </div>,
    document.body
  );
}
