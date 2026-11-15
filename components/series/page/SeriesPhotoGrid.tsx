'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { PhotoCard } from '@/components/gallery/PhotoCard';
import { PhotoLightbox } from '@/components/gallery/PhotoLightbox';
import type { Photo } from '@/lib/sanity/queries';

/**
 * Grille des photos d'une page `/series/[slug]`.
 *
 * Contrat de la lightbox (CLAUDE.md §3.4) : UNE instance par page, possédée
 * ici, et alimentée avec le tableau complet + l'index — la lightbox est un
 * carousel, jamais un viewer d'une seule photo. `PhotoCard` ne la contient pas.
 *
 * Colonnes en `auto-fill` plutôt que la grille à densité des archives : une
 * série compte de 3 à 36 photos, et dix colonnes pour trois images en feraient
 * des timbres-poste. `align-items: start` — des ratios différents ne s'étirent
 * pas à la hauteur de la plus haute.
 */
/** La grille, partagée avec /work (`WorkGallery`) — une seule définition. */
export const PHOTO_GRID_STYLE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))',
  gap: '1.5rem',
  alignItems: 'start',
  width: '100%',
};

export function SeriesPhotoGrid({ photos }: { photos: Photo[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <>
      <div style={PHOTO_GRID_STYLE}>
        {photos.map((p, i) => (
          <PhotoCard key={p._id} photo={p} onOpen={() => setOpenIndex(i)} />
        ))}
      </div>
      {openIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
