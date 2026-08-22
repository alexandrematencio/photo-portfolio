'use client';

import Image from 'next/image';
import type { CSSProperties } from 'react';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { Placeholder } from './Placeholder';

/* Nom court affiché sous chaque photo (demande d'Alexandre, 2026-08-21) —
   mappé sur le slug du document `camera`. Un boîtier hors de cette liste
   retombe sur son `title` Sanity : la carte ne dépend pas de la map pour
   afficher quelque chose de juste. */
const CAMERA_DISPLAY_NAMES: Record<string, string> = {
  'olympus-om-d-e-m10-mk-iii': 'E-M10 MkIII',
  'fujifilm-x-pro-2': 'Fujifilm X-PRO2',
  'lumix-g7': 'Lumix G7',
  'samsung-s21-fe': 'Samsung S21',
};

type Props = {
  photo: Photo;
  /** Called when the user clicks the photo to open the lightbox carousel.
      The parent owns the carousel state (see PhotoLightbox's contract). */
  onOpen?: () => void;
};

/**
 * Item de la grille des archives — structure de la démo 2 Codrops « Grid
 * Layout Transitions » : boîte image au ratio natif, libellé (boîtier) en
 * tout petit dessous. Le style de la boîte (aspect-ratio, hover brightness)
 * vit dans globals.css (.grid-gallery-image).
 */
export function PhotoCard({ photo, onOpen }: Props) {
  const builder = photo.image ? urlFor(photo.image) : null;
  const src = builder?.width(800).quality(80).auto('format').url() ?? null;
  const alt = photo.image?.alt ?? photo.title;
  const ratio = photo.image?.dimensions?.aspectRatio ?? 4 / 5;
  const cameraName = photo.camera
    ? CAMERA_DISPLAY_NAMES[photo.camera.slug] ?? photo.camera.title
    : null;

  return (
    <figure
      id={`photo-${photo.slug.current}`}
      className="grid-gallery-item scroll-mt-24"
      style={{ '--aspect-ratio': String(ratio) } as CSSProperties}
    >
      {src ? (
        <button
          type="button"
          onClick={() => onOpen?.()}
          className="grid-gallery-image cursor-pointer text-left"
          aria-label={`Open “${photo.title}” fullscreen`}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 33vw, 20vw"
            className="object-cover"
          />
        </button>
      ) : (
        <div className="grid-gallery-image">
          <Placeholder title={photo.title} />
        </div>
      )}
      {cameraName && (
        // marginTop inline : `mt-*` avalé par le reset global hors @layer.
        <figcaption
          className="text-[11px] font-normal text-left text-[var(--color-fg-muted)]"
          style={{ marginTop: 6 }}
        >
          {cameraName}
        </figcaption>
      )}
    </figure>
  );
}
