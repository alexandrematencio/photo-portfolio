'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { CONTROL_RADIUS } from '@/lib/site/controls';
import { SITES, type SiteEntry } from '@/lib/site/nav';
import { isExternal } from '@/lib/site/sites';
import { MICRO_LABEL, MICRO_LABEL_XS } from '@/lib/site/typography';
import { StateDot } from './StateDot';

/**
 * « All sites » — les sites d'amatencio.com, depuis la nav-bar (desktop) et
 * le tiroir (mobile). Une liste, deux montages : `SitesList` rend les rangées,
 * `SitesMenu` le déclencheur et le panneau de la nav-bar.
 *
 * Grammaire reprise du site, rien d'inventé :
 * - le voyant (`StateDot`) dit « vous êtes ici » — Photography sur le
 *   portfolio, Journal sur blog.amatencio.com ;
 * - la rangée s'inverse au survol et au focus, 200 ms ease-out, comme les
 *   lignes de la page d'accueil du journal (brand book §14.8) ;
 * - le panneau se pose sur `--color-bg-raised`, le barreau « calque posé sur
 *   le papier » du tiroir mobile et de la lightbox ;
 * - un site pas encore en ligne reste VISIBLE, grisé, avec « Soon » : jamais
 *   un lien mort, et la place est déjà prise dans la liste.
 */

/** Écart nav-bar → panneau. */
const PANEL_OFFSET = 14;
/** Écart coin à coin quand le panneau s'ouvre au-dessus (nav de la home). */
const CORNER_OFFSET = 4;
const PANEL_WIDTH = 300;

function Row({ site, here, onNavigate }: { site: SiteEntry; here: boolean; onNavigate?: () => void }) {
  const rowStyle: CSSProperties = { padding: '14px 16px', borderRadius: CONTROL_RADIUS };
  const body = (
    <>
      <span className="flex self-center">
        <StateDot on={here} />
      </span>
      <span className="flex min-w-0 flex-col" style={{ gap: 7 }}>
        <span className="text-[22px] font-bold tracking-[-0.02em] leading-none">
          {site.label}
          {here && <span className="sr-only"> (current site)</span>}
        </span>
        <span
          className={cn(
            MICRO_LABEL,
            'normal-case font-medium tracking-normal transition-colors duration-200 ease-out motion-reduce:transition-none',
            site.href ? 'text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg-faint)] group-focus-visible:text-[var(--color-fg-faint)]' : 'text-[var(--color-fg-faint)]',
          )}
        >
          {site.host}
        </span>
      </span>
      {site.href === null ? (
        // « Soon » : l'étiquette du site (`MICRO_LABEL_XS`) dans un filet, en
        // tête de rangée à droite — calée sur la ligne du NOM, pas centrée sur
        // la rangée, pour qu'elle se lise avec lui.
        <span
          className={cn(MICRO_LABEL_XS, 'self-start leading-none text-[var(--color-fg-muted)]')}
          style={{ padding: '4px 6px 3px', border: '1px solid var(--color-line)', borderRadius: 999, letterSpacing: '0.06em' }}
        >
          Soon
        </span>
      ) : site.external ? (
        <span aria-hidden className="self-start text-[16px] font-bold leading-none">
          ↗
        </span>
      ) : (
        <span aria-hidden />
      )}
    </>
  );

  const grid = 'grid grid-cols-[7px_minmax(0,1fr)_auto] items-start gap-x-3';

  if (site.href === null) {
    return (
      <li>
        <div aria-disabled="true" className={cn(grid, 'cursor-default text-[var(--color-fg-faint)]')} style={rowStyle}>
          {body}
          <span className="sr-only"> — coming soon</span>
        </div>
      </li>
    );
  }

  const interactive = cn(
    grid,
    'group text-[var(--color-fg)] transition-colors duration-200 ease-out motion-reduce:transition-none',
    'hover:bg-[var(--color-fg)] hover:text-[var(--color-bg)] focus-visible:bg-[var(--color-fg)] focus-visible:text-[var(--color-bg)] focus-visible:outline-none',
  );

  return (
    <li>
      {site.external ? (
        <a href={site.href} className={interactive} style={rowStyle} onClick={onNavigate} target="_blank" rel="noopener">
          {body}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : isExternal(site.href) ? (
        // L'autre site d'amatencio.com : même onglet, chargement complet.
        <a href={site.href} className={interactive} style={rowStyle} onClick={onNavigate}>
          {body}
        </a>
      ) : (
        <Link href={site.href} className={interactive} style={rowStyle} onClick={onNavigate}>
          {body}
        </Link>
      )}
    </li>
  );
}

export function SitesList({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  return (
    <ul className={cn('flex flex-col', className)}>
      {SITES.map((site) => (
        <Row key={site.host} site={site} here={site.here ?? false} onNavigate={onNavigate} />
      ))}
    </ul>
  );
}

type TriggerProps = Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'onClick'> & { label: string };

/**
 * Déclencheur de la nav-bar + panneau. Le déclencheur est une ENTRÉE de la
 * nav-bar comme les autres : il reçoit les mêmes classes et attributs
 * (`data-nav-link`, `data-cursor-invert`…) et le hero de la home le mesure et
 * le déplace comme un lien (CLAUDE.md §3.6). D'où le `ref` transmis.
 *
 * Le panneau est rendu dans `document.body`, en `position: fixed` calée sur
 * le déclencheur : sur la home, les entrées de la nav portent les transforms
 * du morph, et un `fixed` posé DANS un élément transformé se positionne par
 * rapport à lui. Conséquence côté clavier, traitée à la main : le panneau
 * reçoit le focus à l'ouverture, Échap et la sortie par Tab le referment et
 * rendent le focus au déclencheur.
 *
 * Placement : sous le déclencheur, calé à droite, quand il est dans la moitié
 * haute de l'écran (nav-bar). Dans la moitié basse — la nav de la home, posée
 * sous la photo — le panneau s'ouvrirait sous l'horizon : il se pose alors
 * AU-DESSUS, son coin bas gauche contre le coin haut droit du déclencheur.
 */
export const SitesMenu = forwardRef<HTMLButtonElement, TriggerProps>(function SitesMenu(
  { label, className, style, ...rest },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<
    { above: false; top: number; right: number } | { above: true; bottom: number; left: number } | null
  >(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const id = useId();
  useImperativeHandle(ref, () => triggerRef.current!);

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    // Le panneau est calé sur une position mesurée : tout ce qui déplace le
    // déclencheur (défilement du hero sur la home, redimensionnement) le ferme.
    const onMove = () => close(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, { capture: true, passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, { capture: true });
    };
  }, [open, close]);

  const toggle = (viaKeyboard: boolean) => {
    if (open) return close(false);
    const r = triggerRef.current!.getBoundingClientRect();
    const vw = window.innerWidth;
    setBox(
      r.top > window.innerHeight / 2
        ? {
            above: true,
            bottom: window.innerHeight - r.top + CORNER_OFFSET,
            left: Math.min(r.right + CORNER_OFFSET, vw - PANEL_WIDTH - 16),
          }
        : { above: false, top: r.bottom + PANEL_OFFSET, right: Math.max(16, vw - r.right) },
    );
    setOpen(true);
    if (viaKeyboard) {
      requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('a')?.focus());
    }
  };

  // Tab hors du panneau : il se referme et le focus revient au déclencheur,
  // d'où le Tab suivant reprend dans l'ordre de la page.
  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const links = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a') ?? []);
    const first = links[0];
    const last = links[links.length - 1];
    if ((!e.shiftKey && document.activeElement === last) || (e.shiftKey && document.activeElement === first)) {
      e.preventDefault();
      close(true);
    }
  };

  return (
    <>
      <button
        {...rest}
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => toggle(e.detail === 0)}
        className={cn(className, 'md:inline-flex items-center')}
        style={{ ...style, gap: '0.2em' }}
      >
        {label}
        {/* Chevron en `em` : il suit le corps du libellé, que le hero de la
            home met à l'échelle pendant le morph. `rotate` et pas `transform`
            (Tailwind v4, CLAUDE.md §7.5–7.8). */}
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          className={cn(
            'transition-[rotate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
            open && 'rotate-180',
          )}
          style={{ width: '0.5em', height: '0.5em', marginTop: '0.06em' }}
        >
          <path d="M1.5 4 6 8.5 10.5 4" />
        </svg>
      </button>

      {open &&
        box &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            onKeyDown={onPanelKey}
            data-sites-panel={box.above ? 'above' : 'below'}
            className="fixed z-[70]"
            style={{
              ...(box.above ? { bottom: box.bottom, left: box.left } : { top: box.top, right: box.right }),
              width: PANEL_WIDTH,
              padding: 6,
              borderRadius: CONTROL_RADIUS,
              backgroundColor: 'var(--color-bg-raised)',
              boxShadow: '0 0 0 1px var(--color-line), 0 18px 40px -24px rgb(10 10 10 / 0.35)',
            }}
          >
            <nav aria-label={label}>
              <SitesList onNavigate={() => setOpen(false)} />
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
});
