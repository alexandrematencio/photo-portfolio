'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';
import { Placeholder } from './Placeholder';
import { MICRO_LABEL } from '@/lib/site/typography';

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
 * tout petit dessous. Le style de la boîte (aspect-ratio) et celui de la loupe
 * de survol vivent dans globals.css (.grid-gallery-image / .grid-gallery-zoom).
 */
export function PhotoCard({ photo, onOpen }: Props) {
  // Loupe : on écrit --loupe-x / --loupe-y sur le calque de zoom, jamais en
  // state React — une position de curseur ne doit pas provoquer de re-render
  // sur une grille qui compte ~200 cartes. Le style de la loupe vit dans
  // globals.css (.grid-gallery-zoom).
  const zoomRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  const trackLoupe = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    // Tactile et stylet exclus : sans survol, la loupe n'aurait aucun moyen de
    // se refermer (le CSS la coupe déjà via `(hover: hover) and (pointer: fine)`).
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    // Clamp : sur un mouvement rapide, le dernier événement peut tomber d'un
    // cheveu hors de la boîte. Une origine hors boîte découvrirait le fond.
    const clamp = (v: number) => (v < 0 ? 0 : v > 100 ? 100 : v);
    pendingRef.current = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100),
    };
    // Throttle rAF : une seule écriture de style par frame, quel que soit le
    // débit des `pointermove`.
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const next = pendingRef.current;
      const el = zoomRef.current;
      if (!next || !el) return;
      el.style.setProperty('--loupe-x', `${next.x}%`);
      el.style.setProperty('--loupe-y', `${next.y}%`);
    });
  }, []);

  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    []
  );

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
          // `pointerenter` autant que `pointermove` : l'origine doit être posée
          // AVANT que le :hover CSS ne lance la montée d'échelle, sinon la
          // première frame grossit depuis l'origine du survol précédent.
          onPointerEnter={trackLoupe}
          onPointerMove={trackLoupe}
          className="grid-gallery-image cursor-pointer text-left"
          aria-label={`Open “${photo.title}” fullscreen`}
        >
          <div ref={zoomRef} className="grid-gallery-zoom">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="(max-width: 768px) 33vw, 20vw"
              className="object-cover"
            />
          </div>
        </button>
      ) : (
        <div className="grid-gallery-image">
          <Placeholder title={photo.title} />
        </div>
      )}
      {cameraName && (
        // marginTop inline : `mt-*` avalé par le reset global hors @layer.
        //
        // Cette légende rejoint la famille des capitales micro du site (année,
        // fiche technique, titre de groupe) : c'est une ÉTIQUETTE de photo, elle
        // n'a pas de raison d'être la seule à parler autrement. Changement
        // VISIBLE — 200 cartes en bas-de-casse passent en petites capitales
        // espacées ; c'est justement la question « est-ce que toute la page
        // appartient à sa console ».
        <figcaption
          className={`${MICRO_LABEL} text-left text-[var(--color-fg-muted)]`}
          style={{ marginTop: 6 }}
        >
          {cameraName}
        </figcaption>
      )}
    </figure>
  );
}
