'use client';

import { Play, X } from 'lucide-react';
import Link from 'next/link';
import type { Ref } from 'react';
import { PhotoCard } from '@/components/gallery/PhotoCard';
import { PHOTO_GRID_STYLE } from '@/components/series/page/SeriesPhotoGrid';
import { cn } from '@/lib/utils/cn';
import { collectionPlaces, type PreparedSeries } from '@/lib/site/series';
import { EDITORIAL_LINK_DECORATION, PAGE_CONTROLS_GAP } from '@/lib/site/typography';

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

/** Titre : la voix du H2 du site, un cran plus petit sur mobile pour laisser la place aux boutons. */
const TITLE =
  'min-w-0 text-[26px] md:text-[43px] font-bold uppercase tracking-[-0.02em] leading-[0.95] text-[var(--color-fg)] [overflow-wrap:anywhere]';

/**
 * Commandes (Play, Close) : 44 px de haut (cible tactile), pastille cerclée qui s'inverse au survol.
 * Sur mobile, icône seule (nom accessible par `aria-label`) ; le libellé revient dès `sm`.
 */
const BUTTON = cn(
  'inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-[var(--color-fg)] album-command', // padding : site.css (reset `* { padding: 0 }`)
  'text-[14px] font-bold uppercase tracking-[-0.02em] text-[var(--color-fg)]',
  'transition-colors hover:bg-[var(--color-fg)] hover:text-[var(--color-bg)] motion-reduce:transition-none',
);

/**
 * L'album ouvert d'une collection, en surimpression. Ne porte PAS la lightbox (§3.4) :
 * il remonte l'index de la photo cliquée au porteur d'état, `WorkCarousels`.
 */
export function AlbumView({ collection, top, onClose, onOpenPhoto, onPlay, closeRef, gridRef }: Props) {
  const n = collection.photos.length;
  const places = collectionPlaces(collection.photos);
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
        paddingBlock: '0 96px', // le haut est porté par l'en-tête collant
      }}
    >
      {/* En-tête collant : Close reste à portée de main quand on descend dans un long album. */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-[var(--color-bg)]"
        // Inline : le reset global du site écrase padding et marges utilitaires sur ces éléments.
        style={{ paddingBlock: '20px 12px' }}
      >
        <h2 id={`album-title-${collection.slug}`} className={TITLE}>
          {collection.title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" className={BUTTON} onClick={onPlay} aria-label="Play slideshow">
            <Play size={16} aria-hidden fill="currentColor" strokeWidth={0} />
            <span className="hidden sm:inline">Play</span>
          </button>
          <button type="button" ref={closeRef} className={BUTTON} onClick={onClose} aria-label="Close album">
            <X size={18} aria-hidden strokeWidth={2.25} />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </header>
      <div
        className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[13px] font-bold uppercase tabular-nums"
        style={{ marginTop: 4, marginBottom: PAGE_CONTROLS_GAP }}
      >
        <p className="text-[var(--color-fg-muted)]">
          {n} photo{n === 1 ? '' : 's'}
          {places ? ` · ${places}` : ''}
        </p>
        <Link href={`/series/${collection.slug}/`} className={EDITORIAL_LINK_DECORATION}>
          About this collection
        </Link>
      </div>
      <div ref={gridRef} style={{ ...PHOTO_GRID_STYLE, perspective: '900px' }}>
        {collection.photos.map((p, k) => (
          <PhotoCard key={p._id} photo={p} onOpen={() => onOpenPhoto(k)} />
        ))}
      </div>
    </div>
  );
}
