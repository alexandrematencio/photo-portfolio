import type { CSSProperties } from 'react';
import { EDITORIAL_SIDENOTE } from '@/lib/site/typography';
import { frenchSpaces } from '@/lib/journal/french';
import type { JournalImage } from '@/lib/journal/types';

/**
 * Une image posée dans le texte d'un article (bloc « Image » du Studio,
 * 2026-10-18). Largeur de la mesure de lecture par défaut, comme la Fig. 1 ;
 * `wide` lui donne toute la colonne.
 *
 * `width` / `height` réservent la place avant le chargement (CLS < 0,05,
 * CLAUDE.md §3.5) ; `sizes` suit la largeur posée, pour que le navigateur
 * choisisse la bonne image du `srcset`.
 */
export function ArticleImage({
  image,
  caption,
  wide,
  style,
}: {
  image: JournalImage;
  caption?: string;
  wide: boolean;
  style?: CSSProperties;
}) {
  return (
    <figure className="flex flex-col gap-3" style={{ maxWidth: wide ? undefined : 'var(--editorial-measure)', ...style }}>
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={wide ? '(min-width: 1200px) 1107px, 100vw' : '(min-width: 760px) 680px, 100vw'}
        width={image.width}
        height={image.height}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        className="block w-full h-auto"
        style={{ backgroundColor: 'var(--color-bg-elev)' }}
      />
      {caption && <figcaption className={EDITORIAL_SIDENOTE}>{frenchSpaces(caption)}</figcaption>}
    </figure>
  );
}
