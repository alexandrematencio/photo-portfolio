'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GlyphLogo } from './GlyphLogo';
import { cn } from '@/lib/utils/cn';
import {
  ACTIVE_FILL_MOBILE,
  ACTIVE_FILL_PADDING_MOBILE,
  CONTROL_RADIUS,
} from '@/lib/site/controls';
import {
  MOBILE_NAV_LINKS,
  isSamePage,
  notifySamePageNav,
} from '@/lib/site/nav';

/**
 * Mobile menu — closed state + open drawer.
 * Spec from templates.pen: `burger-menu-open-btn` (vCfHj) + `iPhone 17 - menu-open` (jPTyJ).
 *
 * - Closed: a 16/700 "MENU" text button with a 1 px black border. Position: fixed top-8 right-8
 *   (32 px from the viewport edges, matching the 32 px margin rule of the open menu).
 * - Open: full-screen overlay on the `--color-bg-raised` rung. Top bar 32 px padding all sides with the cobalt
 *   glyph on the left and an X close icon on the right. Nav items pushed to bottom-left with
 *   32 px padding (left + bottom), gap 32 px, 48 px / bold.
 * - Items: About, Archives, Contact, Digital Agency, Socials, Instagram (external link).
 *
 * Rendered once at the layout level — both home and editorial pages share this single instance.
 */

// Le lien Instagram n'existe que dans ce drawer : il est déclaré à part dans
// `lib/site/nav.ts` (MOBILE_EXTRA_LINKS) pour ne pas polluer la nav desktop.

const MOBILE_LINKS = MOBILE_NAV_LINKS;

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change so navigating from inside the menu dismisses it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
          the glyph in <SiteHeader />, which lives in the same h-16 nav-bar slot. */}
      <div
        className="md:hidden fixed top-0 right-0 z-[55] h-16 flex items-center"
        style={{ paddingRight: 32 }}
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
          className="fixed inset-0 z-[60] md:hidden flex flex-col justify-between"
          style={{ backgroundColor: 'var(--color-bg-raised)' }}
        >
          {/* Top bar — 32 px padding all sides, glyph left + X close right */}
          <div
            className="flex items-center justify-between"
            style={{ padding: 32 }}
          >
            <Link
              href="/"
              aria-label="Home"
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
              paddingBottom 32 + gouttière de 32 px (per Pencil mockup `jPTyJ`).

              ⚠️ La gouttière est amputée de l'inset du surlignage et rendue par
              le padding des items : c'est le TEXTE qui doit tomber sur les 32 px,
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
              paddingLeft: 32 - ACTIVE_FILL_MOBILE.inset,
              paddingBottom: 32,
              paddingRight: 32,
              rowGap: 32 - ACTIVE_FILL_MOBILE.top - ACTIVE_FILL_MOBILE.bottom,
            }}
          >
            {MOBILE_LINKS.map((link) => {
              // Le lien externe (Instagram) n'est jamais « la page courante ».
              const active = !link.external && isSamePage(link.href, pathname);
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
              return link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  style={itemStyle}
                  className={itemClass}
                >
                  {link.label}
                </a>
              ) : (
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
