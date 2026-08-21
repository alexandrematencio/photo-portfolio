'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GlyphLogo } from './GlyphLogo';
import { MagnifierHeading } from './MagnifierHeading';
import {
  SPLASH_REVEAL_EVENT,
  type SplashRevealDetail,
} from './SplashScreen';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import type { HeroImages } from '@/lib/site/hero';
import { NAV_LINKS } from '@/lib/site/nav';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils/scrollLock';

// Cibles de la transition (≈ taille finale du header)
const GLYPH_INITIAL = 108;
const GLYPH_TARGET = 28;
const NAV_FONT_INITIAL = 32;
// 32 = pas de shrink, les nav-items gardent leur taille initiale (32px)
// en mode nav-bar fixed top. Seule la position morphe (vertical → horizontal).
const NAV_FONT_TARGET = 32;
const HEADER_HEIGHT = 64; // h-16 — identique sur toutes les pages (SiteHeader)
// Nav-bar final = pleine largeur, items space-between
const PAD_LEFT = 32;
const PAD_RIGHT = 64;

// Timing du morph dans la timeline (en "unités" timeline, 1 = full)
// La durée totale en SECONDES est gérée par le `scrub` du ScrollTrigger.
const FADE_FAST_DURATION = 0.15; // photo-profile, arrow, nom : vanish vite
const MORPH_SLOW_DURATION = 1; // logo + nav items : morph lent, prend toute la timeline

type HomeHeroProps = {
  /** Images du hero définies dans le Studio (siteSettings.hero), résolues en
      URLs CDN par `resolveHeroImages`. Voir lib/site/hero.ts. */
  hero: HeroImages;
};

export function HomeHero({ hero }: HomeHeroProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const logoBlockRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const navItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const arrowRef = useRef<HTMLButtonElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  // CSS-anchored landing glyph. Independent of the GSAP morph math so that even
  // when the morph drifts (mobile address-bar resize invalidates viewport-relative
  // measurements), the glyph the user actually sees is locked at top:18 / left:32.
  const staticGlyphRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

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
  // pin range. Le morphing logoBlock voyage vers (32, 18) avec `power3.out` —
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
        const navItems = navItemsRef.current.filter(Boolean) as HTMLAnchorElement[];

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
  // Layer 1 (default, always visible)   : hero.defaultSrc  (CMS: siteSettings.hero.defaultImage)
  // Layer 2 (revealed under the cursor) : hero.revealSrc   (CMS: siteSettings.hero.revealImage)
  // Les deux images sont choisies dans le Studio (/studio → « Réglages du site »).
  // The cursor itself is hidden inside the photo box; a 96 px circular clip on
  // layer 2 follows the pointer, "peeking" through the default image.
  const { defaultSrc: profileSrcDefault, defaultAlt: profileAlt, revealSrc: profileSrcReveal } = hero;
  const photoBoxRef = useRef<HTMLDivElement>(null);
  const revealLayerRef = useRef<HTMLDivElement>(null);

  // Bind the magnifier reveal — purely DOM mutation (no React re-render) for 60 fps.
  // Respects prefers-reduced-motion: in that case, the reveal layer stays hidden.
  useEffect(() => {
    if (reducedMotion) return;
    const box = photoBoxRef.current;
    const reveal = revealLayerRef.current;
    if (!box || !reveal) return;

    // Desktop: 74 px radius (~148 px diameter, = mobile / 1.3).
    // Mobile: 96 px radius — finger-driven engagement needs more reveal area.
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const RADIUS = isMobile ? 96 : 74;
    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;

    const apply = () => {
      reveal.style.clipPath = `circle(${RADIUS}px at ${pendingX}px ${pendingY}px)`;
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onEnter = (e: PointerEvent) => {
      // Mouse: hide the cursor (the revealed disc takes over).
      // Touch/pen: nothing to hide — the finger is the cursor.
      if (e.pointerType === 'mouse') box.style.cursor = 'none';
      onMove(e);
    };

    const onLeave = () => {
      box.style.cursor = '';
      reveal.style.clipPath = 'circle(0px at 50% 50%)';
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    // iOS long-press → context menu (Save image, Copy, Share). Kill it on this box.
    const onContextMenu = (e: Event) => e.preventDefault();

    box.addEventListener('pointerenter', onEnter);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerleave', onLeave);
    box.addEventListener('pointercancel', onLeave);
    box.addEventListener('contextmenu', onContextMenu);

    return () => {
      box.removeEventListener('pointerenter', onEnter);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('pointercancel', onLeave);
      box.removeEventListener('contextmenu', onContextMenu);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    // GATED behind the entrance: this scroll-morph timeline does
    // `fromTo({x:0,y:0,scale:1}, ...)` on the nav items with ScrollTrigger
    // scrub, which would forcibly set those properties to 0 at scroll-progress
    // 0 and clobber the entrance transforms. Wait until entrance is settled.
    if (!entranceDone) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([gsapModule, stModule]) => {
        if (cancelled) return;
        const gsap = gsapModule.default ?? gsapModule;
        const ScrollTrigger =
          (stModule as { ScrollTrigger?: typeof import('gsap/ScrollTrigger').ScrollTrigger }).ScrollTrigger ??
          stModule.default;
        gsap.registerPlugin(ScrollTrigger);

        const ease = 'power3.out'; // cubic-bezier natural ease-out

        // Capture des rects initiales (sans transform), centrées dans le hero
        const capture = (el: HTMLElement) => {
          const t = el.style.transform;
          el.style.transform = '';
          const rect = el.getBoundingClientRect();
          el.style.transform = t;
          return rect;
        };

        const logoInit = capture(logoBlockRef.current!);
        const navInit = navItemsRef.current.map((el) => (el ? capture(el) : null));

        const logoTargetScale = GLYPH_TARGET / GLYPH_INITIAL;
        const navTargetScale = NAV_FONT_TARGET / NAV_FONT_INITIAL;

        // Pour les calculs de spacing horizontal, on utilise la largeur VISIBLE
        // du logo (le glyph seul = GLYPH_TARGET 28px) — PAS la largeur du bloc
        // entier qui inclut le MagnifierHeading invisible (~330px). Sinon
        // l'espacement diffère du SiteHeader des autres pages qui n'a que le glyph.
        const logoVisibleWidth = GLYPH_TARGET;
        const navTargetWidths = navInit.map((init) =>
          init ? init.width * navTargetScale : 0
        );

        const totalContentWidth =
          logoVisibleWidth + navTargetWidths.reduce((a, b) => a + b, 0);
        const availableWidth = window.innerWidth - PAD_LEFT - PAD_RIGHT;
        const itemGap = (availableWidth - totalContentWidth) / NAV_LINKS.length;

        const logoTargetTop = (HEADER_HEIGHT - GLYPH_TARGET) / 2;
        // Le block logo contient glyph + MagnifierHeading. Le MagnifierHeading
        // a un spacer invisible plus large que le glyph → le glyph est centré
        // dans un bloc plus large. Compensation pour que le GLYPH (pas le block)
        // atterrisse à PAD_LEFT exactement.
        const glyphOffsetInBlock = (logoInit.width - GLYPH_INITIAL) / 2;
        const logoDx =
          PAD_LEFT - glyphOffsetInBlock * logoTargetScale - logoInit.left;
        const logoDy = logoTargetTop - logoInit.top;

        const targetLeftFor = (i: number) => {
          let cursor = PAD_LEFT + logoVisibleWidth + itemGap;
          for (let j = 0; j < i; j++) {
            cursor += navTargetWidths[j] + itemGap;
          }
          return cursor;
        };
        const targetCenterXFor = (i: number) =>
          targetLeftFor(i) + navTargetWidths[i] / 2;
        const navTargetY = HEADER_HEIGHT / 2;

        // Timeline unique pinnée au spacer.
        // - pin: true → la page est "trappée" pendant N vh de scroll
        // - scrub : lag entre scroll et progression de l'animation (= feel "slow/luxe")
        // - Pendant le pin, la gallery ne peut pas entrer dans le viewport.
        //
        // Pin range mobile 90vh / desktop 105vh : sur mobile, un swipe pouce
        // couvre ~200-400px ; à 30vh (~230px) le morph se jouait en UN swipe et
        // paraissait instantané. À 90vh (~690px) il faut ~3 swipes — feel
        // délibéré et immersif, l'utilisateur "tire" la page pour révéler la galerie.
        // Le static glyph fade-in (autre useEffect) utilise les mêmes fractions
        // (0.9 / 1.05) pour que le crossfade reste calé au pin end.
        //
        // Note mobile : sur iOS/Android le viewport se redimensionne au scroll
        // (collapse address-bar) et `logoInit.top` capturé au mount devient périmé.
        // Le static glyph CSS-ancré à top:18 prend le relais via crossfade — donc
        // même si la math GSAP dérive vers la fin du morph, la position finale
        // visible reste solide. C'est ce qui nous permet de pousser le pin range
        // mobile aussi loin sans craindre le drift.
        const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
        const pinEnd = isMobileViewport ? '+=90vh' : '+=105vh';

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: spacerRef.current,
            start: 'top top',
            pin: true,
            pinSpacing: true,
            scrub: isMobileViewport ? 1 : 2,
            end: pinEnd,
            invalidateOnRefresh: true,
          },
        });

        // Fades RAPIDES (photo-profile + nom + down-arrow vanishent ensemble, vite).
        //
        // ⚠️ `autoAlpha` et JAMAIS `opacity` : le hero est un overlay
        // `fixed inset-0` qui ne part JAMAIS (il est seulement rendu
        // transparent). Or `opacity: 0` ne retire pas un élément du hit-test —
        // ces éléments restaient donc cliquables, invisibles, par-dessus la
        // galerie tout le reste de la page. Bugs réels payés : la boîte de la
        // photo de profil (192 × 128 px mesurés au centre exact du viewport)
        // volait le curseur — son `pointerenter` pose `cursor: none` pour
        // l'effet loupe, sans rien afficher en échange — avalait les clics sur
        // les photos de la curation, et son `touch-action: none` empêchait le
        // défilement au doigt commencé en plein centre de l'écran ; la flèche
        // du bas restait un bouton cliquable qui renvoyait au début de la
        // galerie. `autoAlpha` pose `visibility: hidden` à l'opacité 0 exacte
        // (et la retire dès qu'elle repasse au-dessus, en remontant) : les
        // éléments deviennent inertes précisément quand ils deviennent
        // invisibles.
        tl.to(
          arrowRef.current,
          { autoAlpha: 0, y: 10, ease: 'power2.out', duration: FADE_FAST_DURATION },
          0
        );
        tl.to(
          photoRef.current,
          { autoAlpha: 0, scale: 0.5, ease: 'power2.in', duration: FADE_FAST_DURATION },
          0
        );
        tl.to(
          nameRef.current,
          { autoAlpha: 0, ease: 'power2.in', duration: FADE_FAST_DURATION },
          0
        );

        // Morph LENT : logo (vers top-left) + nav-items (vers full-width space-between).
        // Durée 1 = toute la timeline. Couplé au scrub, le déploiement est plus lent que les fades.
        //
        // x / y en function getters : avec `invalidateOnRefresh: true`, GSAP appelle ces
        // fonctions à chaque refresh (resize, viewport change, mobile address-bar collapse).
        // Sans ça, `logoInit.top` capturé au mount devient périmé et le glyph atterrit ailleurs
        // que top:18px sur mobile.
        const getLogoDx = () => {
          const init = capture(logoBlockRef.current!);
          const glyphOffset = (init.width - GLYPH_INITIAL) / 2;
          return PAD_LEFT - glyphOffset * logoTargetScale - init.left;
        };
        const getLogoDy = () => {
          const init = capture(logoBlockRef.current!);
          const targetTop = (HEADER_HEIGHT - GLYPH_TARGET) / 2;
          return targetTop - init.top;
        };

        tl.fromTo(
          logoBlockRef.current,
          { x: 0, y: 0, scale: 1, transformOrigin: '0 0' },
          {
            x: getLogoDx,
            y: getLogoDy,
            scale: logoTargetScale,
            transformOrigin: '0 0',
            ease,
            duration: MORPH_SLOW_DURATION,
          },
          0
        );

        // Fade out the morphing block before it "lands". On mobile, the GSAP
        // landing position is unreliable (viewport mutates during scroll, refresh
        // events lag), so we make sure the morphing element is invisible by the
        // time it'd hit its drifted target. The static glyph (CSS-anchored) takes
        // over as the visible element at top:18/left:32.
        // autoAlpha, même raison que les fades ci-dessus : ce bloc est
        // `pointer-events-auto` et resterait un obstacle invisible en haut au
        // centre de l'écran une fois fondu.
        tl.to(
          logoBlockRef.current,
          { autoAlpha: 0, ease: 'power2.in', duration: 0.3 },
          0.7
        );

        // En mobile, la nav stack est cachée (display:none → offsetWidth = 0) :
        // on skip la morph des items pour éviter des calculs sur des éléments invisibles.
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (!isMobile) {
          navItemsRef.current.forEach((item, i) => {
            if (!item) return;
            const init = navInit[i];
            if (!init) return;
            const dx = targetCenterXFor(i) - (init.left + init.width / 2);
            const dy = navTargetY - (init.top + init.height / 2);

            tl.fromTo(
              item,
              { x: 0, y: 0, scale: 1, transformOrigin: '50% 50%' },
              {
                x: dx,
                y: dy,
                scale: navTargetScale,
                transformOrigin: '50% 50%',
                ease,
                duration: MORPH_SLOW_DURATION,
              },
              0
            );
          });
        }

        // Late-binding hygiene: this morph only binds AFTER the splash entrance
        // (~5 s on a cold load), by which point fonts and the first gallery
        // images have likely shifted the layout since the trigger geometry was
        // first measured. Recompute now so start/end and progress are read from
        // the settled layout against the current (top, on the splash-play path)
        // scroll position.
        ScrollTrigger.refresh();

        cleanup = () => {
          // On ne tue QUE notre timeline + son scrollTrigger.
          // `kill(true)` = revert : enlève le wrapper <pin-spacer> que GSAP a inséré
          // autour du spacer et restaure le DOM original. Sans le `true`, React
          // crashe au unmount avec "removeChild: node is not a child of this node"
          // parce qu'il essaie de retirer le spacer dont GSAP a changé le parent.
          tl.scrollTrigger?.kill(true);
          tl.kill();
        };
      }
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion, entranceDone]);

  return (
    <>
      {/*
        Static landing glyph — CSS-anchored at (32, 18). The morphing logoBlock
        targets this position via GSAP transforms, but on mobile the math drifts
        when the address-bar resizes mid-scroll. This element doesn't move: pure
        CSS `fixed top: 18 / left: 32`. Fade-in matches the pin range so it's at
        opacity 1 exactly when the morphing block fades to 0. Aria-hidden — the
        accessible navigation lives in <SiteHeader /> (other pages) and
        <MobileMenu /> (mobile burger drawer).
      */}
      <div
        ref={staticGlyphRef}
        aria-hidden
        className="fixed top-[18px] left-[32px] z-50 pointer-events-none"
        style={{ opacity: 0 }}
      >
        <GlyphLogo size={GLYPH_TARGET} title="A. Matencio" />
      </div>

      {/* Overlay plein-écran fixed : items centrés (flex), animés par GSAP. */}
      <div
        ref={sectionRef}
        aria-label="Home"
        className="fixed inset-0 z-30 pointer-events-none flex flex-col items-center justify-center gap-16 px-4 py-12 md:py-16 text-center"
      >
        <div
          ref={logoBlockRef}
          className="pointer-events-auto flex flex-col items-center gap-3"
        >
          <GlyphLogo size={GLYPH_INITIAL} title="A. Matencio" />
          <MagnifierHeading
            ref={nameRef}
            shorts={['ALXMTNC', 'PHOTOGRAPHY']}
            long="Alexandre Matencio"
            className="font-bold text-2xl md:text-[26px] tracking-[-0.04em] text-[var(--color-fg)] mt-1"
            longClassName="font-bold text-[36px] md:text-[40px] tracking-[-0.04em] text-[var(--color-fg)]"
          />
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
          className="pointer-events-none relative size-56 md:size-64 lg:h-64 lg:w-96 overflow-hidden bg-[var(--color-bg-elev)] isolate"
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
                sizes="(max-width: 768px) 14rem, (max-width: 1024px) 16rem, 24rem"
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
                  sizes="(max-width: 768px) 14rem, (max-width: 1024px) 16rem, 24rem"
                  className="object-cover"
                  draggable={false}
                />
              </div>
            )}
          </div>
        </div>

        <nav
          aria-label="Main navigation"
          className="pointer-events-auto hidden md:flex flex-col items-center gap-2 md:gap-3"
        >
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              ref={(el) => {
                navItemsRef.current[i] = el;
              }}
              data-cursor-invert
              // opacity: 0 initial — chacun est "pondu" par la photo via le
              // useEffect entrance (drop + bounce avec back.out(1.8)).
              className="text-2xl md:text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none motion-reduce:transition-none whitespace-nowrap"
              style={{ opacity: 0 }}
            >
              {link.label}
            </Link>
          ))}
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
        Spacer pinned : pendant 70vh de scroll, la page est "trappée" et la
        timeline GSAP joue. Photos de la gallery ne peuvent pas entrer dans
        le viewport tant que le pin n'est pas relâché → zéro overlap garanti.

        Le wrapper externe est un buffer React-stable : GSAP insère son
        <pin-spacer> à L'INTÉRIEUR. Au unmount, React supprime ce wrapper
        et tous ses descendants (y compris les ajouts GSAP), évitant un
        crash "removeChild: node is not a child of this node".
      */}
      <div aria-hidden>
        <div
          ref={spacerRef}
          className="h-[100svh] pointer-events-none"
        />
      </div>
    </>
  );
}
