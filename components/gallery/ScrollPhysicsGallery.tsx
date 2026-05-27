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
 * Port du moteur scroll-physics de html-script-reference.md vers Next.js.
 * - Lenis pour smooth scroll
 * - GSAP + ScrollTrigger pour parallaxe per-item
 * - Velocity-driven distortion (scale/skewY/rotateX) avec bornes adoucies
 * - Respect strict de prefers-reduced-motion (CLAUDE.md §3.2)
 * - Cleanup complet à l'unmount
 */
export function ScrollPhysicsGallery({ photos, motion }: Props) {
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

      // 2. PARALLAXE PER-ITEM (desktop uniquement)
      const photoItems = stage.querySelectorAll<HTMLElement>('.photo-item');
      const triggers: ReturnType<typeof ScrollTrigger.create>[] = [];

      // En mobile (< 768px), on désactive la parallaxe : les photos restent en flux
      // vertical classique avec un gap fixe — pas de translation au scroll.
      const isMobile = window.matchMedia('(max-width: 768px)').matches;

      if (!isMobile) {
        // Parallaxe : translation BORNÉE au viewport (window.innerHeight * speed).
        // L'ancienne formule `maxScroll * speed` causait des déplacements gigantesques
        // (jusqu'à 1800 px) avec 30 photos → photos cachées au load et overlap du footer.
        // Désormais, max ~150 px de translate par photo sur l'ensemble du parcours.
        photoItems.forEach((item) => {
          const speed = parseFloat(item.dataset.speed ?? '0.1');

          triggers.push(
            gsap.to(item, {
              y: () => window.innerHeight * speed,
              ease: 'none',
              scrollTrigger: {
                trigger: item,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
                invalidateOnRefresh: true,
              },
            }).scrollTrigger as ReturnType<typeof ScrollTrigger.create>
          );
        });
      }

      // 3. VELOCITY-DRIVEN DISTORSION
      // Durées de recovery courtes : les photos se "remettent droites" 2.5-3x plus vite.
      // Désactivée sur mobile : la skewY + rotateX faisait visuellement déborder
      // les photos sur leurs voisines au scroll, même avec un gap correct au layout.
      const inners = stage.querySelectorAll<HTMLElement>('.photo-inner');
      if (!isMobile && inners.length > 0) {
        const setScale = gsap.quickTo(inners, 'scale', {
          duration: 0.3,
          ease: 'power3.out',
        });
        const setSkew = gsap.quickTo(inners, 'skewY', {
          duration: 0.1,
          ease: 'power3.out',
        });
        const setRotX = gsap.quickTo(inners, 'rotateX', {
          duration: 0.25,
          ease: 'power3.out',
        });

        const velocityTrigger = ScrollTrigger.create({
          trigger: document.body,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            const velocity = self.getVelocity();

            let scaleVal = 1 - Math.abs(velocity / motion.velocityDivisorScale);
            scaleVal = gsap.utils.clamp(motion.scaleMin, 1, scaleVal);

            let skewVal = velocity / motion.velocityDivisorSkew;
            skewVal = gsap.utils.clamp(-motion.skewMax, motion.skewMax, skewVal);

            let rotXVal = velocity / motion.velocityDivisorRotX;
            rotXVal = gsap.utils.clamp(-motion.rotXMax, motion.rotXMax, rotXVal);

            setScale(scaleVal);
            setSkew(skewVal);
            setRotX(rotXVal);
          },
        });
        triggers.push(velocityTrigger);
      }

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
  }, [reducedMotion, motion]);

  return (
    <>
      <div ref={stageRef} className="gallery-stage" aria-label="Galerie immersive">
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
