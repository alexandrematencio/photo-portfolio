'use client';

import { useEffect, useRef, useState } from 'react';
import { PhotoBlock } from './PhotoBlock';
import { PhotoLightbox } from './PhotoLightbox';
import type { Photo } from '@/lib/sanity/queries';
import type { MotionSettings } from '@/lib/sanity/queries';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

type Props = {
  photos: Photo[];
  motion: MotionSettings;
};

/**
 * Fondu d'entrée/sortie : portion de la HAUTEUR de l'image parcourue près du
 * bord du viewport pendant laquelle l'opacité monte (entrée) ou descend
 * (sortie). 0,25 = fondu discret, cantonné aux bords : une photo est à 100 %
 * d'opacité dès que 25 % d'elle est entrée — donc TOUTE photo entièrement
 * visible est pleine et entière, sans avoir à l'aligner au centre
 * (demande Alexandre 2026-08-22).
 */
const EDGE_FADE_PORTION = 0.25;

/**
 * Galerie de la curation (home). Depuis le 2026-08-22 (décision Alexandre) :
 * AUCUNE animation au scroll autre que le scroll lui-même —
 * - Lenis pour le smooth scroll (le hero §3.6 s'appuie dessus), et
 * - un fondu d'entrée/sortie scrubbé aux bords du viewport (voir
 *   EDGE_FADE_PORTION) : les blocs arrivent un par un en fade-in par le bas,
 *   sortent en fade-out par le haut (et inversement en remontant).
 * La parallaxe per-item et la distorsion pilotée par la vélocité
 * (scale/skewY/rotateX) sont SUPPRIMÉES — version archivée dans
 * FREELANCE/RESOURCES/existing-components/scroll-velocity-distortion/.
 * Respect strict de prefers-reduced-motion (CLAUDE.md §3.2), cleanup complet.
 */
export function ScrollPhysicsGallery({ photos }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const items = photos.length > 0 ? photos : Array.from({ length: 6 }, () => null);
  // Single carousel instance per page — owned by the parent that has the
  // full photos array. PhotoBlock notifies us with the clicked index.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const stage = stageRef.current;
    if (!stage) return;

    let cleanup: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const [{ default: Lenis }, gsapModule, scrollTriggerModule] = await Promise.all([
        import('lenis'),
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);

      if (cancelled) return;

      const gsap = gsapModule.default ?? gsapModule;
      const ScrollTrigger =
        (scrollTriggerModule as { ScrollTrigger?: typeof import('gsap/ScrollTrigger').ScrollTrigger })
          .ScrollTrigger ?? scrollTriggerModule.default;

      gsap.registerPlugin(ScrollTrigger);

      // 1. SMOOTH SCROLL — Lenis
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time: number) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);

      // 2. FONDU D'ENTRÉE / SORTIE aux bords du viewport — calculé à chaque
      // frame depuis les RECTS mesurés, jamais depuis des positions de
      // triggers figées : la home a un hero pinné qui déplace le layout après
      // coup (§3.6), et des tweens scrubbés sur positions pré-calculées
      // fondaient ~100 px trop tôt (mesuré — l'item fondait encore sous le
      // bord). Le rect, lui, EST ce que l'œil voit ; piloté par la position
      // (pas le temps), remonter refait le chemin inverse à l'identique.
      //
      // Entrée : l'opacité monte de 0 → 1 pendant que les premiers 25 % de la
      // photo franchissent le bord bas. Sortie : 1 → 0 pendant que les
      // derniers 25 % franchissent le bord haut. Entre les deux, opacité 1 :
      // toute photo entièrement visible est pleine et entière, où qu'elle
      // soit dans l'écran (pas besoin de l'aligner au centre). Coût : ~30
      // lectures de rect par frame de scroll, aucune écriture invalidant le
      // layout (opacity seule).
      const photoItems = Array.from(
        stage.querySelectorAll<HTMLElement>('.photo-item')
      );
      const triggers: ReturnType<typeof ScrollTrigger.create>[] = [];

      const applyEdgeFades = () => {
        const vh = window.innerHeight;
        for (const item of photoItems) {
          const r = item.getBoundingClientRect();
          const fadePx = Math.max(1, r.height * EDGE_FADE_PORTION);
          const enter = (vh - r.top) / fadePx; // profondeur d'entrée (bord bas)
          const exit = r.bottom / fadePx; // marge restante avant le bord haut
          const o = gsap.utils.clamp(0, 1, Math.min(enter, exit));
          item.style.opacity = String(o);
          // visibility coupée à 0 : une photo hors écran ne doit être ni
          // cliquable ni annoncée (les blocs sont des <button>).
          item.style.visibility = o === 0 ? 'hidden' : '';
        }
      };

      triggers.push(
        ScrollTrigger.create({
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: applyEdgeFades,
          onRefresh: applyEdgeFades,
        })
      );
      applyEdgeFades();

      cleanup = () => {
        // On ne tue QUE nos propres triggers (sinon on bute ceux du HomeHero).
        triggers.forEach((t) => t?.kill());
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion]);

  return (
    <>
      <div
        ref={stageRef}
        id="gallery-start"
        className="gallery-stage"
        aria-label="Galerie immersive"
      >
        {items.map((photo, index) => (
          <PhotoBlock
            key={photo?._id ?? `placeholder-${index}`}
            photo={photo}
            index={index}
            onOpen={(i) => setOpenIndex(i)}
          />
        ))}
      </div>
      {openIndex !== null && photos.length > 0 && (
        <PhotoLightbox
          photos={photos}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
