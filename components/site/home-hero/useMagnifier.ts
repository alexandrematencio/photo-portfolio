import { useEffect, type RefObject } from 'react';

/**
 * La loupe de la photo de profil : sous le curseur, un disque laisse voir la
 * seconde image (`hero.revealSrc`). Sorti de HomeHero.tsx tel quel (audit 1.6).
 */
export function useMagnifier(
  photoBoxRef: RefObject<HTMLDivElement | null>,
  revealLayerRef: RefObject<HTMLDivElement | null>,
  reducedMotion: boolean
) {
  // Bind the magnifier reveal — purely DOM mutation (no React re-render) for 60 fps.
  // Respects prefers-reduced-motion: in that case, the reveal layer stays hidden.
  useEffect(() => {
    if (reducedMotion) return;
    const box = photoBoxRef.current;
    const reveal = revealLayerRef.current;
    if (!box || !reveal) return;

    // Desktop: 74 px radius (~148 px diameter, = mobile / 1.3).
    // Mobile: 96 px radius — finger-driven engagement needs more reveal area.
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const RADIUS = isMobile ? 96 : 74;
    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;

    const apply = () => {
      reveal.style.clipPath = `circle(${RADIUS}px at ${pendingX}px ${pendingY}px)`;
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onEnter = (e: PointerEvent) => {
      // Mouse: hide the cursor (the revealed disc takes over).
      // Touch/pen: nothing to hide — the finger is the cursor.
      if (e.pointerType === 'mouse') box.style.cursor = 'none';
      onMove(e);
    };

    const onLeave = () => {
      box.style.cursor = '';
      reveal.style.clipPath = 'circle(0px at 50% 50%)';
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    // iOS long-press → context menu (Save image, Copy, Share). Kill it on this box.
    const onContextMenu = (e: Event) => e.preventDefault();

    box.addEventListener('pointerenter', onEnter);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerleave', onLeave);
    box.addEventListener('pointercancel', onLeave);
    box.addEventListener('contextmenu', onContextMenu);

    return () => {
      box.removeEventListener('pointerenter', onEnter);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('pointercancel', onLeave);
      box.removeEventListener('contextmenu', onContextMenu);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion, photoBoxRef, revealLayerRef]);
}
