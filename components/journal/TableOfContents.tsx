'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ArrowUp } from 'lucide-react';
import { STATE_DOT_SIZE } from '@/components/site/StateDot';
import { DICT, type Lang } from '@/lib/journal/i18n';
import type { ArticleSection } from '@/lib/journal/sections';
import { MICRO_LABEL } from '@/lib/site/typography';
import { cn } from '@/lib/utils/cn';

/**
 * LE SOMMAIRE d'un article, dans le rail sous l'avancement de lecture (demande
 * Alexandre, 2026-10-22). Principe repris de la démo de Jhey Tompkins
 * (codepen.io/jh3y/pen/VYeewwr, « contents marker w/ scroll-target-group +
 * anchor ») : la section en cours s'allume, un témoin GLISSE d'une entrée à
 * l'autre, et un lien « haut de page » n'apparaît qu'une fois l'introduction
 * passée.
 *
 * **Transposé à la grammaire du site, pas recopié** : le carré d'accent de la
 * démo devient le voyant d'état (`STATE_DOT_SIZE`, `--color-link` — brand book
 * §4.3, « l'orange dit ce qui est actif »), suspendu dans la marge gauche
 * comme la colonne des séries de `/series` ; l'entrée active passe du
 * `fg-muted` au noir, le libellé ne vire jamais à l'orange (sous le seuil du
 * petit texte). Entrées en 12 px gras capitales : la voix des noms de série,
 * et l'écho des H2 en dalle qu'elles désignent.
 *
 * **Pourquoi du JS et pas `scroll-target-group`** : la démo repose sur
 * `:target-current` et l'ancrage CSS, Chrome seul. La section courante est
 * donc calculée ici, pour tous les navigateurs : la dernière dont l'intertitre
 * a passé le premier tiers du conteneur de défilement. Avant le premier
 * intertitre (chapô), rien n'est allumé — c'est l'état « #pre » de la démo.
 *
 * Le témoin bouge en `transform` (jamais `top`), 260 ms comme la démo, sur la
 * courbe du site. Éteint, il se gare sur la première entrée : la première
 * section l'allume sur place, sans glissade. Reduced motion : il saute.
 *
 * Sans JS, les entrées restent des ancres ordinaires ; seuls le témoin et
 * « haut de page » manquent.
 */
const MARKER_GUTTER = 14;
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const DURATION = 260;
/** Hauteur de ligne des entrées, en px : le témoin se centre sur la PREMIÈRE ligne d'une entrée qui en a deux. */
const LINE = 15;

export function TableOfContents({ sections, lang }: { sections: ArticleSection[]; lang: Lang }) {
  const t = DICT[lang];
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLOListElement>(null);
  const [markerY, setMarkerY] = useState(0);

  useEffect(() => {
    const container = document.querySelector<HTMLElement>('[data-scroll-container]');
    const headings = sections.map((s) => document.getElementById(s.id));
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = container ? container.getBoundingClientRect().top : 0;
      const height = container ? container.clientHeight : window.innerHeight;
      const line = top + height / 3;
      let current = -1;
      headings.forEach((h, i) => {
        if (h && h.getBoundingClientRect().top <= line) current = i;
      });
      // Au fond de la page, les dernières sections, trop courtes pour monter
      // jusqu'au tiers, ne s'allumeraient jamais : la dernière visible gagne.
      const el = container ?? document.documentElement;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) {
        headings.forEach((h, i) => {
          if (h && h.getBoundingClientRect().top < top + height) current = i;
        });
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    const scroller: HTMLElement | Window = container ?? window;
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [sections]);

  // Le témoin suit l'entrée active ; une liste plus haute que la place qu'on
  // lui laisse défile d'elle-même pour la garder en vue. À la main, pas par
  // `scrollIntoView`, qui ferait aussi défiler l'article.
  useEffect(() => {
    const list = listRef.current;
    const link = list?.querySelectorAll<HTMLElement>('a')[Math.max(active, 0)];
    if (!list || !link) return;
    setMarkerY(link.offsetTop + (LINE - STATE_DOT_SIZE) / 2);
    const box = list.parentElement;
    if (box && box.scrollHeight > box.clientHeight && active >= 0) {
      const top = link.offsetTop + list.offsetTop;
      if (top < box.scrollTop || top + link.offsetHeight > box.scrollTop + box.clientHeight) {
        box.scrollTo({ top: top - box.clientHeight / 3 });
      }
    }
  }, [active]);

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const go = (e: MouseEvent<HTMLAnchorElement>, id: string | null) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    const behavior = reduced() ? 'auto' : 'smooth';
    if (id) {
      document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
      history.replaceState(null, '', `#${id}`);
    } else {
      const container = document.querySelector<HTMLElement>('[data-scroll-container]');
      (container ?? window).scrollTo({ top: 0, behavior });
      history.replaceState(null, '', location.pathname + location.search);
    }
  };

  const past = active >= 0;
  const fade = `opacity ${DURATION}ms ${EASE}`;

  return (
    <nav aria-label={t.contents} className="flex min-h-0 flex-col">
      <span
        className={cn(MICRO_LABEL, 'text-[var(--color-fg-muted)]')}
        style={{ paddingBottom: 12, borderBottom: '1px solid var(--color-line)' }}
      >
        {t.contents}
      </span>
      {/* La boîte qui défile quand la liste dépasse. Le retrait à gauche loge
          le témoin, la marge négative le rend à la mise en page : les entrées
          restent alignées sur le bouton Back. */}
      <div
        className="min-h-0 overflow-y-auto"
        style={{ paddingTop: 12, paddingLeft: MARKER_GUTTER, marginLeft: -MARKER_GUTTER, scrollbarWidth: 'none' }}
      >
        <ol ref={listRef} className="relative flex flex-col gap-[6px]">
          <span
            aria-hidden
            className="absolute motion-reduce:!transition-none"
            style={{
              left: -MARKER_GUTTER,
              top: 0,
              width: STATE_DOT_SIZE,
              height: STATE_DOT_SIZE,
              borderRadius: '50%',
              backgroundColor: 'var(--color-link)',
              opacity: past ? 1 : 0,
              transform: `translateY(${markerY}px)`,
              transition: `transform ${DURATION}ms ${EASE}, ${fade}`,
            }}
          />
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => go(e, s.id)}
                aria-current={i === active ? 'location' : undefined}
                title={s.label}
                className={cn(
                  'line-clamp-2 text-[12px] font-bold uppercase tracking-[-0.02em] transition-colors motion-reduce:transition-none',
                  i === active
                    ? 'text-[var(--color-fg)]'
                    : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)]',
                )}
                style={{ lineHeight: `${LINE}px`, transitionDuration: `${DURATION}ms`, transitionTimingFunction: EASE }}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
      {/* « Haut de page » : absent tant qu'on est dans l'introduction, comme
          dans la démo. Toujours rendu (opacité), la colonne ne bouge pas. */}
      <a
        href="#"
        onClick={(e) => go(e, null)}
        tabIndex={past ? undefined : -1}
        aria-hidden={past ? undefined : true}
        className={cn(
          MICRO_LABEL,
          'flex items-center gap-[6px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] focus-visible:text-[var(--color-fg)] motion-reduce:!transition-none',
        )}
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--color-line)',
          alignSelf: 'stretch',
          opacity: past ? 1 : 0,
          pointerEvents: past ? undefined : 'none',
          transition: `${fade}, color ${DURATION}ms ${EASE}`,
        }}
      >
        {t.backToTop}
        <ArrowUp size={12} strokeWidth={2.75} aria-hidden />
      </a>
    </nav>
  );
}
