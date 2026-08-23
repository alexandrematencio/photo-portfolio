'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { GlyphLogo } from './GlyphLogo';
import {
  NAV_LINKS as LINKS,
  isSamePage,
  notifySamePageNav,
} from '@/lib/site/nav';

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
  // /splash-test est un sandbox qui clone la home pour prototyper le splash —
  // on masque le header ici aussi pour que le test reflète exactement `/`.
  // À supprimer en même temps que `app/(site)/splash-test/` pour rollback total.
  const hideHeader = isHome || pathname === '/splash-test';

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
          hideHeader && 'hidden'
        )}
        aria-hidden={hideHeader}
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
            {/* Couleur héritée du token, pas figée : `--color-logo` vaut le
                cobalt brand par défaut et passe au blanc pendant l'immersion
                de /series (`:root[data-immersive]`, globals.css). Le SVG est
                inline, il n'y a donc aucun fichier à échanger. */}
            <GlyphLogo
              size={28}
              color="var(--color-logo)"
              title="A. Matencio — home"
            />
          </Link>

          {/* 4 nav-links : visibles sur desktop, distribuées par space-between.
              `data-cursor-invert` déclenche le disque d'inversion (CursorInvert.tsx). */}
          {LINKS.map((link) => {
            const active = isSamePage(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                // Cliquer le lien de la page courante doit la RAMENER À SON
                // ÉTAT D'ACCUEIL (cf. notifySamePageNav) : Next ne remonte pas
                // la page, son état interne survivrait sinon intact.
                onClick={() => {
                  if (active) notifySamePageNav(link.href);
                }}
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
