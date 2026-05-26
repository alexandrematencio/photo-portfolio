'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GlyphLogo } from './GlyphLogo';

/**
 * Mobile menu — closed state + open drawer.
 * Spec from templates.pen: `burger-menu-open-btn` (vCfHj) + `iPhone 17 - menu-open` (jPTyJ).
 *
 * - Closed: a 16/700 "MENU" text button with a 1 px black border. Position: fixed top-8 right-8
 *   (32 px from the viewport edges, matching the 32 px margin rule of the open menu).
 * - Open: full-screen overlay on bg #f5f2f0. Top bar 32 px padding all sides with the cobalt
 *   glyph on the left and an X close icon on the right. Nav items pushed to bottom-left with
 *   32 px padding (left + bottom), gap 32 px, 48 px / bold.
 * - Items: About, Flat Gallery, Contact, Hire me, Instagram (external link).
 *
 * Rendered once at the layout level — both home and editorial pages share this single instance.
 */

type Link = { href: string; label: string; external?: boolean };

const MOBILE_LINKS: Link[] = [
  { href: '/about', label: 'About' },
  { href: '/flat-gallery', label: 'Flat Gallery' },
  { href: '/contact', label: 'Contact' },
  { href: '/hire-me', label: 'Hire me' },
  // TODO: replace with the actual Instagram handle once provided.
  { href: 'https://www.instagram.com/', label: 'Instagram', external: true },
];

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
          className="text-[16px] font-bold tracking-[-0.02em] uppercase text-[var(--color-fg)]"
        >
          MENU
        </button>
      </div>

      {/* OPEN — full-screen drawer on bg #f5f2f0 */}
      {open && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
          className="fixed inset-0 z-[60] md:hidden flex flex-col"
          style={{ backgroundColor: '#f5f2f0' }}
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

          {/* Nav items — pushed to bottom via mt-auto, aligned bottom-left,
              gap 32, paddingLeft 32, paddingBottom 32 (per Pencil mockup). */}
          <nav
            aria-label="Mobile navigation"
            className="mt-auto flex flex-col gap-8"
            style={{ paddingLeft: 32, paddingBottom: 32, paddingRight: 32 }}
          >
            {MOBILE_LINKS.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="text-[48px] font-bold tracking-[-0.02em] leading-none text-[var(--color-fg)] active:opacity-60 w-fit"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="text-[48px] font-bold tracking-[-0.02em] leading-none text-[var(--color-fg)] active:opacity-60 w-fit"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>
        </div>
      )}
    </>
  );
}
