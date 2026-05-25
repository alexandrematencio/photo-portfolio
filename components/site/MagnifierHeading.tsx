'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

type Props = {
  /** Texte par défaut (court, p. ex. "A. Matencio") */
  short: string;
  /** Texte révélé par la lentille (long, p. ex. "Alexandre Matencio") */
  long: string;
  className?: string;
  /** Classes appliquées en plus au calque long (ex : taille plus grande) */
  longClassName?: string;
  /** Largeur de la lentille au sommet, en px */
  lensWidth?: number;
  /** Slant horizontal du parallélogramme (le bas est décalé vers la gauche) */
  lensSlant?: number;
  /** Vitesse en px/frame. ~5 ≈ 300 px/s à 60fps */
  speed?: number;
  /** Pause en ms à la fin du sweep avant de recommencer */
  pauseMs?: number;
};

/**
 * "Text magnifier" inspiré du pen rNZXJXJ par m-e-conroy.
 *
 * Mécanique :
 * - Trois calques empilés en absolute :
 *     1. texte court (toujours visible) — calque de fond
 *     2. rectangle couleur fond (= var(--color-bg)) clippé à la lentille → masque le court à l'intérieur
 *     3. texte long, clippé à la lentille → ne montre que la portion sous la lentille
 * - La lentille = polygone parallélogramme animé via une CSS variable (--lens-x)
 *   mise à jour en rAF (sans React re-render).
 * - À l'extérieur de la lentille, seul le court est visible.
 *   À l'intérieur, seul le long est visible (le calque bg coupe la transparence).
 */
export const MagnifierHeading = forwardRef<HTMLHeadingElement, Props>(
  function MagnifierHeading(
    {
      short,
      long,
      className,
      longClassName,
      lensWidth = 200,
      lensSlant = 200,
      speed = 4,
      pauseMs = 1800,
    },
    forwardedRef
  ) {
    const innerRef = useRef<HTMLHeadingElement>(null);
    const reducedMotion = useReducedMotion();

    const setRefs = (node: HTMLHeadingElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    useEffect(() => {
      if (reducedMotion) return;
      const el = innerRef.current;
      if (!el) return;

      let raf = 0;
      const resetX = -lensSlant - lensWidth;
      let lensX = resetX;
      let pausedUntil = 0;
      let endX = el.offsetWidth + lensWidth;

      const measure = () => {
        endX = el.offsetWidth + lensWidth;
      };

      const tick = (now: number) => {
        if (now < pausedUntil) {
          raf = requestAnimationFrame(tick);
          return;
        }
        lensX += speed;
        if (lensX >= endX) {
          pausedUntil = now + pauseMs;
          lensX = resetX;
        }
        el.style.setProperty('--lens-x', `${lensX}px`);
        raf = requestAnimationFrame(tick);
      };

      measure();
      raf = requestAnimationFrame(tick);
      window.addEventListener('resize', measure);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', measure);
      };
    }, [reducedMotion, lensWidth, lensSlant, speed, pauseMs]);

    // Polygone parallélogramme : top-left, top-right, bottom-right, bottom-left
    // bottom est décalé de --lens-slant vers la gauche par rapport au top.
    const lensClip =
      'polygon(var(--lens-x) 0%, calc(var(--lens-x) + var(--lens-width)) 0%, var(--lens-x) 100%, calc(var(--lens-x) - var(--lens-slant)) 100%)';

    return (
      <h1
        ref={setRefs}
        className={`${className ?? ''} relative inline-block leading-none`}
        style={
          {
            ['--lens-x' as string]: `${-lensSlant - lensWidth}px`,
            ['--lens-width' as string]: `${lensWidth}px`,
            ['--lens-slant' as string]: `${lensSlant}px`,
          } as React.CSSProperties
        }
        aria-label={long}
      >
        {/* Spacer : invisible, dimensionne le conteneur sur la version longue + grande */}
        <span
          aria-hidden
          className={`invisible whitespace-pre ${longClassName ?? ''}`}
        >
          {long}
        </span>

        {/* Calque 1 : texte court (toujours visible en dehors de la lentille) */}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center whitespace-pre pointer-events-none"
        >
          {short}
        </span>

        {/* Calque 2 : aplat couleur fond, clippé à la lentille → "efface" le court à l'intérieur */}
        {!reducedMotion && (
          <span
            aria-hidden
            className="absolute inset-0 bg-[var(--color-bg)] pointer-events-none"
            style={{ clipPath: lensClip }}
          />
        )}

        {/* Calque 3 : texte long (grand), clippé à la lentille → visible uniquement dedans */}
        {!reducedMotion && (
          <span
            aria-hidden
            className={`absolute inset-0 flex items-center justify-center whitespace-pre pointer-events-none ${longClassName ?? ''}`}
            style={{ clipPath: lensClip }}
          >
            {long}
          </span>
        )}
      </h1>
    );
  }
);
