'use client';

import { useEffect, useRef } from 'react';

/**
 * Survol d'un item de nav : ses LETTRES deviennent une fenêtre sur ce qui
 * passe dessous, en négatif. Le disque qui suit la souris ré-inverse, donc
 * dans son périmètre les deux inversions s'annulent : les lettres y montrent
 * le vrai fond, et c'est l'espace autour d'elles qui passe en négatif.
 *
 * Deux calques blancs en `mix-blend-mode: difference`, tous deux à la RACINE
 * du layout (blanc en difference = |1 − x|, l'inversion exacte) :
 * - le DOUBLE (z-99) : copie du libellé survolé, recalée chaque frame sur son
 *   rect. Ses glyphes affichent le négatif du fond. Le libellé d'origine passe
 *   en `color: transparent`, sinon on inverserait son encre noire au lieu du
 *   fond ;
 * - le DISQUE (z-100), 48 px, qui suit la souris.
 *
 * ⚠️ Pourquoi un double, et jamais `mix-blend-mode` sur le lien lui-même : un
 * élément ne se fond que dans SON contexte d'empilement, et le header
 * (`fixed z-50`) comme l'overlay du HomeHero en créent un, transparent. Le
 * lien s'y fondrait contre du vide et sortirait blanc uni. Seul un calque à la
 * racine voit la page.
 *
 * Le double ne se pose QUE sur les items marqués `data-cursor-negative` : ceux
 * de la nav du HomeHero, la seule sous laquelle des photos défilent. Ailleurs
 * (SiteHeader), FramedScroll démarre SOUS la nav : elle ne voit que le fond
 * papier, dont le négatif (#050507) se confond avec l'encre, et l'effet n'y
 * changeait que l'item actif — son fond orange virait au cyan dans les lettres
 * (écarté, Alexandre, 2026-09-12). Là, le disque seul.
 *
 * Desktop souris uniquement : tout est coupé sur les écrans tactiles.
 *
 * Implementation notes:
 * - Position via transform translate3d (GPU-composited, no layout cost).
 * - Hover detection via document-level mouseover/mouseout delegation, so
 *   React re-renders (HomeHero's morphing nav items, route changes) don't
 *   need to re-bind listeners.
 * - The double follows its item with a rAF loop that runs ONLY while an item
 *   is hovered: the home morph moves the items under a still cursor. Its
 *   scale is derived from rect / offsetWidth, so a transformed ancestor is
 *   matched too.
 */
const TRANSITION = 'opacity 180ms ease-out';

export function CursorInvert() {
  const discRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const disc = discRef.current;
    const ghost = ghostRef.current;
    if (!disc || !ghost) return;
    // Touch devices: skip entirely. The whole effect depends on mouse hover.
    if (typeof window === 'undefined') return;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch) return;

    let raf = 0;
    let pendingX = -9999;
    let pendingY = -9999;
    let hovered: HTMLElement | null = null;
    let track = 0;
    let boxW = -1;
    let boxH = -1;

    const apply = () => {
      disc.style.transform = `translate3d(${pendingX}px, ${pendingY}px, 0) translate(-50%, -50%)`;
      raf = 0;
    };

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    // Recopié à chaque changement de boîte : cliquer un item le rend actif,
    // et l'état actif lui ajoute un padding.
    const copyBox = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      const s = ghost.style;
      s.fontFamily = cs.fontFamily;
      s.fontSize = cs.fontSize;
      s.fontWeight = cs.fontWeight;
      s.fontStyle = cs.fontStyle;
      s.letterSpacing = cs.letterSpacing;
      s.lineHeight = cs.lineHeight;
      s.textTransform = cs.textTransform;
      s.padding = cs.padding;
      boxW = el.offsetWidth;
      boxH = el.offsetHeight;
      s.width = `${boxW}px`;
      s.height = `${boxH}px`;
    };

    const release = () => {
      if (track) cancelAnimationFrame(track);
      track = 0;
      if (hovered) hovered.style.color = '';
      hovered = null;
      ghost.style.opacity = '0';
    };

    const place = () => {
      track = 0;
      const el = hovered;
      if (!el) return;
      if (!el.isConnected) {
        release();
        return;
      }
      if (el.offsetWidth !== boxW || el.offsetHeight !== boxH) copyBox(el);
      const r = el.getBoundingClientRect();
      const scale = boxW ? r.width / boxW : 1;
      ghost.style.transform = `translate3d(${r.left}px, ${r.top}px, 0) scale(${scale})`;
      track = requestAnimationFrame(place);
    };

    const capture = (el: HTMLElement) => {
      hovered = el;
      ghost.textContent = el.textContent;
      copyBox(el);
      // Placé AVANT de rendre l'original transparent, dans la même frame :
      // jamais un instant sans libellé.
      place();
      el.style.color = 'transparent';
      ghost.style.opacity = '1';
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Shielded zone (e.g. hero portrait with its own hover effect): snap the
      // disc to invisible WITHOUT transition, so the two effects don't combine
      // during the 180ms fade-out window.
      if (target?.closest('[data-cursor-shield]')) {
        release();
        disc.style.transition = 'none';
        disc.style.opacity = '0';
        return;
      }
      const item = target?.closest<HTMLElement>('[data-cursor-invert]');
      if (!item) return;
      // Restore the smooth transition for nav-item hovers.
      disc.style.transition = TRANSITION;
      disc.style.opacity = '1';
      if (item !== hovered) {
        release();
        if (item.hasAttribute('data-cursor-negative')) capture(item);
      }
    };

    const onOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const related = e.relatedTarget as HTMLElement | null;
      if (!target?.closest('[data-cursor-invert]')) return;
      // Only exit if we're truly leaving the cursor-invert zone, not moving
      // between two parts of the same hover area (or straight to another item,
      // which onOver swaps in).
      if (related?.closest?.('[data-cursor-invert]')) return;
      release();
      disc.style.transition = TRANSITION;
      disc.style.opacity = '0';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      if (raf) cancelAnimationFrame(raf);
      release();
    };
  }, []);

  return (
    <>
      <span
        ref={ghostRef}
        aria-hidden
        className="fixed top-0 left-0 z-[99] pointer-events-none hidden md:block whitespace-nowrap"
        style={{
          color: '#FFFFFF',
          mixBlendMode: 'difference',
          boxSizing: 'border-box',
          transformOrigin: '0 0',
          opacity: 0,
          willChange: 'transform',
        }}
      />
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
          transition: TRANSITION,
          transform: 'translate3d(-9999px, -9999px, 0) translate(-50%, -50%)',
          willChange: 'transform, opacity',
        }}
      />
    </>
  );
}
