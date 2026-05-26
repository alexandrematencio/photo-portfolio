'use client';

import Image from 'next/image';
import { useState } from 'react';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { Placeholder } from './Placeholder';
import { PhotoLightbox } from './PhotoLightbox';

export function PhotoCard({ photo }: { photo: Photo }) {
  const [open, setOpen] = useState(false);
  const builder = photo.image ? urlFor(photo.image) : null;
  const src = builder?.width(800).quality(80).auto('format').url() ?? null;
  const alt = photo.image?.alt ?? photo.title;
  const ratio = photo.image?.dimensions?.aspectRatio ?? 4 / 5;
  const clickable = Boolean(src);

  return (
    <>
      <figure
        className="group relative overflow-hidden bg-[var(--color-bg-elev)] break-inside-avoid"
        style={{ aspectRatio: ratio }}
      >
        {clickable ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
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
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-[10px] uppercase tracking-[0.2em] text-white bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:opacity-100 motion-reduce:bg-black/60">
          {photo.title}
          <span className="block text-white/70 mt-1 normal-case tracking-normal">
            {photo.location} · {photo.year}
          </span>
        </figcaption>
      </figure>

      {open && (
        <PhotoLightbox photo={photo} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
