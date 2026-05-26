'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { GlyphLogo } from './GlyphLogo';

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/flat-gallery', label: 'Flat Gallery' },
  { href: '/contact', label: 'Contact' },
  { href: '/hire-me', label: 'Hire me' },
];

/**
 * Nav-bar globale, identique sur toutes les pages publiques.
 * Layout : full-width flex space-between, [32px PAD_LEFT] LOGO ─ About ─ Flat Gallery ─ Contact ─ Hire me [64px PAD_RIGHT].
 * Cohérent pixel-pour-pixel avec l'état final du morph hero de la home.
 * Masqué sur `/` (le HomeHero gère son propre morph qui devient la nav-bar).
 */
export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header
        className={cn(
          // Background TOUJOURS opaque (100%) — la nav-bar est un espace bloqué :
          // aucun contenu ne peut être visuellement visible derrière, peu importe le scroll.
          // Hauteur h-16 (64px) FIXE = identique au post-morph de la home (HEADER_HEIGHT).
          'fixed inset-x-0 top-0 z-50 h-16 bg-[var(--color-bg)]',
          // Sur la home, masqué — le HomeHero morphe vers ce layout exact.
          isHome && 'hidden'
        )}
        aria-hidden={isHome}
      >
        <nav
          aria-label="Main navigation"
          className="flex h-full items-center justify-between"
          style={{ paddingLeft: 32, paddingRight: 64 }}
        >
          <Link
            href="/"
            className="flex items-center shrink-0"
            aria-label="A. Matencio — home"
          >
            <GlyphLogo size={28} title="A. Matencio — home" />
          </Link>

          {/* 4 nav-links : visibles sur desktop, distribuées par space-between */}
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  // Specs Pencil nav item : fontSize 32, fontWeight 700, letterSpacing -1.28 (= -0.04em).
                  // PAS d'uppercase (Pencil = "About", pas "ABOUT").
                  'hidden md:inline-block text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none transition-opacity hover:opacity-60 motion-reduce:transition-none',
                  active && 'underline underline-offset-4 decoration-2'
                )}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Burger : visible sur mobile uniquement */}
          <button
            type="button"
            className="md:hidden size-10 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-fg)] border-2 border-[var(--color-fg)]"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
          </button>
        </nav>
      </header>

      {open && (
        <div
          id="mobile-nav"
          className="fixed inset-0 z-[60] md:hidden bg-[var(--color-bg)] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile menu"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[var(--color-fg)]">
            <span className="text-[11px] uppercase tracking-[0.3em] font-bold text-[var(--color-fg)]">
              Menu
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="size-10 flex items-center justify-center text-[var(--color-fg)] border-2 border-[var(--color-fg)]"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          </div>
          <nav
            aria-label="Mobile navigation"
            className="flex-1 flex flex-col"
          >
            {LINKS.map((link, i) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex-1 flex items-center px-6 text-4xl font-black uppercase tracking-tighter text-[var(--color-fg)] leading-none active:bg-[var(--color-fg)] active:text-[var(--color-bg)]',
                    i > 0 && 'border-t-2 border-[var(--color-fg)]',
                    active && 'underline underline-offset-8 decoration-2'
                  )}
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
