'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** Épaisseur au repos et sous le doigt / le curseur, en px. */
const WIDTH = 4;
const WIDTH_ACTIVE = 7;
/** Écart au bord droit et aux extrémités de la piste. */
const INSET = 3;
/** Le curseur ne descend jamais sous cette hauteur, même sur une page très longue. */
const MIN_HEIGHT = 36;
/** Après le dernier défilement, il reste ce temps avant de s'effacer. */
const IDLE_MS = 900;
/** Largeur de la bande du bord droit qui le fait apparaître au survol. */
const EDGE_ZONE = 18;

/**
 * Barre de défilement de la page, à la place de la native (masquée par
 * `globals.css` dès que `html[data-scroll-thumb]` est posé — c'est ce
 * composant qui le pose). Un curseur fin, invisible au repos : il apparaît
 * quand on défile, quand la souris approche du bord droit, et se laisse
 * glisser (demande Alexandre, 2026-10-15).
 *
 * Le scroller n'est pas le même selon la page : `window` sur la home (GSAP,
 * Lenis et le morph du hero en ont besoin), `[data-scroll-container]` partout
 * ailleurs (`FramedScroll`). Il est relu à chaque changement de route.
 *
 * ⚠️ Le glisser respecte le verrou de scroll (`lib/utils/scrollLock.ts`) :
 * pendant le splash, l'entrée du hero ou un départ par le menu, le corps est
 * en `overflow: hidden` et le curseur ne doit rien pouvoir faire défiler.
 *
 * Le clavier, la molette et le doigt ne passent pas par lui : le défilement
 * natif reste entier, seul son dessin change. D'où `aria-hidden`.
 */
export function ScrollThumb() {
  const pathname = usePathname();
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-scroll-thumb', '');
    return () => document.documentElement.removeAttribute('data-scroll-thumb');
  }, []);

  useEffect(() => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    const container =
      pathname === '/'
        ? null
        : document.querySelector<HTMLElement>('[data-scroll-container]');
    const root = document.documentElement;
    const metrics = () =>
      container
        ? {
            top: container.getBoundingClientRect().top,
            height: container.clientHeight,
            pos: container.scrollTop,
            max: container.scrollHeight - container.clientHeight,
          }
        : {
            top: 0,
            height: window.innerHeight,
            pos: window.scrollY,
            max: root.scrollHeight - window.innerHeight,
          };
    const scrollTo = (y: number) => {
      if (container) container.scrollTop = y;
      else window.scrollTo(0, y);
    };
    const locked = () => document.body.style.overflow === 'hidden';

    let size = MIN_HEIGHT;
    let span = 0;
    let max = 0;
    let shown = false;
    let hot = false;
    let dragging = false;
    let idle = 0;

    const place = () => {
      const m = metrics();
      max = m.max;
      if (max <= 1) {
        thumb.style.display = 'none';
        return false;
      }
      thumb.style.display = '';
      const track = m.height - 2 * INSET;
      size = Math.max(MIN_HEIGHT, (track * m.height) / (m.height + max));
      span = track - size;
      const y = m.top + INSET + span * Math.min(1, Math.max(0, m.pos / max));
      thumb.style.height = `${size}px`;
      thumb.style.transform = `translate3d(0, ${y}px, 0)`;
      return true;
    };
    const paint = () => {
      const visible = shown || hot || dragging;
      thumb.style.opacity = visible ? (hot || dragging ? '0.5' : '0.3') : '0';
      thumb.style.width = `${hot || dragging ? WIDTH_ACTIVE : WIDTH}px`;
      thumb.style.pointerEvents = visible ? 'auto' : 'none';
    };
    const wake = () => {
      shown = true;
      paint();
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        shown = false;
        paint();
      }, IDLE_MS);
    };

    const onScroll = () => {
      if (place()) wake();
    };
    // Survol du bord droit : seulement à la souris. Au doigt, il n'y a pas de
    // survol, le défilement suffit à le montrer.
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || dragging) return;
      const near = e.clientX >= window.innerWidth - EDGE_ZONE;
      if (near === hot) return;
      hot = near;
      if (near) place();
      paint();
      if (!near) wake();
    };

    let startY = 0;
    let startPos = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || locked()) return;
      e.preventDefault();
      thumb.setPointerCapture(e.pointerId);
      dragging = true;
      startY = e.clientY;
      startPos = metrics().pos;
      paint();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || locked() || span <= 0) return;
      scrollTo(startPos + ((e.clientY - startY) * max) / span);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (thumb.hasPointerCapture(e.pointerId)) thumb.releasePointerCapture(e.pointerId);
      hot = e.clientX >= window.innerWidth - EDGE_ZONE;
      wake();
    };

    // La hauteur de la page bouge sans défilement (images qui arrivent,
    // groupes d'/archives qui s'ouvrent) : la taille du curseur suit.
    const content = container ?? document.body;
    const observer = new ResizeObserver(() => place());
    observer.observe(content);
    if (container?.firstElementChild) observer.observe(container.firstElementChild);

    const target: HTMLElement | Window = container ?? window;
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    thumb.addEventListener('pointerdown', onDown);
    thumb.addEventListener('pointermove', onMove);
    thumb.addEventListener('pointerup', onUp);
    thumb.addEventListener('pointercancel', onUp);

    shown = false;
    hot = false;
    place();
    paint();

    return () => {
      window.clearTimeout(idle);
      observer.disconnect();
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onPointerMove);
      thumb.removeEventListener('pointerdown', onDown);
      thumb.removeEventListener('pointermove', onMove);
      thumb.removeEventListener('pointerup', onUp);
      thumb.removeEventListener('pointercancel', onUp);
    };
  }, [pathname]);

  return (
    <div
      ref={thumbRef}
      aria-hidden
      // Une zone de prise plus large que le trait : le fond ne peint que la
      // boîte de contenu (`background-clip`), la bordure transparente élargit
      // la cible du pointeur vers la gauche sans rien montrer.
      className="fixed top-0 z-[45] rounded-full bg-[var(--color-fg)] motion-safe:transition-[opacity,width] motion-safe:duration-200 touch-none select-none"
      style={{
        right: INSET,
        width: WIDTH,
        opacity: 0,
        pointerEvents: 'none',
        backgroundClip: 'content-box',
        borderLeft: '6px solid transparent',
        boxSizing: 'content-box',
        cursor: 'grab',
      }}
    />
  );
}
