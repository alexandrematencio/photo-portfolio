'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Où en est la lecture d'un article (demande Alexandre, 2026-10-22). Deux
 * formes, montées toutes les deux par `PageShell` : sous les drapeaux dans le
 * rail dès `xl`, une ligne collée en tête du conteneur de défilement en
 * dessous — là où le rail redevient une rangée qui part avec le titre.
 *
 * **Jamais vide** : la barre part de `FLOOR` (10 %) dès l'ouverture, et c'est
 * voulu — une tâche déjà entamée se termine plus volontiers qu'une tâche à
 * zéro (effet de progression dotée). Le reste de la piste suit le défilement
 * de l'article, de son haut jusqu'à ce que son bas touche le bas de l'écran.
 *
 * Aucune animation propre : le remplissage EST le défilement, il le suit sans
 * courbe ni retard (seule exception admise au « jamais linear »). Rien ne
 * bouge sans geste du lecteur, donc rien à couper sous reduced-motion. Le
 * rendu serveur pose déjà les 10 % : sans JS, la barre est là, figée.
 *
 * Dans le rail, la barre porte son pourcentage à droite (2026-10-22) — celui
 * de la barre, plancher compris, pour que le chiffre et le trait disent la
 * même chose. Largeur réservée à « 100% » : la barre ne bouge pas quand le
 * chiffre gagne un caractère.
 *
 * L'article à mesurer porte `data-reading` (posé par `PageShell`). Le
 * scroller est `[data-scroll-container]` (FramedScroll), `window` à défaut
 * — l'aperçu du Studio, où la barre reste alors à son plancher.
 */
const FLOOR = 0.1;

export function ReadingProgress({ variant }: { variant: 'rail' | 'top' }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fill = fillRef.current;
    const article = document.querySelector<HTMLElement>('[data-reading]');
    if (!fill || !article) return;
    const container = document.querySelector<HTMLElement>('[data-scroll-container]');
    const scroller: HTMLElement | Window = container ?? window;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = article.getBoundingClientRect();
      const top = container ? container.getBoundingClientRect().top : 0;
      const height = container ? container.clientHeight : window.innerHeight;
      // Ce qui est passé au-dessus du haut de l'écran, sur ce qu'il faut
      // faire défiler pour amener le bas de l'article au bas de l'écran.
      const span = rect.height - height;
      const read = span > 0 ? Math.min(1, Math.max(0, (top - rect.top) / span)) : 1;
      const shown = FLOOR + (1 - FLOOR) * read;
      fill.style.transform = `scaleX(${shown})`;
      if (pctRef.current) pctRef.current.textContent = `${Math.round(shown * 100)}%`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Les images qui arrivent allongent l'article : la mesure suit.
    const observer = new ResizeObserver(schedule);
    observer.observe(article);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
    };
  }, []);

  const bar = (
    <div
      aria-hidden
      className={cn('overflow-hidden', variant === 'rail' ? 'h-[3px] w-full bg-[var(--color-line)]' : 'h-[3px] w-full')}
    >
      <div
        ref={fillRef}
        className="h-full w-full origin-left bg-[var(--color-accent)]"
        style={{ transform: `scaleX(${FLOOR})` }}
      />
    </div>
  );
  if (variant === 'top') return bar;
  return (
    <div aria-hidden className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{bar}</div>
      <span
        ref={pctRef}
        className="w-[4ch] text-right text-[10px] font-medium leading-none tabular-nums text-[var(--color-fg-muted)]"
      >
        {Math.round(FLOOR * 100)}%
      </span>
    </div>
  );
}
