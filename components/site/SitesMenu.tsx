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
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { CONTROL_RADIUS } from '@/lib/site/controls';
import { SITES, isSamePage } from '@/lib/site/nav';
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
 *
 * Le même panneau porte le menu « Journal » de blog.amatencio.com
 * (2026-10-18) : tous les articles, puis une rangée par série — `entries`.
 * Le voyant y dit la page affichée.
 */

/** Une rangée de menu : un nom, une ligne de détail (domaine, nombre d'articles). */
export type MenuEntry = {
  label: string;
  detail: string;
  /** `null` : pas encore en ligne — grisé, « Soon ». */
  href: string | null;
  external?: boolean;
  /** Forcé (le site que ce build produit) ; à défaut, comparé à la page affichée. */
  here?: boolean;
};

const SITE_ENTRIES: MenuEntry[] = SITES.map(({ host, ...site }) => ({ ...site, detail: host }));

/** Écart nav-bar → panneau. */
const PANEL_OFFSET = 14;
/** Écart coin à coin quand le panneau s'ouvre au-dessus (nav de la home). */
const CORNER_OFFSET = 4;
const PANEL_WIDTH = 300;
/** Marge de la découpe autour du panneau : son ombre déborde d'autant. */
const SHADOW_ROOM = 24;

function Row({ site, here, onNavigate }: { site: MenuEntry; here: boolean; onNavigate?: () => void }) {
  const rowStyle: CSSProperties = { padding: '14px 16px', borderRadius: CONTROL_RADIUS };
  const body = (
    <>
      <span className="flex self-center">
        <StateDot on={here} />
      </span>
      <span className="flex min-w-0 flex-col" style={{ gap: 7 }}>
        <span className="text-[22px] font-bold tracking-[-0.02em] leading-none">
          {site.label}
          {here && <span className="sr-only"> (current)</span>}
        </span>
        <span
          className={cn(
            MICRO_LABEL,
            'normal-case font-medium tracking-normal transition-colors duration-200 ease-out motion-reduce:transition-none',
            site.href ? 'text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg-faint)] group-focus-visible:text-[var(--color-fg-faint)]' : 'text-[var(--color-fg-faint)]',
          )}
        >
          {site.detail}
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

export function SitesList({
  onNavigate,
  className,
  entries = SITE_ENTRIES,
}: {
  onNavigate?: () => void;
  className?: string;
  entries?: MenuEntry[];
}) {
  const pathname = usePathname();
  return (
    <ul className={cn('flex flex-col', className)}>
      {entries.map((site) => (
        <Row
          key={site.href ?? site.label}
          site={site}
          here={site.here ?? Boolean(site.href && !isExternal(site.href) && pathname && isSamePage(site.href, pathname))}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

type TriggerProps = Omit<ComponentPropsWithoutRef<'a'>, 'children' | 'href'> & {
  label: string;
  /** Où mène le clic sur le déclencheur : le hub pour « All sites », l'accueil du journal pour « Journal ». */
  href: string;
  /** Les rangées du panneau ; à défaut, les sites d'amatencio.com. */
  entries?: MenuEntry[];
};

/** Grâce avant fermeture quand le pointeur quitte le déclencheur ou le panneau : le temps de franchir l'écart entre les deux. */
const CLOSE_DELAY = 150;

/**
 * Déclencheur de la nav-bar + panneau. Le déclencheur est une ENTRÉE de la
 * nav-bar comme les autres : il reçoit les mêmes classes et attributs
 * (`data-nav-link`, `data-cursor-invert`…) et le hero de la home le mesure et
 * le déplace comme un lien (CLAUDE.md §3.6). D'où le `ref` transmis.
 *
 * Depuis le 2026-10-22 (demande Alexandre, sur le modèle du menu « Services »
 * d'AAXLO), c'est un LIEN : le menu s'ouvre au SURVOL, le clic mène à la page
 * de l'entrée (« Journal » → l'accueil du blog, « All sites » → le hub
 * `amatencio.com`) sans viser plus bas dans le panneau. Quitter le
 * déclencheur ou le panneau referme après `CLOSE_DELAY`, que le passage de
 * l'un à l'autre annule. Sans survol :
 * - au doigt (tablette), le premier toucher ouvre, le second suit le lien ;
 * - au clavier, Entrée suit le lien, ↓ ou Espace ouvrent et posent le focus
 *   sur la première rangée ; ↑ / ↓ parcourent, Échap et la sortie par Tab
 *   referment et rendent le focus au déclencheur.
 *
 * Le panneau est rendu dans `document.body`, en `position: fixed` calée sur
 * le déclencheur : sur la home, les entrées de la nav portent les transforms
 * du morph, et un `fixed` posé DANS un élément transformé se positionne par
 * rapport à lui.
 *
 * Placement : TOUJOURS calé sur le bord gauche du déclencheur, partout sur le
 * site — sauf s'il sortirait de l'écran (« All sites », dernière entrée du
 * portfolio) : il se cale alors sur le bord droit du déclencheur. Sous le déclencheur dans la moitié
 * haute de l'écran (nav-bar) ; dans la moitié basse — la nav de la home, posée
 * sous la photo — il s'ouvrirait sous l'horizon : il se pose alors AU-DESSUS.
 *
 * Il se dévoile par le bord qui touche le déclencheur (`clip-path`, 250 ms
 * qui freine) et se retire plus vite (160 ms qui accélère), comme le menu
 * d'AAXLO. Coupé sous `prefers-reduced-motion`.
 */
export const SitesMenu = forwardRef<HTMLAnchorElement, TriggerProps>(function SitesMenu(
  { label, href, entries, className, style, ...rest },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<
    { above: false; top: number; left: number } | { above: true; bottom: number; left: number } | null
  >(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Le dernier geste sur le déclencheur venait-il d'un doigt ou d'un stylet ?
  const touch = useRef(false);
  // Ouvert au clavier : le focus part sur la première rangée une fois le panneau rendu (plus `inert`).
  const focusFirst = useRef(false);
  const pathname = usePathname();
  const id = useId();
  useImperativeHandle(ref, () => triggerRef.current!);

  const close = useCallback((refocus: boolean) => {
    window.clearTimeout(timer.current);
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const show = () => {
    window.clearTimeout(timer.current);
    const r = triggerRef.current!.getBoundingClientRect();
    // Bord gauche du déclencheur ; s'il n'y a pas la place (« All sites »,
    // dernière entrée du portfolio, contre le bord droit), bord DROIT du
    // déclencheur — le panneau reste accroché à son entrée.
    const left = Math.max(16, r.left + PANEL_WIDTH <= window.innerWidth - 16 ? r.left : r.right - PANEL_WIDTH);
    setBox(
      r.top > window.innerHeight / 2
        ? { above: true, bottom: window.innerHeight - r.top + CORNER_OFFSET, left }
        : { above: false, top: r.bottom + PANEL_OFFSET, left },
    );
    setOpen(true);
  };

  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    close(false);
  }, [pathname, close]);

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

  const links = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a') ?? []);

  const onTriggerKey = (e: KeyboardEvent<HTMLAnchorElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== ' ') return;
    e.preventDefault();
    // Déjà ouvert (le pointeur est dessus) : le panneau est rendu, on y entre.
    if (open) return links()[0]?.focus();
    focusFirst.current = true;
    show();
  };

  useEffect(() => {
    if (!open || !focusFirst.current) return;
    focusFirst.current = false;
    links()[0]?.focus();
  }, [open]);

  // ↑ / ↓ entre les rangées ; Tab hors du panneau le referme et rend le focus
  // au déclencheur, d'où le Tab suivant reprend dans l'ordre de la page.
  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const all = links();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (e.key === 'ArrowUp' && at <= 0) return close(true);
      all[Math.min(all.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1))]?.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    if ((!e.shiftKey && at === all.length - 1) || (e.shiftKey && at === 0)) {
      e.preventDefault();
      close(true);
    }
  };

  const triggerProps = {
    ...rest,
    ref: triggerRef,
    'aria-haspopup': true,
    'aria-expanded': open,
    'aria-controls': id,
    onPointerEnter: (e: ReactPointerEvent<HTMLAnchorElement>) => e.pointerType === 'mouse' && show(),
    onPointerLeave: (e: ReactPointerEvent<HTMLAnchorElement>) => e.pointerType === 'mouse' && hide(),
    onPointerDown: (e: ReactPointerEvent<HTMLAnchorElement>) => {
      touch.current = e.pointerType !== 'mouse';
    },
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      // Au doigt, pas de survol : le premier toucher ouvre le menu.
      if (touch.current && !open) {
        e.preventDefault();
        show();
        return;
      }
      close(false);
    },
    onKeyDown: onTriggerKey,
    className: cn(className, 'md:inline-flex items-center'),
    style: { ...style, gap: '0.2em' },
  };

  const content = (
    <>
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
    </>
  );

  // Découpe du panneau : marges négatives pour laisser passer l'ombre ; fermé,
  // le bord opposé au déclencheur remonte jusqu'à lui.
  const clip = open
    ? `inset(-${SHADOW_ROOM}px -${SHADOW_ROOM}px -${SHADOW_ROOM * 2}px -${SHADOW_ROOM}px)`
    : box?.above
      ? `inset(100% -${SHADOW_ROOM}px -${SHADOW_ROOM * 2}px -${SHADOW_ROOM}px)`
      : `inset(-${SHADOW_ROOM}px -${SHADOW_ROOM}px 100% -${SHADOW_ROOM}px)`;

  return (
    <>
      {isExternal(href) ? (
        <a href={href} {...triggerProps}>
          {content}
        </a>
      ) : (
        <Link href={href} {...triggerProps}>
          {content}
        </Link>
      )}

      {box &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            inert={!open}
            onKeyDown={onPanelKey}
            onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
            onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
            data-sites-panel={box.above ? 'above' : 'below'}
            className={cn(
              'fixed z-[70] motion-reduce:transition-none',
              // `visibility` ne se transitionne qu'à la FERMETURE (il tient le
              // panneau visible jusqu'au bout du retrait) ; à l'ouverture il
              // bascule d'un coup — sinon le panneau est encore « hidden » à la
              // première image et le focus clavier n'y entre pas.
              open
                ? 'transition-[clip-path,opacity] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]'
                : 'transition-[clip-path,opacity,visibility] duration-[160ms] ease-in',
            )}
            style={{
              ...(box.above ? { bottom: box.bottom, left: box.left } : { top: box.top, left: box.left }),
              width: PANEL_WIDTH,
              padding: 6,
              borderRadius: CONTROL_RADIUS,
              backgroundColor: 'var(--color-bg-raised)',
              boxShadow: '0 0 0 1px var(--color-line), 0 18px 40px -24px rgb(10 10 10 / 0.35)',
              clipPath: clip,
              opacity: open ? 1 : 0,
              visibility: open ? 'visible' : 'hidden',
            }}
          >
            <nav aria-label={label}>
              <SitesList entries={entries} onNavigate={() => close(false)} />
            </nav>
          </div>,
          document.body,
        )}
    </>
  );
});
