'use client';

import { Play, X } from 'lucide-react';
import Link from 'next/link';
import type { Ref } from 'react';
import { PhotoCard } from '@/components/gallery/PhotoCard';
import { PHOTO_GRID_STYLE } from '@/components/series/page/SeriesPhotoGrid';
import { cn } from '@/lib/utils/cn';
import { collectionPlaces, type PreparedSeries } from '@/lib/site/series';
import { EDITORIAL_LINK_DECORATION, MICRO_LABEL, PAGE_CONTROLS_GAP } from '@/lib/site/typography';

type Props = {
  collection: PreparedSeries;
  /** Haut mesuré du conteneur de scroll à l'ouverture (64 px desktop, variable sur mobile) :
   *  la nav-bar reste visible et ne bouge pas. */
  top: number;
  onClose: () => void;
  onOpenPhoto: (index: number) => void;
  onPlay: () => void;
  closeRef: Ref<HTMLButtonElement>;
  gridRef: Ref<HTMLDivElement>;
};

const BUTTON = cn(MICRO_LABEL, 'inline-flex items-center gap-2 text-[var(--color-fg)]');

/**
 * L'album ouvert d'une collection, en surimpression. Ne porte PAS la lightbox (§3.4) :
 * il remonte l'index de la photo cliquée au porteur d'état, `WorkCarousels`.
 */
export function AlbumView({ collection, top, onClose, onOpenPhoto, onPlay, closeRef, gridRef }: Props) {
  const n = collection.photos.length;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`album-title-${collection.slug}`}
      data-album
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        top,
        zIndex: 40, // sous la nav-bar (`z-50`, SiteHeader)
        background: 'var(--color-bg)',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        paddingInline: 'var(--page-gutter)',
        paddingBlock: '24px 96px',
      }}
    >
      <header
        className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3"
        style={{ marginBottom: PAGE_CONTROLS_GAP }}
      >
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1">
          <h2 id={`album-title-${collection.slug}`} className={cn(MICRO_LABEL, 'text-[var(--color-fg)]')}>
            {collection.title}
          </h2>
          <p className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}>
            {n} photo{n === 1 ? '' : 's'}
            {collectionPlaces(collection.photos) ? ` · ${collectionPlaces(collection.photos)}` : ''}
          </p>
          <Link href={`/series/${collection.slug}/`} className={cn(MICRO_LABEL, EDITORIAL_LINK_DECORATION)}>
            About this collection
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <button type="button" className={BUTTON} onClick={onPlay}>
            <Play size={12} aria-hidden fill="currentColor" strokeWidth={0} />
            Play
          </button>
          <button type="button" ref={closeRef} className={BUTTON} onClick={onClose}>
            <X size={14} aria-hidden />
            Close
          </button>
        </div>
      </header>
      <div ref={gridRef} style={{ ...PHOTO_GRID_STYLE, perspective: '900px' }}>
        {collection.photos.map((p, k) => (
          <PhotoCard key={p._id} photo={p} onOpen={() => onOpenPhoto(k)} />
        ))}
      </div>
    </div>
  );
}
