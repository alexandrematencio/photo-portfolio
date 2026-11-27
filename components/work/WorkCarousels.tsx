'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PhotoLightbox } from '@/components/gallery/PhotoLightbox';
import type { PreparedSeries } from '@/lib/site/series';
import { pushModalHistory } from '@/lib/utils/modalHistory';
import { AlbumView } from './AlbumView';
import { CarouselScene } from './CarouselScene';
import { SceneMenu } from './SceneMenu';
import type gsap from 'gsap';
import { bindWorkCarousels, type WorkMotion } from './carousel-motion';
import { restTopOf } from './scene-step';

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
  /** Scène la plus proche du repos (ou visée par le pas en cours) : allume le menu de gauche. */
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const motionRef = useRef<WorkMotion | null>(null);
  /** Nettoyage rendu par `pushModalHistory` : l'UNE porte de sortie de l'album. */
  const popRef = useRef<(() => void) | null>(null);
  // Miroirs lisibles de façon synchrone par les écouteurs natifs (un `setState` n'est pas vu avant le microtask).
  const albumRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('idle');
  /** Timeline d'ouverture ou de fermeture en cours : un geste la termine d'un coup, jamais une seconde par-dessus. */
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const pendingOpen = useRef<{ instant: boolean } | null>(null);
  const lightboxRef = useRef(lightbox);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const motion = bindWorkCarousels(root);
    motionRef.current = motion;
    const off = motion?.step.onActive(setActive);
    if (motion) setActive(motion.step.active());
    return () => {
      off?.();
      motion?.destroy();
      motionRef.current = null;
    };
  }, []);

  const setLightboxBoth = useCallback((v: { index: number; autoplay: boolean } | null) => {
    lightboxRef.current = v;
    setLightbox(v);
  }, []);

  const changePhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  /** Fin de l'ouverture : l'album est là, le focus va sur Close. */
  const finishOpen = useCallback(() => {
    tlRef.current = null;
    changePhase('open');
    closeRef.current?.focus({ preventScroll: true });
  }, [changePhase]);

  /** Ferme l'album. Une seule porte : Close, Esc et retour navigateur y passent tous. */
  const closeAlbum = useCallback(
    (viaPop = false) => {
      const i = albumRef.current;
      if (i === null || phaseRef.current === 'closing') {
        tlRef.current?.progress(1); // un geste pendant la fermeture la termine
        return;
      }
      if (phaseRef.current === 'opening') {
        tlRef.current?.progress(1); // l'ouverture se termine d'un coup...
        if (!viaPop) return; // ...et un second geste fermera (le retour navigateur, lui, a déjà reculé)
      }
      const motion = motionRef.current;
      changePhase('closing');
      setLightboxBoth(null);
      popRef.current?.();
      popRef.current = null;
      const finish = () => {
        tlRef.current = null;
        albumRef.current = null;
        motion?.setLocked(false);
        setAlbum(null);
        changePhase('idle');
        // Focus rendu au lien-titre de la scène.
        requestAnimationFrame(() => {
          rootRef.current?.querySelector<HTMLElement>(`[data-scene="${i}"] a[data-open]`)?.focus({ preventScroll: true });
        });
      };
      const grid = gridRef.current;
      const albumEl = grid?.closest<HTMLElement>('[data-album]');
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (!motion || !grid || !albumEl) {
        finish();
        return;
      }
      tlRef.current = motion.close(i, { album: albumEl, grid, onComplete: finish });
    },
    [changePhase, setLightboxBoth],
  );

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
        // Arrivée par adresse : la scène est amenée à sa position de repos, sans animation.
        scroller.scrollTop = restTopOf(scenes, i, scroller);
      }
      motion.setLocked(true);
      popRef.current = pushModalHistory(() => closeAlbum(true));
      window.history.replaceState(window.history.state, '', `#${slug}`);
      pendingOpen.current = { instant };
      setAlbum(i);
      changePhase('opening');
    },
    [collections, closeAlbum, changePhase],
  );

  // Dès que l'album est dans le DOM (avant la peinture), on le cache et on lance le vol.
  useLayoutEffect(() => {
    const pending = pendingOpen.current;
    if (album === null || !pending) return;
    pendingOpen.current = null;
    const motion = motionRef.current;
    const grid = gridRef.current;
    const albumEl = grid?.closest<HTMLElement>('[data-album]');
    if (!motion || !grid || !albumEl) {
      finishOpen();
      return;
    }
    tlRef.current = motion.open(album, { album: albumEl, grid, instant: pending.instant, onComplete: finishOpen });
  }, [album, finishOpen]);

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
  // Phase de capture : lue avant que la lightbox ne se ferme. Pendant le vol, TOUTE touche ou
  // tout clic le termine d'un coup (§0 du plan : jamais une seconde timeline par-dessus).
  useEffect(() => {
    const busy = () => phaseRef.current === 'opening' || phaseRef.current === 'closing';
    const onKey = (e: KeyboardEvent) => {
      if (albumRef.current === null) return;
      if (busy()) {
        tlRef.current?.progress(1); // le premier geste termine le vol ; Esc ne ferme qu'au suivant
        return;
      }
      if (e.key !== 'Escape' || lightboxRef.current) return;
      closeAlbum();
    };
    const onPointer = () => {
      if (albumRef.current !== null && busy()) tlRef.current?.progress(1);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [closeAlbum]);

  // Quitter la page avec l'album ouvert : rendre l'historique et le défilement.
  useEffect(
    () => () => {
      tlRef.current?.kill();
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
      <SceneMenu collections={collections} active={active} hidden={album !== null} onGo={(i) => motionRef.current?.step.goTo(i)} />
      {current && (
        <AlbumView
          collection={current}
          top={albumTop}
          onClose={() => closeAlbum()}
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
