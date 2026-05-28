'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { GlyphLogo } from './GlyphLogo';

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/archives', label: 'Archives' },
  { href: '/contact', label: 'Contact' },
  { href: '/digital-agency', label: 'Digital Agency' },
  { href: '/socials', label: 'Socials' },
];

/**
 * Nav-bar globale, identique sur toutes les pages publiques.
 * Layout : full-width flex space-between, [32px PAD_LEFT] LOGO ─ About ─ Archives ─ Contact ─ Digital Agency ─ Socials [64px PAD_RIGHT].
 * Cohérent pixel-pour-pixel avec l'état final du morph hero de la home.
 * Masqué sur `/` (le HomeHero gère son propre morph qui devient la nav-bar).
 *
 * Mobile menu (burger button + drawer) lives in `<MobileMenu />` at the layout level.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header
        className={cn(
          // Header transparent sur les deux breakpoints — le contenu (photos /
          // gallery) reste visible derrière le nav et permet au CursorInvert
          // disque de blend avec ce qui défile sous le menu.
          'fixed inset-x-0 top-0 z-50 h-16',
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

          {/* 4 nav-links : visibles sur desktop, distribuées par space-between.
              `data-cursor-invert` déclenche le disque d'inversion (CursorInvert.tsx). */}
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                data-cursor-invert
                className={cn(
                  // Specs Pencil nav item : fontSize 32, fontWeight 700, letterSpacing -1.28 (= -0.04em).
                  // PAS d'uppercase (Pencil = "About", pas "ABOUT").
                  'hidden md:inline-block text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none motion-reduce:transition-none',
                  active && 'underline underline-offset-4 decoration-2'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
