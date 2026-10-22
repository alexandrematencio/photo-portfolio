'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { ACTIVE_FILL_PADDING, CONTROL_RADIUS } from '@/lib/site/controls';
import { GlyphLogo } from './GlyphLogo';
import { SitesMenu, type MenuEntry } from './SitesMenu';
import { DICT, homePath, langOfPath } from '@/lib/journal/i18n';
import { IS_BLOG, isExternal, isPhotoHome } from '@/lib/site/sites';
import {
  NAV_LINKS as LINKS,
  isSamePage,
  notifySamePageNav,
} from '@/lib/site/nav';
import { beginHomeReturn } from '@/lib/site/home-return';
import { beginPageLeave } from '@/lib/site/page-transition';
import { preloadImage } from '@/lib/utils/image-preload';

type SiteHeaderProps = {
  /** Photo du hero de la home (`homePage.hero`) : préchargée dès que le
      visiteur vise le logo, pour qu'elle soit là quand le hero naît. */
  heroSrc?: string | null;
  /** Journal : les rangées du menu « Journal » (BlogShell), dans la langue de la page. */
  journalMenu?: MenuEntry[];
};

/**
 * Nav-bar globale, identique sur toutes les pages publiques.
 * Layout : full-width flex space-between, [32px PAD_LEFT] LOGO ─ Series ─ Archives ─ About ─ Journal ─ All sites [64px PAD_RIGHT].
 * Cohérent pixel-pour-pixel avec l'état final du morph hero de la home.
 * Masqué sur `/` (le HomeHero gère son propre morph qui devient la nav-bar).
 *
 * Mobile menu (burger button + drawer) lives in `<MobileMenu />` at the layout level.
 */
export function SiteHeader({ heroSrc, journalMenu }: SiteHeaderProps) {
  const pathname = usePathname();
  const lang = langOfPath(pathname);
  const glyphLabel = IS_BLOG ? DICT[lang].journalHome : 'A. Matencio — home';
  // L'intention, pas l'anticipation : appui, focus ou survol du logo
  // (cf. lib/utils/image-preload.ts). La nav-bar ne défile jamais sous le
  // curseur, le survol y est donc toujours un geste.
  const warmHero = () => {
    if (heroSrc) void preloadImage(heroSrc, 'high');
  };
  // Sur le journal, `/` est la page d'accueil du journal, sans hero : la
  // nav-bar y est affichée comme partout (lib/site/sites.ts).
  const isHome = isPhotoHome(pathname);
  // /splash-test est un sandbox qui clone la home pour prototyper le splash —
  // on masque le header ici aussi pour que le test reflète exactement `/`.
  // À supprimer en même temps que `app/(site)/splash-test/` pour rollback total.
  const hideHeader = isHome || pathname === '/splash-test';

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* `data-top-bar` : sous `md`, la barre glisse hors écran quand on
          descend et revient quand on remonte (mode « scroll-triggered »,
          contrôleur TopBarAutoHide + CSS globals.css — cf. lib/site/top-bar.ts).
          Jamais sur la home : le contrôleur n'y écoute rien. */}
      <header
        data-top-bar
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
          // Journal : un menu ordinaire, aligné à gauche après le glyph
          // (demande Alexandre, 2026-10-18). Le portfolio garde
          // `justify-between` : sa nav-bar est l'état d'arrivée du morph du
          // hero de la home (CLAUDE.md §3.6), qui répartit l'espace restant.
          className={cn(
            'flex h-full items-center',
            IS_BLOG ? 'justify-start md:gap-10' : 'justify-between'
          )}
          // Gauche : la gouttière de page (20 sous `md`, 32 au-dessus), pour
          // que le glyph tombe sur la verticale du contenu sur téléphone aussi.
          // Droite : 64 au desktop, inchangé — sous `md` les libellés sont
          // cachés et seul le bouton MENU (`MobileMenu`) occupe ce bord.
          style={{ paddingLeft: 'var(--page-gutter)', paddingRight: 64 }}
        >
          <Link
            href={IS_BLOG ? homePath(lang) : '/'}
            className="flex items-center shrink-0"
            aria-label={glyphLabel}
            onPointerEnter={warmHero}
            onPointerDown={warmHero}
            onFocus={warmHero}
            // Retour à la home : le corps de page part à droite, le hero naît
            // sur ce glyph (lib/site/home-return.ts). La navigation n'est PAS
            // annulée — elle part en même temps. Clic modifié (nouvel onglet,
            // nouvelle fenêtre) : rien, c'est une autre page qui s'ouvre.
            onClick={(e) => {
              if (IS_BLOG) return;
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                return;
              }
              const glyph = e.currentTarget.querySelector('svg');
              const bar = e.currentTarget.closest('nav');
              if (!glyph || !bar) return;
              beginHomeReturn(
                glyph,
                Array.from(bar.querySelectorAll<HTMLElement>('[data-nav-link]'))
              );
            }}
          >
            {/* Couleur héritée du token, pas figée : `--color-logo` vaut le
                cobalt brand, et le SVG étant inline il n'y a aucun fichier à
                échanger le jour où une surface en demanderait un autre. Il ne
                bascule plus au blanc : le mode immersif de /series (mobile) a
                été retiré le 2026-08-23 et le glyph est cobalt partout. */}
            <GlyphLogo
              size={28}
              color="var(--color-logo)"
              title={glyphLabel}
            />
          </Link>

          {/* 4 nav-links : visibles sur desktop, distribuées par space-between.
              `data-cursor-invert` déclenche le disque d'inversion (CursorInvert.tsx). */}
          {LINKS.map((link) => {
            // « All sites » : même place, mêmes classes et mêmes repères
            // qu'un lien (`data-nav-link` : `measureNavBar` compte les
            // entrées par leur rang), mais un menu, jamais actif.
            if (link.menu === 'sites') {
              return (
                <SitesMenu
                  key={link.label}
                  label={link.label}
                  href={link.href}
                  data-cursor-invert
                  data-nav-link
                  className="hidden md:inline-block text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none"
                />
              );
            }
            // « Journal » sur le blog : le même menu, ses rangées en plus, et
            // TOUJOURS surligné — on est dans le journal sur toutes ses pages.
            // Pas de morph sur le blog : padder l'actif ne décale rien.
            if (link.menu === 'journal') {
              return (
                <SitesMenu
                  key={link.label}
                  label={link.label}
                  // Le clic mène à l'accueil du journal DANS la langue de la
                  // page : la première rangée du menu (« Tous les articles »).
                  href={journalMenu?.[0]?.href ?? link.href}
                  entries={journalMenu ?? []}
                  aria-current="page"
                  data-cursor-invert
                  data-nav-link
                  style={{ padding: ACTIVE_FILL_PADDING, borderRadius: CONTROL_RADIUS }}
                  className="hidden md:inline-block text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none bg-[var(--color-active-bg)]"
                />
              );
            }
            const active = isSamePage(link.href, pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                // Cliquer le lien de la page courante doit la RAMENER À SON
                // ÉTAT D'ACCUEIL (cf. notifySamePageNav) : Next ne remonte pas
                // la page, son état interne survivrait sinon intact.
                onClick={(e) => {
                  if (active) {
                    notifySamePageNav(link.href);
                    return;
                  }
                  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                    return;
                  }
                  // Lien vers l'autre site : chargement complet, pas de sortie
                  // de page animée (elle attendrait une page qui n'arrive pas).
                  if (isExternal(link.href)) return;
                  // La page part d'un côté, la suivante entre de l'autre, dans
                  // le sens du menu (lib/site/page-transition.ts). Navigation
                  // NON annulée : elle charge pendant la sortie.
                  beginPageLeave(link.href);
                }}
                data-cursor-invert
                // Repère de `beginHomeReturn` : les libellés dont le hero de
                // la home reprend la place exacte.
                data-nav-link
                // PADDING EN STYLE INLINE, jamais en utility Tailwind : le
                // reset `* { padding: 0 }` de globals.css vit hors @layer et
                // écrase toutes les utilities de padding (cf. CLAUDE.md §7.6).
                // Un `px-2` ici serait avalé sans le moindre signal, et le
                // surlignage collerait au texte.
                style={
                  active
                    ? { padding: ACTIVE_FILL_PADDING, borderRadius: CONTROL_RADIUS }
                    : undefined
                }
                className={cn(
                  // Specs Pencil nav item : fontSize 32, fontWeight 700, letterSpacing -1.28 (= -0.04em).
                  // PAS d'uppercase (Pencil = "About", pas "ABOUT").
                  'hidden md:inline-block text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none motion-reduce:transition-none',
                  // ÉTAT ACTIF = SURLIGNAGE PLEIN, plus de soulignement
                  // (arbitrage Alexandre, 2026-08-23 — brand book §4.3).
                  // Le libellé reste noir : il est à 7,26:1 sur ce fond.
                  //
                  // ⚠️ Le padding n'est posé QUE sur l'item actif, jamais sur
                  // les cinq. La nav-bar doit rester alignée au pixel près sur
                  // l'état d'arrivée du morph du hero de la home (CLAUDE.md
                  // §3.6), et la home n'a AUCUN item actif (`/` n'est pas dans
                  // NAV_LINKS) : ne padder que l'actif laisse donc la
                  // géométrie du morph strictement inchangée. Padder les cinq
                  // élargirait la rangée de 80 px et ferait atterrir le morph
                  // à côté de sa cible.
                  active && 'bg-[var(--color-active-bg)]'
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
