'use client';

import Image from 'next/image';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { Placeholder } from './Placeholder';

type Props = {
  photo: Photo;
  /** Called when the user clicks the photo to open the lightbox carousel.
      The parent owns the carousel state (see PhotoLightbox's contract). */
  onOpen?: () => void;
};

export function PhotoCard({ photo, onOpen }: Props) {
  const builder = photo.image ? urlFor(photo.image) : null;
  const src = builder?.width(800).quality(80).auto('format').url() ?? null;
  const alt = photo.image?.alt ?? photo.title;
  const ratio = photo.image?.dimensions?.aspectRatio ?? 4 / 5;
  const clickable = Boolean(src);

  return (
    <figure
      id={`photo-${photo.slug.current}`}
      className="group relative overflow-hidden bg-[var(--color-bg-elev)] break-inside-avoid scroll-mt-24"
      style={{ aspectRatio: ratio }}
    >
      {clickable ? (
        <button
          type="button"
          onClick={() => onOpen?.()}
          className="absolute inset-0 cursor-zoom-in p-0 m-0 border-0 bg-transparent text-left"
          aria-label={`Open “${photo.title}” fullscreen`}
        >
          {src && (
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-700 ease-out motion-reduce:transition-none group-hover:scale-[1.03]"
            />
          )}
        </button>
      ) : (
        <Placeholder title={photo.title} />
      )}
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-[10px] uppercase text-white bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:opacity-100 motion-reduce:bg-black/60">
        {photo.title}
        {/* marginTop inline : `mt-1` avalé par le reset global hors @layer. */}
        <span
          className="block text-white/70 normal-case tracking-normal"
          style={{ marginTop: 4 }}
        >
          {photo.location} · {photo.year}
        </span>
      </figcaption>
    </figure>
  );
}
