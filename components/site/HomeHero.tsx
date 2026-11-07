'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type GsapDefault from 'gsap';
type Gsap = typeof GsapDefault;
import { ChevronDown } from 'lucide-react';
import { GlyphLogo } from './GlyphLogo';
import {
  SPLASH_REVEAL_EVENT,
  type SplashRevealDetail,
} from './SplashScreen';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import type { HeroImages } from '@/lib/site/hero';
import { NAV_LINKS } from '@/lib/site/nav';
import { SitesMenu } from './SitesMenu';
import { peekHomeReturn, playHomeArrival } from '@/lib/site/home-return';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils/scrollLock';
import { GLYPH_INITIAL, GLYPH_TARGET } from './home-hero/constants';
import { useMagnifier } from './home-hero/useMagnifier';
import { useScrollMorph } from './home-hero/useScrollMorph';
import { useMenuLeave } from './home-hero/useMenuLeave';


type HomeHeroProps = {
  /** Images du hero définies dans le Studio (homePage.hero), résolues en
      URLs CDN par `resolveHeroImages`. Voir lib/site/hero.ts. */
  hero: HeroImages;
};

export function HomeHero({ hero }: HomeHeroProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const logoBlockRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const navItemsRef = useRef<(HTMLElement | null)[]>([]);
  const arrowRef = useRef<HTMLButtonElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  // CSS-anchored landing glyph. Independent of the GSAP morph math so that even
  // when the morph drifts (mobile address-bar resize invalidates viewport-relative
  // measurements), the glyph the user actually sees is locked at top:18 / left: page gutter.
  const staticGlyphRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  /** Le scroll-morph une fois branché : le clic dans le menu le rejoue. */
  const morphRef = useRef<{ gsap: Gsap; tl: gsap.core.Timeline; bg: string } | null>(
    null
  );
  /** Un départ par le menu est en cours (il tient un verrou de scroll). */
  const leavingRef = useRef(false);
  const heroRefs = { sectionRef, logoBlockRef, nameRef, photoRef, navItemsRef, arrowRef, spacerRef, staticGlyphRef };

  // ─── Splash entrance gating ──────────────────────────────────────────────
  // photo / nav items / arrow start at opacity 0 (inline style in JSX). When
  // the SplashScreen dispatches SPLASH_REVEAL_EVENT, the entrance useEffect
  // below either runs the "egg-laying" choreography (skip:false) or shows
  // everything immediately (skip:true — Esc / reduced motion / safety net).
  // The scroll-morph useEffect is GATED behind `entranceDone` because its
  // `fromTo({y:0,...}, ...)` would otherwise overwrite the entrance transforms
  // at scroll progress 0. Without the splash flow this could keep elements
  // hidden, so a safety-net timeout reveals everything after 8 s.
  const [entranceDone, setEntranceDone] = useState(false);
  const entranceStartedRef = useRef(false);
  // Tracks whether the entrance currently holds a body-scroll lock so that
  // unmount mid-entrance properly releases it (otherwise the refcount would
  // never reach zero and scroll would stay locked).
  const lockHeldRef = useRef(false);

  // Static landing glyph — fade-in DÉLIBÉRÉMENT TARDIF sur les 15 % finaux de la
  // pin range. Le morphing logoBlock voyage vers (gouttière, 18) avec `power3.out` —
  // il est visuellement à 99 %+ de sa destination à 85 % du timeline. Avant ça,
  // afficher le static glyph donnerait l'impression de deux glyphs simultanés
  // (un en mouvement, un fixé). En commençant le fade-in à 85 %, le static
  // n'apparaît que quand le morph "atterrit" précisément.
  //
  // Les fractions (0.9 / 1.05) doivent rester en sync avec `pinEnd` dans le
  // useEffect GSAP ci-dessous.
  useEffect(() => {
    const glyph = staticGlyphRef.current;
    if (!glyph) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const fadeRange = isMobile ? 0.9 : 1.05;
    const staticStart = fadeRange * 0.85;
    const staticSpan = fadeRange - staticStart;
    let raf = 0;
    const update = () => {
      const scrollFrac = window.scrollY / window.innerHeight;
      const p = Math.max(
        0,
        Math.min(1, (scrollFrac - staticStart) / staticSpan)
      );
      glyph.style.opacity = String(p);
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // ARRIVÉE PAR LE LOGO — troisième entrée du hero, à côté du splash (PLAY)
  // et de l'affichage direct (SKIP). Quand le visiteur vient de cliquer le
  // glyph de la nav-bar d'une autre page, `beginHomeReturn` a laissé un témoin
  // (lib/site/home-return.ts) : le hero naît alors sur le logo et vient se
  // poser au centre. Le SplashScreen lit le même témoin et ne se monte pas.
  //
  // `useLayoutEffect` et non `useEffect` : l'état de départ doit être posé
  // AVANT le premier paint. Le bloc logo n'a pas d'`opacity: 0` initial — une
  // frame de retard le montrerait au centre, à 108 px, avant qu'il ne saute
  // dans le coin.
  //
  // Prend `entranceStartedRef` : l'entrée splash et son filet de 8 s, plus
  // bas, se taisent d'eux-mêmes. Même verrou de scroll que l'entrée splash,
  // pour la même raison — le morph n'est branché qu'à `entranceDone`.
  // ────────────────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const handoff = peekHomeReturn();
    const logoBlock = logoBlockRef.current;
    if (!handoff || !logoBlock) return;

    entranceStartedRef.current = true;
    lockBodyScroll();
    let locked = true;
    const release = () => {
      if (!locked) return;
      locked = false;
      unlockBodyScroll();
    };

    const stop = playHomeArrival(
      handoff,
      {
        logoBlock,
        name: nameRef.current,
        photo: photoRef.current,
        navItems: navItemsRef.current,
        arrow: arrowRef.current,
      },
      () => {
        release();
        setEntranceDone(true);
      }
    );

    return () => {
      stop();
      release();
      // StrictMode rejoue cet effet en dev : le second passage doit pouvoir
      // reprendre la main (le témoin n'est effacé qu'à la fin du vol).
      entranceStartedRef.current = false;
    };
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // SPLASH ENTRANCE — listens for SPLASH_REVEAL_EVENT dispatched by
  // <SplashScreen />. When the splash glyph lands at the hero glyph position,
  // runs the "egg-laying" choreography:
  //   1) Photo unfurls top → bottom (~250 ms, power3.out clip-path).
  //   2) Each nav item is "laid" by the photo — emerges from photoBottom,
  //      drops to its natural CSS position with back.out(1.8) (single subtle
  //      overshoot + settle). Staggered 120 ms per item.
  //   3) Down-arrow fades in last.
  // If the splash bypassed (Esc / reduced motion / safety net = no event in
  // 8 s), shows everything immediately and unblocks `entranceDone` so the
  // scroll-morph useEffect can bind.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: skip both the splash flow and the entrance.
      const photo = photoRef.current;
      const arrow = arrowRef.current;
      if (photo) photo.style.opacity = '1';
      if (arrow) arrow.style.opacity = '1';
      navItemsRef.current.forEach((el) => {
        if (el) el.style.opacity = '1';
      });
      setEntranceDone(true);
      return;
    }

    let cancelled = false;

    const showAllImmediately = () => {
      const photo = photoRef.current;
      const arrow = arrowRef.current;
      if (photo) photo.style.opacity = '1';
      if (arrow) arrow.style.opacity = '1';
      navItemsRef.current.forEach((el) => {
        if (el) el.style.opacity = '1';
      });
    };

    const runEntrance = () => {
      if (entranceStartedRef.current) return;
      entranceStartedRef.current = true;

      // Lock scroll for the entrance duration. Shared refcount with the
      // SplashScreen so the body stays locked across the splash → entrance
      // hand-off: splash unmount cleanup decrements but the lock survives until
      // entrance onComplete decrements it back to zero. Without this, scroll
      // would briefly unlock during the ~1 s overlap between splash unmount
      // and entrance end, letting a stray wheel/trackpad event scroll into a
      // partial scroll-morph state that snaps once ScrollTrigger binds.
      lockBodyScroll();
      lockHeldRef.current = true;

      import('gsap').then((gsapModule) => {
        if (cancelled) {
          if (lockHeldRef.current) {
            unlockBodyScroll();
            lockHeldRef.current = false;
          }
          return;
        }
        const gsap = gsapModule.default ?? gsapModule;

        const photo = photoRef.current;
        const arrow = arrowRef.current;
        const navItems = navItemsRef.current.filter(Boolean) as HTMLElement[];

        const photoRect = photo?.getBoundingClientRect();
        const photoBottomY = photoRect ? photoRect.bottom : 0;

        const tl = gsap.timeline({
          onComplete: () => {
            if (cancelled) return;
            if (lockHeldRef.current) {
              unlockBodyScroll();
              lockHeldRef.current = false;
            }
            setEntranceDone(true);
          },
        });

        // 1 — Photo unfurls top → bottom. `inset(0 0 100% 0)` = clipped 100%
        // from the bottom (only top edge visible). Animating bottom inset to
        // 0 reveals the photo top-down.
        if (photo) {
          gsap.set(photo, { opacity: 1, clipPath: 'inset(0 0 100% 0)' });
          tl.to(
            photo,
            { clipPath: 'inset(0 0 0% 0)', duration: 0.25, ease: 'power3.out' },
            0
          );
        }

        // 2 — Nav items dropped from the photo bottom, staggered. Each item's
        // start position = `y = photoBottom - itemTop` (offsets the item from
        // its natural CSS top up/down to where photoBottom lives). Then `y: 0`
        // with `back.out(1.8)` settles it into its natural spot with a single
        // subtle overshoot + bounce-back (refined, not cartoon).
        const NAV_DROP_DUR = 0.7;
        const NAV_DROP_STAGGER = 0.12;
        const NAV_DROP_START = 0.18;

        navItems.forEach((item, i) => {
          const itemRect = item.getBoundingClientRect();
          const fromY = photoBottomY - itemRect.top;
          const delay = NAV_DROP_START + i * NAV_DROP_STAGGER;
          gsap.set(item, { opacity: 0, y: fromY });
          tl.to(item, { opacity: 1, duration: 0.08 }, delay);
          tl.to(
            item,
            { y: 0, duration: NAV_DROP_DUR, ease: 'back.out(1.8)' },
            delay
          );
        });

        // 3 — Down-arrow fades in last.
        if (arrow) {
          const arrowDelay =
            NAV_DROP_START + navItems.length * NAV_DROP_STAGGER + 0.25;
          gsap.set(arrow, { opacity: 0, y: 6 });
          tl.to(
            arrow,
            { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
            arrowDelay
          );
        }
      });
    };

    const onReveal = (e: Event) => {
      const detail = (e as CustomEvent<SplashRevealDetail>).detail;
      const skip = detail?.skip === true;
      if (skip) {
        if (entranceStartedRef.current) return;
        entranceStartedRef.current = true;
        showAllImmediately();
        setEntranceDone(true);
      } else {
        runEntrance();
      }
    };
    window.addEventListener(SPLASH_REVEAL_EVENT, onReveal);

    // Safety net: if no splash event ever fires (SplashScreen failed to mount,
    // or homepage was rendered without it for some reason), reveal everything
    // after 8 s so the page never stays stuck with hidden photo / nav / arrow.
    const safety = window.setTimeout(() => {
      if (cancelled || entranceStartedRef.current) return;
      entranceStartedRef.current = true;
      showAllImmediately();
      setEntranceDone(true);
    }, 8000);

    return () => {
      cancelled = true;
      window.removeEventListener(SPLASH_REVEAL_EVENT, onReveal);
      window.clearTimeout(safety);
      // If we still hold the lock at unmount, release it so the refcount
      // doesn't stay positive forever.
      if (lockHeldRef.current) {
        unlockBodyScroll();
        lockHeldRef.current = false;
      }
    };
  }, [reducedMotion]);

  // Photo profil — magnifier hover effect.
  // Layer 1 (default, always visible)   : hero.defaultSrc  (CMS: homePage.hero.defaultImage)
  // Layer 2 (revealed under the cursor) : hero.revealSrc   (CMS: homePage.hero.revealImage)
  // Les deux images sont choisies dans le Studio (/studio → « Réglages du site »).
  // The cursor itself is hidden inside the photo box; a 96 px circular clip on
  // layer 2 follows the pointer, "peeking" through the default image.
  const { defaultSrc: profileSrcDefault, defaultAlt: profileAlt, revealSrc: profileSrcReveal } = hero;
  const photoBoxRef = useRef<HTMLDivElement>(null);
  const revealLayerRef = useRef<HTMLDivElement>(null);

  useMagnifier(photoBoxRef, revealLayerRef, reducedMotion);

  useScrollMorph(heroRefs, morphRef, reducedMotion, entranceDone);

  const leaveFromMenu = useMenuLeave(heroRefs, morphRef, leavingRef, router);

  return (
    <>
      {/*
        Static landing glyph — CSS-anchored at (page gutter, 18). The morphing logoBlock
        targets this position via GSAP transforms, but on mobile the math drifts
        when the address-bar resizes mid-scroll. This element doesn't move: pure
        CSS `fixed top: 18 / left: var(--page-gutter)`. Fade-in matches the pin range so it's at
        opacity 1 exactly when the morphing block fades to 0. Aria-hidden — the
        accessible navigation lives in <SiteHeader /> (other pages) and
        <MobileMenu /> (mobile burger drawer).
      */}
      <div
        ref={staticGlyphRef}
        aria-hidden
        className="fixed top-[18px] z-50 pointer-events-none"
        style={{ left: 'var(--page-gutter)', opacity: 0 }}
      >
        <GlyphLogo size={GLYPH_TARGET} title="A. Matencio" />
      </div>

      {/* Overlay plein-écran fixed : items centrés (flex), animés par GSAP. */}
      <div
        ref={sectionRef}
        aria-label="Home"
        className="fixed inset-0 z-30 pointer-events-none flex flex-col items-center justify-center gap-16 bg-[var(--color-bg)] px-4 py-12 md:py-16 text-center"
      >
        <div
          ref={logoBlockRef}
          // gap-6 = 24 px entre le glyph et « PHOTOGRAPHY » (demande
          // Alexandre, 2026-09-10) — seule source de cet écart, le <p> ne
          // porte plus de marge propre.
          className="pointer-events-auto flex flex-col items-center gap-6"
        >
          <GlyphLogo size={GLYPH_INITIAL} title="A. Matencio" />
          {/* Ligne statique depuis le 2026-09-10 (demande Alexandre) : le cycle
              ALXMTNC → PHOTOGRAPHY sous la lentille « Alexandre Matencio »
              (MagnifierHeading) est retiré. C'est un <p> et non un titre :
              l'unique H1 de la home est le sr-only de page.tsx —
              MagnifierHeading, lui, rendait un second <h1>. */}
          <p
            ref={nameRef}
            className="font-bold text-2xl md:text-[26px] tracking-[-0.04em] text-[var(--color-fg)] leading-none"
          >
            PHOTOGRAPHY
          </p>
        </div>

        <div
          ref={photoRef}
          // `isolation: isolate` crée un stacking context atomique : le
          // CursorInvert disque (mix-blend-mode: difference) ne peut PAS
          // pénétrer cette zone, garantissant que la photo du hero n'est
          // jamais affectée par le hover des nav-items même si le disque
          // venait à overlap géométriquement.
          //
          // `data-cursor-shield` : signale à CursorInvert.tsx de SNAP-HIDE le
          // disque (transition désactivée) quand la souris entre dans cette
          // zone. Empêche le disque de fade-out lentement par-dessus la photo
          // pendant que le magnifier-reveal de la photo s'active — pas de
          // combinaison entre les deux effets.
          data-cursor-shield
          // opacity: 0 initial — l'entrance "splash" l'unfurl top → bottom via
          // clip-path quand SPLASH_REVEAL_EVENT fire (skip:false), ou la rend
          // visible immédiatement (skip:true / reduced motion / safety net).
          // Voir le useEffect entrance plus haut.
          //
          // Format : carré jusqu'à `lg` (mobiles + petites tablettes), 3:2
          // paysage (2x3/4x6) à partir de `lg` — MÊME hauteur (h-64), on
          // n'élargit que les côtés (w-96 = 384 = 256 × 1,5). La hauteur ne
          // doit pas changer entre breakpoints de la même plage : le morph et
          // l'entrance mesurent photoBottom au mount.
          className="pointer-events-none relative size-[16.94rem] md:size-64 lg:h-64 lg:w-96 overflow-hidden bg-[var(--color-bg-elev)] isolate"
          style={{ opacity: 0 }}
        >
          {/* Inner box owns the pointer events. On touch devices we also kill native
              gestures that would interfere with the reveal: native scroll under the finger,
              long-press → context menu (Save image / Copy / Share), text selection, image drag. */}
          <div
            ref={photoBoxRef}
            className="pointer-events-auto absolute inset-0 select-none"
            style={{
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            {/* Default image — always visible. Guard: si le CMS n'a pas encore
                d'image, on laisse la box vide (bg-elev) plutôt que de crasher. */}
            {profileSrcDefault && (
              <Image
                src={profileSrcDefault}
                alt={profileAlt}
                fill
                sizes="(max-width: 768px) 16.94rem, (max-width: 1024px) 16rem, 24rem"
                className="object-cover pointer-events-none"
                draggable={false}
                priority
              />
            )}
            {/* Reveal image — clipped to a circle that follows the pointer.
                Initial clip-path collapsed to 0 px so nothing shows until pointer enters.
                Décorative → alt="" + aria-hidden. */}
            {profileSrcReveal && (
              <div
                ref={revealLayerRef}
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{ clipPath: 'circle(0px at 50% 50%)' }}
              >
                <Image
                  src={profileSrcReveal}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 16.94rem, (max-width: 1024px) 16rem, 24rem"
                  className="object-cover"
                  draggable={false}
                />
              </div>
            )}
          </div>
        </div>

        {/* Rangée horizontale depuis le 2026-09-10 (demande Alexandre ; elle
            était empilée à la verticale). Desktop seulement : sous `md` la nav
            est cachée, le burger de <MobileMenu /> prend le relais. Entrance et
            morph mesurent les rects rendus : ils suivent sans autre retouche. */}
        <nav
          aria-label="Main navigation"
          className="pointer-events-auto hidden md:flex flex-row items-center gap-10"
        >
          {NAV_LINKS.map((link, i) =>
            link.menu === 'sites' ? (
              // « All sites » : mesuré et déplacé par le morph comme un lien.
              <SitesMenu
                key={link.label}
                label={link.label}
                href={link.href}
                ref={(el) => {
                  navItemsRef.current[i] = el;
                }}
                data-cursor-invert
                data-cursor-negative
                className="text-2xl md:text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none motion-reduce:transition-none whitespace-nowrap"
                style={{ opacity: 0 }}
              />
            ) : (
            <Link
              key={link.href}
              href={link.href}
              ref={(el) => {
                navItemsRef.current[i] = el;
              }}
              data-cursor-invert
              // Lettres en négatif du fond au survol : cette nav passe au-dessus
              // de la galerie (cf. CursorInvert.tsx).
              data-cursor-negative
              // Le hero monte en nav-bar, puis la page entre par la droite
              // (cf. `leaveFromMenu`).
              onClick={(e) => leaveFromMenu(e, link.href)}
              // opacity: 0 initial — chacun est "pondu" par la photo via le
              // useEffect entrance (drop + bounce avec back.out(1.8)).
              className="text-2xl md:text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none motion-reduce:transition-none whitespace-nowrap"
              style={{ opacity: 0 }}
            >
              {link.label}
            </Link>
            )
          )}
        </nav>
      </div>

      {/* Mobile burger + drawer ont migré dans <MobileMenu /> au niveau layout. */}

      {/* Down-arrow fixed bottom — bouton cliquable qui scroll smooth vers le
          début de la gallery (`#gallery-start` sur le stage de
          ScrollPhysicsGallery). Opacity initiale 0, révélé en dernier par
          l'entrance splash ; fade out ensuite via la timeline scroll-morph. */}
      <button
        ref={arrowRef}
        type="button"
        onClick={() => {
          const target = document.getElementById('gallery-start');
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
        aria-label="Scroll to gallery"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 cursor-pointer bg-transparent border-0 p-2 -m-2"
        style={{ opacity: 0 }}
      >
        <ChevronDown
          size={26}
          strokeWidth={1.5}
          className="scroll-cue text-[var(--color-fg)]"
        />
      </button>

      {/*
        Spacer pinned. 67svh et non 100svh (2026-10-05) : un plein écran
        laissait, une fois le hero replié au centre, un viewport entier de
        blanc avant Selected Works. Le tiers retiré est couvert au repos par
        le fond du hero, qui se fond sur la course du pin.

        Le wrapper externe est un buffer React-stable : GSAP insère son
        <pin-spacer> à L'INTÉRIEUR. Au unmount, React supprime ce wrapper
        et tous ses descendants (y compris les ajouts GSAP), évitant un
        crash "removeChild: node is not a child of this node".
      */}
      <div aria-hidden>
        <div
          ref={spacerRef}
          className="h-[67svh] pointer-events-none"
        />
      </div>
    </>
  );
}
