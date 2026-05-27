'use client';

import Image from 'next/image';
import { forwardRef } from 'react';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { Placeholder } from './Placeholder';

type Props = {
  photo: Photo | null;
  index: number;
  /** Called when the user clicks the photo to open the lightbox carousel.
      The parent owns the carousel state (see PhotoLightbox's contract). */
  onOpen?: (index: number) => void;
};

export const PhotoBlock = forwardRef<HTMLDivElement, Props>(
  function PhotoBlock({ photo, index, onOpen }, ref) {
    const builder = photo?.image ? urlFor(photo.image) : null;
    const src = builder?.width(1600).quality(80).auto('format').url() ?? null;
    const alt = photo?.image?.alt ?? photo?.title ?? 'Photographie A. Matencio';
    const speed = photo?.parallaxSpeed ?? 0.1;
    const ratio = photo?.image?.dimensions?.aspectRatio ?? 4 / 5;
    const clickable = Boolean(photo && src);

    return (
      <figure
        ref={ref}
        className="photo-item"
        data-speed={speed}
        style={{ ['--ratio' as string]: ratio }}
        aria-label={photo?.title ?? `Photo placeholder ${index + 1}`}
      >
        {clickable ? (
          <button
            type="button"
            onClick={() => onOpen?.(index)}
            className="photo-inner cursor-zoom-in w-full h-full p-0 m-0 border-0 bg-transparent"
            aria-label={`Open “${photo?.title}” fullscreen`}
          >
            {src && (
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(max-width: 768px) 80vw, 600px"
                priority={index < 2}
                className="object-cover"
              />
            )}
          </button>
        ) : (
          <div className="photo-inner">
            <Placeholder title={photo?.title} />
          </div>
        )}
        {photo?.caption && (
          <figcaption className="sr-only">{photo.caption}</figcaption>
        )}
      </figure>
    );
  }
);
