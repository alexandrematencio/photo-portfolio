'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { GlyphLogo } from './GlyphLogo';
import { SitesList, type MenuEntry } from './SitesMenu';
import { HUB_URL, IS_BLOG, isHubPage } from '@/lib/site/sites';
import { DICT, homePath, langOfPath } from '@/lib/journal/i18n';
import { cn } from '@/lib/utils/cn';
import {
  ACTIVE_FILL_MOBILE,
  ACTIVE_FILL_PADDING_MOBILE,
  CONTROL_RADIUS,
} from '@/lib/site/controls';
import {
  HUB_NAV_LINKS,
  MOBILE_NAV_LINKS,
  isSamePage,
  journalIsActive,
  navHref,
  notifySamePageNav,
} from '@/lib/site/nav';

/**
 * Mobile menu — closed state + open drawer.
 * Spec from templates.pen: `burger-menu-open-btn` (vCfHj) + `iPhone 17 - menu-open` (jPTyJ).
 *
 * - Closed: a 16/700 "MENU" text button. Position: fixed top-0, right edge on `--page-gutter`
 *   (same vertical as the page content and the header glyph).
 * - Open: full-screen overlay on the `--color-bg-raised` rung. Top bar 32 px above, page gutter on the sides, with the cobalt
 *   glyph on the left and an X close icon on the right. Nav items pushed to bottom-left with
 *   page-gutter padding (left), 32 px (bottom), gap 32 px, 48 px / bold.
 * - Items: Home, puis la nav principale (Series, Archives, About, Journal, All sites).
 *
 * Rendered once at the layout level — both home and editorial pages share this single instance.
 */

// « Home » n'existe que dans ce drawer (le glyph joue ce rôle sur desktop) :
// la liste est composée dans `lib/site/nav.ts`, jamais ici. Le lien Instagram
// qui vivait là a été retiré le 2026-08-24 — les réseaux vivent sur /contact.

export function MobileMenu({ journalMenu }: { journalMenu?: MenuEntry[] }) {
  const [open, setOpen] = useState(false);
  // Le sous-menu déplié — « All sites » ou, sur le blog, « Journal ». Un seul à la fois.
  const [subOpen, setSubOpen] = useState<'sites' | 'journal' | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lang = langOfPath(pathname);
  // About vit sur le hub : son menu est celui d'amatencio.com (lib/site/nav.ts).
  const onHub = isHubPage(pathname);
  const MOBILE_LINKS = (onHub ? HUB_NAV_LINKS : MOBILE_NAV_LINKS).map((link) => ({ ...link, href: navHref(link, lang) }));

  // Close on route change so navigating from inside the menu dismisses it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Le tiroir rouvre toujours replié : un sous-menu est un détour, pas un état.
  useEffect(() => {
    if (!open) setSubOpen(null);
  }, [open]);

  // La colonne est calée en BAS de l'écran : dépliée, la liste des sites
  // passe sous le bord. Le tiroir défile jusqu'à elle à la fin du dépliage
  // (300 ms), sans animation si le mouvement est réduit.
  useEffect(() => {
    if (!subOpen) return;
    const t = window.setTimeout(() => {
      const el = drawerRef.current;
      if (!el) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({ top: el.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
    }, 300);
    return () => window.clearTimeout(t);
  }, [subOpen]);

  // ESC closes + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      {/* CLOSED — "MENU" text button, plain text (no border, no bg).
          Wrapped in a 64 px tall flex container at top-0 so it aligns vertically with
          the glyph in <SiteHeader />, which lives in the same h-16 nav-bar slot.

          `data-top-bar` : glisse hors écran au défilement descendant avec le
          glyph du SiteHeader — même attribut, même transition CSS, les deux
          morceaux bougent d'un seul tenant (cf. lib/site/top-bar.ts). Sur la
          home l'attribut est inerte : le contrôleur n'y écoute rien. */}
      <div
        data-top-bar
        className="md:hidden fixed top-0 right-0 z-[55] h-16 flex items-center"
        style={{ paddingRight: 'var(--page-gutter)' }}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-menu"
          data-mobile-menu-button
          className="text-[16px] font-bold tracking-[-0.02em] uppercase text-[var(--color-fg)]"
        >
          MENU
        </button>
      </div>

      {/* OPEN — full-screen drawer, posé sur le barreau « calque » de l'échelle.
          `justify-between` on the column flex pushes the top bar to the top
          edge and the nav to the bottom edge (per Pencil mockup `jPTyJ`). */}
      {open && (
        <div
          ref={drawerRef}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
          // Le tiroir est un calque POSÉ sur le papier : c'est le barreau 1 de
          // l'échelle de valeurs, le même que le fond de la lightbox desktop.
          // Il portait `#f5f2f0` en dur, la lightbox `#F7F3F1` — 0,4 point de
          // L* d'écart, donc le même barreau écrit deux fois, avec deux teintes
          // différentes. Le marqueur `data-scheme="light"` qui l'accompagnait a
          // disparu avec le mode immersif : plus rien n'inverse les encres du
          // site, il n'y a donc plus d'inversion à laquelle échapper.
          className="fixed inset-0 z-[60] md:hidden flex flex-col justify-between overflow-y-auto"
          style={{ backgroundColor: 'var(--color-bg-raised)' }}
        >
          {/* Top bar — 32 px vertical, page gutter on the sides, glyph left + X close right */}
          <div
            className="flex items-center justify-between"
            style={{ paddingBlock: 32, paddingInline: 'var(--page-gutter)' }}
          >
            <Link
              href={IS_BLOG ? homePath(lang) : onHub ? HUB_URL : '/'}
              aria-label={IS_BLOG ? DICT[lang].journalHome : 'Home'}
              onClick={() => setOpen(false)}
              className="inline-flex"
            >
              <GlyphLogo size={32} title="A. Matencio — home" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex items-center justify-center text-[var(--color-fg)]"
            >
              <X size={24} strokeWidth={1.5} />
            </button>
          </div>

          {/* Nav items — bottom-left aligned via `justify-between` on the parent.
              paddingBottom 32 + gouttière de page (`--page-gutter`).

              ⚠️ La gouttière est amputée de l'inset du surlignage et rendue par
              le padding des items : c'est le TEXTE qui doit tomber sur la gouttière,
              pas la boîte qui le porte. Et l'écart vertical se réduit d'autant
              que le padding haut+bas, pour la même raison — il s'ajoute sinon à
              l'écart, et la colonne s'aère par rapport au mockup. Les deux se
              DÉRIVENT d'`ACTIVE_FILL_MOBILE` : élargir le surlignage sans elles
              décale toute la colonne, sans le moindre signal.

              Le padding est posé sur TOUS les items, le fond sur le seul actif
              (CLAUDE.md §7.7). L'exception « actif seulement » de la nav-bar
              desktop ne vaut QUE là-bas, où la géométrie de la rangée est celle
              d'arrivée du morph du hero. */}
          <nav
            aria-label="Mobile navigation"
            className="flex flex-col"
            style={{
              paddingLeft: `calc(var(--page-gutter) - ${ACTIVE_FILL_MOBILE.inset}px)`,
              paddingBottom: 32,
              paddingRight: 'var(--page-gutter)',
              rowGap: 32 - ACTIVE_FILL_MOBILE.top - ACTIVE_FILL_MOBILE.bottom,
            }}
          >
            {MOBILE_LINKS.map((link) => {
              const active = isSamePage(link.href, pathname);
              const itemStyle = {
                padding: ACTIVE_FILL_PADDING_MOBILE,
                borderRadius: CONTROL_RADIUS,
              };
              const itemClass = cn(
                'text-[48px] font-bold tracking-[-0.02em] leading-none text-[var(--color-fg)] active:opacity-60 w-fit',
                // Même marque que la nav-bar desktop : fond plein, libellé qui
                // reste noir (7,26:1 dessus). Le tiroir n'avait AUCUNE marque
                // d'état alors que la nav desktop en a une — même navigation,
                // deux grammaires.
                active && 'bg-[var(--color-active-bg)]'
              );
              // « All sites » (et « Journal » sur le blog) : un tiroir dans le
              // tiroir. La liste se déplie SOUS le libellé (grille 0fr → 1fr,
              // 300 ms, le contenu 60 ms après — même geste que les lignes de
              // la page d'accueil du journal) et pousse la colonne vers le
              // haut ; le tiroir défile si un petit écran n'a plus la place.
              // « Journal » y est surligné comme la page active : on est dans
              // le journal, quelle que soit la page.
              if (link.menu) {
                const menu = link.menu;
                const subOn = subOpen === menu;
                const panelId = `mobile-${menu}`;
                return (
                  <div key={link.label} className="flex flex-col">
                    <button
                      type="button"
                      aria-expanded={subOn}
                      aria-controls={panelId}
                      aria-current={menu === 'journal' && journalIsActive(pathname) ? 'page' : undefined}
                      onClick={() => setSubOpen((v) => (v === menu ? null : menu))}
                      style={itemStyle}
                      className={cn(
                        itemClass,
                        'flex items-center text-left',
                        menu === 'journal' && journalIsActive(pathname) && 'bg-[var(--color-active-bg)]'
                      )}
                    >
                      {link.label}
                      <svg
                        aria-hidden
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        className={cn(
                          'transition-[rotate] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                          subOn && 'rotate-180'
                        )}
                        style={{ width: '0.46em', height: '0.46em', marginLeft: '0.2em', marginTop: '0.06em' }}
                      >
                        <path d="M1.5 4 6 8.5 10.5 4" />
                      </svg>
                    </button>
                    <div
                      id={panelId}
                      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
                      style={{ gridTemplateRows: subOn ? '1fr' : '0fr' }}
                      inert={!subOn}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <SitesList
                          entries={menu === 'journal' ? (journalMenu ?? []) : undefined}
                          onNavigate={() => setOpen(false)}
                          className={cn(
                            'transition-opacity duration-300 ease-out motion-reduce:transition-none',
                            subOn ? 'opacity-100 delay-[60ms]' : 'opacity-0'
                          )}
                        />
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => {
                    setOpen(false);
                    // Même règle que la nav-bar desktop : le lien de la page
                    // courante la ramène à son état d'accueil.
                    if (isSamePage(link.href, pathname)) {
                      notifySamePageNav(link.href);
                    }
                  }}
                  style={itemStyle}
                  className={itemClass}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
