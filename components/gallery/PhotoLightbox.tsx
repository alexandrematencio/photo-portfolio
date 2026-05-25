'use client';

import Image from 'next/image';
import { useEffect } from 'react';
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
      {/* Bouton fermer — au-dessus de tout, dans la gouttière externe */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Fermer"
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
          aria-label="Ouvrir l'original dans un nouvel onglet"
        >
          <ExternalLink size={12} strokeWidth={2} />
          <span className="hidden md:inline">Ouvrir l'original</span>
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
            className="block w-auto h-auto"
            style={{
              maxWidth: `calc(100vw - ${totalChromePerAxis}px)`,
              maxHeight: `calc(100vh - ${totalChromePerAxis}px)`,
            }}
          />
        ) : (
          <div
            className="flex items-center justify-center text-[var(--color-fg-muted)] text-sm"
            style={{ width: 400, height: 300 }}
          >
            Photo placeholder — aucune image disponible.
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
