'use client';

import { useEffect, useRef } from 'react';

/**
 * Cursor-following disc that inverts the colors of whatever is underneath
 * (mix-blend-mode: difference + white background = mathematical inversion).
 *
 * Visible only when the cursor is over an element with `data-cursor-invert`
 * attribute. Disabled on touch devices and mobile viewports — purely a
 * desktop mouse-driven micro-interaction.
 *
 * Reference: classic "cursor inversion" effect popularised by various
 * CodePens (e.g., nischal-lc/OJKWBGd). The disc itself is a white circle,
 * its mix-blend-mode produces |background - white| per pixel = the inverse
 * of every pixel underneath it. Over black text it shows white, over the
 * paper-white bg it shows near-black — the "negative" effect.
 *
 * Implementation notes:
 * - Position via transform translate3d (GPU-composited, no layout cost).
 * - Hover detection via document-level mouseover/mouseout delegation, so
 *   React re-renders (HomeHero's morphing nav items, route changes) don't
 *   need to re-bind listeners.
 * - Initial position is offscreen — when the disc first appears via hover,
 *   it's already at the cursor (mousemove fires before mouseover triggers
 *   the opacity transition).
 */
export function CursorInvert() {
  const discRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const disc = discRef.current;
    if (!disc) return;
    // Touch devices: skip entirely. The whole effect depends on mouse hover.
    if (typeof window === 'undefined') return;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    let raf = 0;
    let pendingX = -9999;
    let pendingY = -9999;
    let hoverCount = 0; // counts overlapping nav-item hovers (handles fast moves)

    const apply = () => {
      disc.style.transform = `translate3d(${pendingX}px, ${pendingY}px, 0) translate(-50%, -50%)`;
      raf = 0;
    };

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const TRANSITION = 'opacity 180ms ease-out';

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Shielded zone (e.g. hero portrait with its own hover effect): snap the
      // disc to invisible WITHOUT transition, so the two effects don't combine
      // during the 180ms fade-out window.
      if (target?.closest('[data-cursor-shield]')) {
        disc.style.transition = 'none';
        disc.style.opacity = '0';
        hoverCount = 0;
        return;
      }
      if (!target?.closest('[data-cursor-invert]')) return;
      // Restore the smooth transition for nav-item hovers.
      disc.style.transition = TRANSITION;
      hoverCount++;
      disc.style.opacity = '1';
    };

    const onOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const related = e.relatedTarget as HTMLElement | null;
      if (!target?.closest('[data-cursor-invert]')) return;
      // Only decrement if we're truly leaving the cursor-invert zone, not
      // moving between two parts of the same hover area.
      if (related?.closest?.('[data-cursor-invert]')) return;
      hoverCount = Math.max(0, hoverCount - 1);
      if (hoverCount === 0) {
        disc.style.transition = TRANSITION;
        disc.style.opacity = '0';
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={discRef}
      aria-hidden
      className="fixed top-0 left-0 z-[100] pointer-events-none hidden md:block"
      style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        backgroundColor: '#FFFFFF',
        mixBlendMode: 'difference',
        opacity: 0,
        transition: 'opacity 180ms ease-out',
        transform: 'translate3d(-9999px, -9999px, 0) translate(-50%, -50%)',
        willChange: 'transform, opacity',
      }}
    />
  );
}
