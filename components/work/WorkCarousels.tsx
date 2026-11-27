'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PhotoLightbox } from '@/components/gallery/PhotoLightbox';
import type { PreparedSeries } from '@/lib/site/series';
import { pushModalHistory } from '@/lib/utils/modalHistory';
import { AlbumView } from './AlbumView';
import { CarouselScene } from './CarouselScene';
import { bindWorkCarousels, type WorkMotion } from './carousel-motion';

type Phase = 'idle' | 'opening' | 'open' | 'closing';

/**
 * Porteur d'état de /work : album ouvert, lightbox, historique, adresse, focus.
 * Une seule lightbox, état ICI (CLAUDE.md §3.4). La mécanique GSAP vit dans `carousel-motion.ts`.
 */
export function WorkCarousels({ collections }: { collections: PreparedSeries[] }) {
  const [album, setAlbum] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [lightbox, setLightbox] = useState<{ index: number; autoplay: boolean } | null>(null);
  const [albumTop, setAlbumTop] = useState(64);

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const motionRef = useRef<WorkMotion | null>(null);
  /** Nettoyage rendu par `pushModalHistory` : l'UNE porte de sortie de l'album. */
  const popRef = useRef<(() => void) | null>(null);
  // Miroirs lisibles de façon synchrone par les écouteurs natifs (un `setState` n'est pas vu avant le microtask).
  const albumRef = useRef<number | null>(null);
  const lightboxRef = useRef(lightbox);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const motion = bindWorkCarousels(root);
    motionRef.current = motion;
    return () => {
      motion?.destroy();
      motionRef.current = null;
    };
  }, []);

  const setLightboxBoth = useCallback((v: { index: number; autoplay: boolean } | null) => {
    lightboxRef.current = v;
    setLightbox(v);
  }, []);

  /** Ferme l'album. Une seule porte : Close, Esc et retour navigateur y passent tous. */
  const closeAlbum = useCallback(() => {
    const i = albumRef.current;
    if (i === null) return;
    albumRef.current = null;
    setLightboxBoth(null);
    popRef.current?.();
    popRef.current = null;
    motionRef.current?.setLocked(false);
    setAlbum(null);
    setPhase('idle');
    // Focus rendu au lien-titre de la scène.
    requestAnimationFrame(() => {
      rootRef.current?.querySelector<HTMLElement>(`[data-scene="${i}"] a[data-open]`)?.focus({ preventScroll: true });
    });
  }, [setLightboxBoth]);

  const openAlbum = useCallback(
    (i: number, instant = false) => {
      if (albumRef.current !== null) return;
      const motion = motionRef.current;
      const slug = collections[i]?.slug;
      if (!motion || !slug) return;
      const { scroller, scenes } = motion;
      albumRef.current = i;
      setAlbumTop(Math.round(scroller.getBoundingClientRect().top));
      if (instant) {
        // Arrivée par adresse : la scène est amenée au centre sans animation.
        const scene = scenes[i];
        scroller.scrollTop = Math.max(0, scene.offsetTop + scene.offsetHeight / 2 - scroller.clientHeight / 2);
      }
      motion.setLocked(true);
      popRef.current = pushModalHistory(closeAlbum);
      window.history.replaceState(window.history.state, '', `#${slug}`);
      setAlbum(i);
      setPhase('opening');
      // Fin de l'ouverture (le vol vient en tâche 6) : l'album est là, le focus va sur Close.
      requestAnimationFrame(() => {
        if (albumRef.current !== i) return;
        setPhase('open');
        closeRef.current?.focus({ preventScroll: true });
      });
    },
    [collections, closeAlbum],
  );

  // Adresse au montage : `#slug` d'une collection existante → album ouvert sans vol.
  // Différé d'un tick et annulable : le mode strict monte, démonte et remonte l'effet de
  // mécanique ci-dessus, et l'album doit s'ouvrir sur la mécanique FINALE.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let slug = '';
      try {
        slug = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return; // `#%E0` lève URIError
      }
      const i = collections.findIndex((c) => c.slug === slug);
      if (i < 0) return;
      // Le fragment est retiré de l'entrée d'arrivée avant d'empiler : le retour ramène à /work nu, sans boucle.
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      openAlbum(i, true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [collections, openAlbum]);

  // Esc ferme l'album, SAUF quand la lightbox est ouverte (elle a le sien, sur `window` aussi).
  // Phase de capture : lue avant que la lightbox ne se ferme.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || albumRef.current === null || lightboxRef.current) return;
      closeAlbum();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [closeAlbum]);

  // Quitter la page avec l'album ouvert : rendre l'historique et le défilement.
  useEffect(
    () => () => {
      popRef.current?.();
      popRef.current = null;
    },
    [],
  );

  const onRootClick = (e: React.MouseEvent) => {
    if (albumRef.current !== null) return;
    const target = e.target as Element;
    const scene = target.closest<HTMLElement>('[data-scene]');
    if (!scene) return;
    const link = target.closest<HTMLAnchorElement>('a[data-open]');
    // Clic modifié sur le lien (nouvel onglet) : on laisse faire.
    if (link && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    e.preventDefault();
    openAlbum(Number(scene.dataset.scene));
  };

  const current = album !== null ? collections[album] : null;

  return (
    <div ref={rootRef} data-work-root data-phase={phase} onClick={onRootClick}>
      <div data-scenes inert={album !== null}>
        {collections.map((c, i) => (
          <CarouselScene key={c._id} collection={c} index={i} />
        ))}
      </div>
      {current && (
        <AlbumView
          collection={current}
          top={albumTop}
          onClose={closeAlbum}
          onOpenPhoto={(index) => setLightboxBoth({ index, autoplay: false })}
          onPlay={() => setLightboxBoth({ index: 0, autoplay: true })}
          closeRef={closeRef}
          gridRef={gridRef}
        />
      )}
      {current && lightbox && (
        <PhotoLightbox
          key={current._id}
          photos={current.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightboxBoth(null)}
          slideshow
          autoplay={lightbox.autoplay}
        />
      )}
    </div>
  );
}
