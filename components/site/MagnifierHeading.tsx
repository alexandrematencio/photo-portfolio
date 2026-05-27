'use client';

import { forwardRef, useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';

type Props = {
  /**
   * Textes courts à cycler. À chaque passage complet de la lentille, on passe
   * au texte suivant. La lentille "transforme" visuellement le texte : à droite
   * d'elle on voit le texte courant (avant transformation), à gauche on voit
   * déjà le suivant (après transformation).
   * Si un seul texte est fourni, comportement statique (pas de cycle).
   */
  shorts: string[];
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
 * "Text magnifier" inspiré du pen rNZXJXJ par m-e-conroy, étendu en
 * "transformer" : la lentille remplace le texte en passant.
 *
 * Mécanique (5 calques empilés en absolute) :
 *   1. Spacer invisible (dimensionne le conteneur sur la version longue + grande)
 *   2. Texte COURANT, clippé à la zone à DROITE de la lentille — visible AVANT
 *      que la lentille ne passe.
 *   3. Texte SUIVANT, clippé à la zone à GAUCHE de la lentille — visible APRÈS
 *      que la lentille passe. Pendant la traversée, les deux textes coexistent
 *      visuellement de part et d'autre de la lentille.
 *   4. Aplat couleur fond, clippé à la lentille — "efface" tout texte qui serait
 *      sous la lentille (sinon les deux calques ci-dessus se rejoindraient au
 *      milieu et l'aplat serait visible).
 *   5. Texte LONG, clippé à la lentille — révélation grande à l'intérieur.
 *
 * Cycle :
 * - À chaque fin de sweep (lensX >= endX, lentille sortie à droite), on incrémente
 *   l'index courant. Le calque CURRENT prend le texte qui était sur le calque NEXT,
 *   et le calque NEXT prend le suivant dans le cycle.
 * - Au moment du reset (la lentille saute de endX à resetX), le calque CURRENT
 *   couvre tout le conteneur (lentille hors écran à gauche). Comme le contenu
 *   vient juste d'être mis à jour avec le texte qui était précédemment vu via
 *   NEXT, il n'y a aucun flicker — le texte visible reste le même.
 */
export const MagnifierHeading = forwardRef<HTMLHeadingElement, Props>(
  function MagnifierHeading(
    {
      shorts,
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
    const layerCurrentRef = useRef<HTMLSpanElement>(null);
    const layerNextRef = useRef<HTMLSpanElement>(null);
    const indexRef = useRef(0);
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
      // Reset le compteur de cycle quand le composant remonte (changement de shorts).
      indexRef.current = 0;

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
          // Fin du sweep : cycle d'un cran. Le calque NEXT (texte actuellement
          // visible partout à gauche) devient le contenu du calque CURRENT —
          // continuité parfaite au reset de la lentille hors écran à gauche.
          indexRef.current = (indexRef.current + 1) % shorts.length;
          if (layerCurrentRef.current) {
            layerCurrentRef.current.textContent = shorts[indexRef.current];
          }
          if (layerNextRef.current) {
            layerNextRef.current.textContent =
              shorts[(indexRef.current + 1) % shorts.length];
          }
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
    }, [reducedMotion, lensWidth, lensSlant, speed, pauseMs, shorts]);

    // Lens itself — parallélogramme : top de [lensX, lensX+lensWidth], bottom
    // décalé de --lens-slant vers la gauche.
    const lensClip =
      'polygon(var(--lens-x) 0%, calc(var(--lens-x) + var(--lens-width)) 0%, var(--lens-x) 100%, calc(var(--lens-x) - var(--lens-slant)) 100%)';

    // Zone à DROITE de la lentille — où le texte COURANT est visible (pas encore
    // transformé). Bords épousent le côté droit du parallélogramme de la lentille.
    const rightOfLensClip =
      'polygon(calc(var(--lens-x) + var(--lens-width)) 0%, 100% 0%, 100% 100%, var(--lens-x) 100%)';

    // Zone à GAUCHE de la lentille — où le texte SUIVANT est visible (déjà
    // transformé). Bords épousent le côté gauche du parallélogramme de la lentille.
    const leftOfLensClip =
      'polygon(0% 0%, var(--lens-x) 0%, calc(var(--lens-x) - var(--lens-slant)) 100%, 0% 100%)';

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

        {/* Calque CURRENT — texte avant transformation, visible à droite de la lentille.
            Au repos (lentille hors écran à gauche), couvre tout le conteneur. */}
        <span
          ref={layerCurrentRef}
          aria-hidden
          className="absolute inset-0 flex items-center justify-center whitespace-pre pointer-events-none"
          style={{ clipPath: rightOfLensClip }}
        >
          {shorts[0]}
        </span>

        {/* Calque NEXT — texte après transformation, visible à gauche de la lentille.
            Invisible tant que la lentille n'est pas entrée dans le conteneur. */}
        {shorts.length > 1 && (
          <span
            ref={layerNextRef}
            aria-hidden
            className="absolute inset-0 flex items-center justify-center whitespace-pre pointer-events-none"
            style={{ clipPath: leftOfLensClip }}
          >
            {shorts[1]}
          </span>
        )}

        {/* Calque BG — aplat couleur fond clippé à la lentille → empêche les deux
            calques courts ci-dessus de se rejoindre visuellement sous la lentille. */}
        {!reducedMotion && (
          <span
            aria-hidden
            className="absolute inset-0 bg-[var(--color-bg)] pointer-events-none"
            style={{ clipPath: lensClip }}
          />
        )}

        {/* Calque LONG — texte révélé en grand à l'intérieur de la lentille. */}
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
