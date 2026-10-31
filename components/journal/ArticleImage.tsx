'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import { EDITORIAL_SIDENOTE, MICRO_LABEL_XS } from '@/lib/site/typography';
import { frenchSpaces } from '@/lib/journal/french';
import type { JournalImage } from '@/lib/journal/types';
import { pushModalHistory } from '@/lib/utils/modalHistory';
import { cn } from '@/lib/utils/cn';

/**
 * Une image posée dans le texte d'un article (bloc « Image » du Studio,
 * 2026-10-18). Largeur de la mesure de lecture par défaut, comme la Fig. 1 ;
 * `wide` lui donne toute la colonne.
 *
 * `width` / `height` réservent la place avant le chargement (CLS < 0,05,
 * CLAUDE.md §3.5) ; `sizes` suit la largeur posée, pour que le navigateur
 * choisisse la bonne image du `srcset`.
 *
 * Vue agrandie (2026-10-31) : un schéma de 1584 px réduit à la mesure (680 px)
 * a un texte d'environ 6 px sur un écran 1x, illisible quoi qu'on serve. Un
 * clic l'ouvre à sa taille réelle (plafonnée à l'écran), dans un calque qui
 * défile. Pastille « Voir en grand » toujours visible en haut à droite :
 * l'action se découvre sans survol, au doigt comme à la souris.
 */
export function ArticleImage({
  image,
  caption,
  wide,
  enlargeLabel,
  closeLabel,
  style,
}: {
  image: JournalImage;
  caption?: string;
  wide: boolean;
  enlargeLabel: string;
  closeLabel: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  return (
    <figure className="flex flex-col gap-3" style={{ maxWidth: wide ? undefined : 'var(--editorial-measure)', ...style }}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={image.alt ? `${enlargeLabel}. ${image.alt}` : enlargeLabel}
        className="group relative block w-full cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-fg)]"
      >
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
        <span
          aria-hidden="true"
          className={cn(
            MICRO_LABEL_XS,
            'absolute top-2 right-2 inline-flex items-center gap-1.5',
            'border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-fg)] opacity-85',
            'motion-safe:transition-[opacity,border-color] motion-safe:duration-150 motion-safe:ease-out',
            'group-hover:opacity-100 group-hover:border-[var(--color-fg)] group-focus-visible:opacity-100 group-focus-visible:border-[var(--color-fg)]',
          )}
          // Inline : le reset `* { padding: 0 }` (globals.css) avale les utilities de padding.
          style={{ padding: '4px 8px' }}
        >
          <Maximize2 size={11} strokeWidth={2} />
          {enlargeLabel}
        </span>
      </button>
      {caption && <figcaption className={EDITORIAL_SIDENOTE}>{frenchSpaces(caption)}</figcaption>}
      {open && <ImageViewer image={image} closeLabel={closeLabel} onClose={close} />}
    </figure>
  );
}

/** Sortie plus courte que l'entrée (animation-principles §9). */
const ENTER_MS = 220;
const EXIT_MS = 150;

function reducedMotion() {
  return !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

/**
 * Le calque de la vue agrandie : l'image à sa largeur réelle (jamais plus
 * large que l'écran), centrée, défilement vertical si elle dépasse. Fermeture
 * par Échap, le bouton, un clic hors de l'image, ou le bouton Retour du
 * navigateur (`pushModalHistory`). Un clic SUR l'image ne ferme pas : on y
 * clique en lisant.
 */
function ImageViewer({ image, closeLabel, onClose }: { image: JournalImage; closeLabel: string; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const leaving = useRef(false);

  const dismiss = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    if (reducedMotion()) return onClose();
    setShown(false);
    window.setTimeout(onClose, EXIT_MS);
  }, [onClose]);

  const dismissRef = useRef(dismiss);
  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissRef.current();
      // Le focus reste dans le calque : un seul élément focalisable, le bouton.
      else if (e.key === 'Tab') {
        e.preventDefault();
        closeButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // La page défile dans `[data-scroll-container]` (FramedScroll), `body` à défaut.
    const page = document.querySelector<HTMLElement>('[data-scroll-container]');
    const prev = { body: document.body.style.overflow, page: page?.style.overflow };
    document.body.style.overflow = 'hidden';
    if (page) page.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev.body;
      if (page) page.style.overflow = prev.page ?? '';
    };
  }, []);

  useEffect(() => pushModalHistory(() => dismissRef.current()), []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.alt || undefined}
      onClick={dismiss}
      className={cn(
        'fixed inset-0 z-[100] overflow-auto overscroll-contain cursor-zoom-out',
        'motion-safe:transition-opacity',
        shown ? 'opacity-100' : 'opacity-0',
      )}
      style={{
        backgroundColor: 'var(--color-bg)',
        transitionDuration: `${shown ? ENTER_MS : EXIT_MS}ms`,
        transitionTimingFunction: shown ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.4, 0, 1, 1)',
      }}
    >
      <button
        ref={closeButton}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className={cn(
          MICRO_LABEL_XS,
          'fixed top-4 right-4 z-[1] inline-flex items-center gap-1.5 cursor-pointer',
          'border border-[var(--color-fg)] bg-[var(--color-bg)] text-[var(--color-fg)]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg)]',
        )}
        style={{ padding: '6px 10px' }}
      >
        <X size={12} strokeWidth={2} aria-hidden="true" />
        {closeLabel}
      </button>
      <div
        className="flex min-h-full items-center justify-center"
        style={{ padding: '64px var(--page-gutter) 24px' }}
      >
        <img
          src={image.full}
          width={image.width}
          height={image.height}
          alt={image.alt}
          decoding="async"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'block h-auto max-w-full cursor-default',
            // Image qui suit le fond avec un léger retard (chevauchement, §5).
            'motion-safe:transition-[opacity,translate]',
            shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
          style={{
            width: image.width,
            backgroundColor: 'var(--color-bg-elev)',
            transitionDuration: `${shown ? ENTER_MS + 60 : EXIT_MS}ms`,
            transitionDelay: shown ? '40ms' : '0ms',
            transitionTimingFunction: shown ? 'cubic-bezier(0.22, 1, 0.36, 1)' : 'cubic-bezier(0.4, 0, 1, 1)',
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
