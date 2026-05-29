'use client';

/**
 * OriginalViewer — full-screen zoomable view of the original Sanity asset.
 *
 * Triggered from the "Open original" button in PhotoLightbox. Replaces the
 * previous `target="_blank"` link so the user stays in-app and can:
 *   • pinch to zoom (touch)
 *   • double-tap / double-click to toggle between fit-to-screen (1×) and the
 *     original native pixel size (image_natural_width / fit_displayed_width)
 *   • drag / pan while zoomed in
 *   • Ctrl/wheel zoom (desktop)
 *   • Esc or the close button to exit → returns to the lightbox
 *
 * Renders into a portal at z-[200] so it sits above the PhotoLightbox (z-100).
 * Body scroll locked while open.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

type Props = {
  src: string;
  alt?: string;
  /** Natural width of the original asset (from Sanity image dimensions). */
  naturalWidth?: number;
  /** Natural height of the original asset. */
  naturalHeight?: number;
  onClose: () => void;
};

export function OriginalViewer({
  src,
  alt,
  naturalWidth,
  naturalHeight,
  onClose,
}: Props) {
  const [loaded, setLoaded] = useState(false);

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

  if (typeof window === 'undefined') return null;

  // Compute maxScale so that scale=1 fits the viewport and scale=maxScale is
  // 1 image pixel : 1 screen pixel (native). Falls back to lib default (8) if
  // we don't know the dimensions — better than nothing.
  // At scale=1, the <img> is displayed at fitDisplay = natural × fitRatio,
  // where fitRatio = min(vw/nw, vh/nh) (object-contain). To get 1:1 pixels,
  // we need to scale up by 1 / fitRatio.
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Original image viewer — pinch or double-click to zoom"
      className="fixed inset-0 z-[200] bg-black/95"
    >
      <TransformWrapper
        initialScale={1}
        minScale={1}
        maxScale={maxScale}
        // 'toggle' alternates between zoomed-out and zoomed-in. The `step` here
        // is the increment used when zoomed-out, so we set it to (maxScale-1)
        // so one double-click jumps directly to native pixel size.
        doubleClick={{
          mode: 'toggle',
          step: Math.max(0.5, maxScale - 1),
          animationTime: 220,
        }}
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

      {/* Hint chip — fades out after a few seconds, no JS needed for that
          since the user will dismiss the view anyway by tapping/zooming. */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 z-[1] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/80 bg-black/40 backdrop-blur-sm rounded-full"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 280ms ease-out 320ms' }}
      >
        pinch / double-tap to zoom
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
