'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';

type Props = {
  photo: Photo;
  onClose: () => void;
};

// Bg full-screen
const BG_COLOR = '#F7F3F1';
// Cadre blanc style polaroid : 32px d'épaisseur FIXE collés à l'image
const FRAME_COLOR = '#FFFFFF';
const FRAME_THICKNESS = 32;
// Marge externe entre le cadre et le bord du viewport (zone #F7F3F1)
const OUTER_GUTTER = 32;

export function PhotoLightbox({ photo, onClose }: Props) {
  // Preview image load state — drives the 3px loader bar at top of the viewport.
  // next/image fires onLoad once the underlying <img> resolved (cached or downloaded).
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

  const builder = photo.image ? urlFor(photo.image) : null;
  const previewSrc = builder?.width(2400).quality(88).auto('format').url();
  const originalSrc = builder?.url();

  // Dimensions intrinsèques de l'image (Sanity stocke metadata.dimensions à l'upload).
  // Servent à next/image pour calculer la taille de rendu, et à ratio l'auto-shrink.
  const imgW = photo.image?.dimensions?.width ?? 2400;
  const imgH = photo.image?.dimensions?.height ?? 1800;

  // Espace total occupé par les marges + cadre sur chaque axe.
  // = OUTER_GUTTER (côté A) + FRAME_THICKNESS (côté A) + FRAME_THICKNESS (côté B) + OUTER_GUTTER (côté B)
  const totalChromePerAxis = (OUTER_GUTTER + FRAME_THICKNESS) * 2;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ backgroundColor: BG_COLOR, padding: OUTER_GUTTER }}
      onClick={onClose}
    >
      {/* Loader bar — 100×3 px ink line centered in the viewport with "loading"
          label above. Fills while the preview JPEG is downloading, snaps to 100%
          + fades when loaded (label fades in sync). */}
      {previewSrc && (
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 pointer-events-none flex flex-col items-center"
          style={{
            zIndex: 30,
            transform: 'translate(-50%, -50%)',
            gap: 7,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
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
              className={`lightbox-loader-bar${loaded ? ' is-loaded' : ''}`}
              style={{
                height: '100%',
                backgroundColor: 'var(--color-fg)',
                transformOrigin: 'left',
              }}
            />
          </div>
        </div>
      )}

      {/* Bouton fermer — au-dessus de tout, dans la gouttière externe */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        className="absolute top-2 right-2 z-20 size-7 flex items-center justify-center text-[var(--color-fg)] hover:opacity-60 transition-opacity motion-reduce:transition-none"
      >
        <X size={20} strokeWidth={2} />
      </button>

      {/* Lien "ouvrir l'original" — gouttière externe haut-gauche */}
      {originalSrc && (
        <a
          href={originalSrc}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 left-2 z-20 flex items-center gap-2 h-7 px-1 text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors motion-reduce:transition-none"
          aria-label="Open original in a new tab"
        >
          <ExternalLink size={12} strokeWidth={2} />
          <span className="hidden md:inline">Open original</span>
        </a>
      )}

      {/*
        Cadre blanc "polaroid" : taille = image rendue + 32px sur chaque côté.
        Le cadre se rétracte avec l'image — épaisseur du blanc TOUJOURS 32px,
        peu importe la taille finale de l'image.
      */}
      <div
        className="relative shrink-0"
        style={{
          backgroundColor: FRAME_COLOR,
          padding: FRAME_THICKNESS,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {previewSrc ? (
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
              maxWidth: `calc(100vw - ${totalChromePerAxis}px)`,
              maxHeight: `calc(100vh - ${totalChromePerAxis}px)`,
              // Image grows from 0 → full size once loaded. The white frame is
              // already at its final dimensions (layout reserved by width/height
              // attrs) — only the painted bitmap scales in. Transform-only =
              // no layout thrash. Brand book §3.2 default ease (expo.out).
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
        )}
      </div>

      {/* Caption single-line — gouttière externe bas */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-160px)] truncate text-center text-[10px] uppercase tracking-[0.25em] text-[var(--color-fg-muted)] h-7 flex items-center"
      >
        <span className="font-bold text-[var(--color-fg)] truncate">
          {photo.title}
        </span>
        <span className="mx-2 opacity-50">·</span>
        <span className="truncate">
          {photo.location} · {photo.year}
        </span>
      </div>
    </div>,
    document.body
  );
}
