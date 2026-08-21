'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { GlyphLogo } from './GlyphLogo';
import { MagnifierHeading } from './MagnifierHeading';
import { SPLASH_REVEAL_EVENT, type SplashRevealDetail } from './SplashScreen';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import type { HeroImages } from '@/lib/site/hero';
import { NAV_LINKS } from '@/lib/site/nav';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils/scrollLock';

/**
 * HomeHeroSplash — sandbox clone of HomeHero with an "egg-laying" entrance
 * choreography triggered by the splash screen.
 *
 * Listens for `window.dispatchEvent(new Event(SPLASH_REVEAL_EVENT))` — when
 * fired (the splash glyph has landed at the hero position), runs:
 *   1) Photo unfurls top → bottom (~250 ms, ease power3.out)
 *   2) Each nav item is "laid" by the photo — emerges from the photo bottom,
 *      drops to its natural position with `back.out(1.8)` (single subtle
 *      overshoot + settle). Staggered ~120 ms per item.
 *   3) The down-arrow fades in last.
 *
 * Until that event fires (or while body scroll is locked by the splash), the
 * photo / nav / arrow stay at opacity 0. Body scroll stays locked during the
 * entrance so the existing scroll-morph (which captures positions at mount)
 * doesn't fight the entrance transforms.
 *
 * The scroll-morph timeline is deferred until the entrance has completed,
 * because its `fromTo({x:0,y:0,scale:1}, ...)` would clobber the entrance
 * transforms if both ran in parallel.
 *
 * ROLLBACK: delete this file. The original HomeHero on `/` is untouched.
 */

// Mêmes constantes que HomeHero — voir HomeHero.tsx pour l'explication.
const GLYPH_INITIAL = 108;
const GLYPH_TARGET = 28;
const NAV_FONT_INITIAL = 32;
const NAV_FONT_TARGET = 32;
const HEADER_HEIGHT = 64;
const PAD_LEFT = 32;
const PAD_RIGHT = 64;
const FADE_FAST_DURATION = 0.15;
const MORPH_SLOW_DURATION = 1;

type HomeHeroSplashProps = {
  /** Idem HomeHero : images du hero définies dans le Studio (siteSettings.hero). */
  hero: HeroImages;
};

export function HomeHeroSplash({ hero }: HomeHeroSplashProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const logoBlockRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const navItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const arrowRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const staticGlyphRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Entrance state — gates the scroll-morph effect (which would otherwise
  // overwrite the entrance transforms with its `fromTo({y:0,...}, ...)`).
  const [entranceDone, setEntranceDone] = useState(false);
  const entranceStartedRef = useRef(false);
  const lockHeldRef = useRef(false);

  // ════════════════════════════════════════════════════════════════════════
  // Entrance choreography
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (reducedMotion) {
      // Reduced motion: skip entrance, show everything immediately.
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
    let cleanup: (() => void) | null = null;

    const runEntrance = () => {
      if (entranceStartedRef.current || cancelled) return;
      entranceStartedRef.current = true;

      // Shared refcounted lock — see lib/utils/scrollLock for why this exists
      // (splash unmount must not prematurely unlock while entrance is still
      // running). Same pattern as HomeHero on /.
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

        // Read the photo bottom in viewport coords — that's where every nav
        // item is "laid" from. We don't need to re-read it per-item: all
        // items drop from the same Y (the photo's bottom edge).
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

        // 1 — Photo unfurls top → bottom. clip-path inset(0 0 100% 0) means
        // "clip 100 % from the bottom" → only the top edge visible. Animating
        // the bottom inset to 0 reveals the photo top-down like a window blind.
        if (photo) {
          gsap.set(photo, { opacity: 1, clipPath: 'inset(0 0 100% 0)' });
          tl.to(
            photo,
            {
              clipPath: 'inset(0 0 0% 0)',
              duration: 0.25,
              ease: 'power3.out',
            },
            0
          );
        }

        // 2 — Nav items dropped one by one from the photo bottom. Each item
        // starts at `y = photoBottom - itemTop` (its CSS transform offset
        // that lifts it up to the photo bottom), then animates to `y: 0` with
        // `back.out(1.8)` — single subtle overshoot + settle. Stagger 120 ms
        // between item starts so they "egg-lay" sequentially rather than en
        // bloc.
        const NAV_DROP_DUR = 0.7;
        const NAV_DROP_STAGGER = 0.12;
        const NAV_DROP_START = 0.18; // ~70 % into the photo unfurl

        navItems.forEach((item, i) => {
          // Capture the item's natural (final) position before applying any
          // transform. With opacity:0, this rect is still valid (opacity
          // doesn't affect layout).
          const itemRect = item.getBoundingClientRect();
          const fromY = photoBottomY - itemRect.top;
          // If fromY is positive (photo bottom is below item natural top), the
          // item is "already above" — push it down to start. If negative
          // (item natural top is below photo bottom), push it up.
          // For the typical home layout the items sit BELOW the photo, so
          // fromY is negative and we pull them UP to start.

          const delay = NAV_DROP_START + i * NAV_DROP_STAGGER;

          // Two parallel tweens per item: opacity snaps in (40 ms) so the
          // item doesn't pop in mid-air, and y animates with back.out for
          // the drop+settle.
          gsap.set(item, { opacity: 0, y: fromY });
          tl.to(item, { opacity: 1, duration: 0.08 }, delay);
          tl.to(
            item,
            {
              y: 0,
              duration: NAV_DROP_DUR,
              ease: 'back.out(1.8)',
            },
            delay
          );
        });

        // 3 — Down-arrow fades in last, ~250 ms after the last nav item is
        // mostly settled.
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

    const showAllImmediately = () => {
      const photo = photoRef.current;
      const arrow = arrowRef.current;
      if (photo) photo.style.opacity = '1';
      if (arrow) arrow.style.opacity = '1';
      navItemsRef.current.forEach((el) => {
        if (el) el.style.opacity = '1';
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

    cleanup = () => {
      window.removeEventListener(SPLASH_REVEAL_EVENT, onReveal);
      if (lockHeldRef.current) {
        unlockBodyScroll();
        lockHeldRef.current = false;
      }
    };

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion]);

  // ════════════════════════════════════════════════════════════════════════
  // Static landing glyph fade (identical to HomeHero) — opacity is driven by
  // scroll-frac, no entrance gating needed (stays at 0 while page unscrolled).
  // ════════════════════════════════════════════════════════════════════════
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

  // ════════════════════════════════════════════════════════════════════════
  // Magnifier reveal on the profile photo (identical to HomeHero).
  // ════════════════════════════════════════════════════════════════════════
  // Images choisies dans le Studio (/studio → « Réglages du site »), comme HomeHero.
  const { defaultSrc: profileSrcDefault, defaultAlt: profileAlt, revealSrc: profileSrcReveal } = hero;
  const photoBoxRef = useRef<HTMLDivElement>(null);
  const revealLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reducedMotion) return;
    const box = photoBoxRef.current;
    const reveal = revealLayerRef.current;
    if (!box || !reveal) return;

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

  // ════════════════════════════════════════════════════════════════════════
  // Scroll-morph timeline (identical to HomeHero) — GATED by `entranceDone`
  // so it doesn't fight the entrance transforms at progress=0.
  // ════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (reducedMotion) return;
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

        const ease = 'power3.out';

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
        const logoVisibleWidth = GLYPH_TARGET;
        const navTargetWidths = navInit.map((init) =>
          init ? init.width * navTargetScale : 0
        );

        const totalContentWidth =
          logoVisibleWidth + navTargetWidths.reduce((a, b) => a + b, 0);
        const availableWidth = window.innerWidth - PAD_LEFT - PAD_RIGHT;
        const itemGap = (availableWidth - totalContentWidth) / NAV_LINKS.length;

        const logoTargetTop = (HEADER_HEIGHT - GLYPH_TARGET) / 2;
        const glyphOffsetInBlock = (logoInit.width - GLYPH_INITIAL) / 2;
        const logoDx =
          PAD_LEFT - glyphOffsetInBlock * logoTargetScale - logoInit.left;
        const logoDy = logoTargetTop - logoInit.top;
        void logoDx;
        void logoDy;

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

        tl.to(
          arrowRef.current,
          { opacity: 0, y: 10, ease: 'power2.out', duration: FADE_FAST_DURATION },
          0
        );
        tl.to(
          photoRef.current,
          { opacity: 0, scale: 0.5, ease: 'power2.in', duration: FADE_FAST_DURATION },
          0
        );
        tl.to(
          nameRef.current,
          { opacity: 0, ease: 'power2.in', duration: FADE_FAST_DURATION },
          0
        );

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

        tl.to(
          logoBlockRef.current,
          { opacity: 0, ease: 'power2.in', duration: 0.3 },
          0.7
        );

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

        cleanup = () => {
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
      <div
        ref={staticGlyphRef}
        aria-hidden
        className="fixed top-[18px] left-[32px] z-50 pointer-events-none"
        style={{ opacity: 0 }}
      >
        <GlyphLogo size={GLYPH_TARGET} title="A. Matencio" />
      </div>

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
          data-cursor-shield
          // opacity: 0 initial — entrance unfurls via clipPath, opacity is set to 1 by gsap.
          // Format : carré jusqu'à `lg`, 3:2 paysage (2x3/4x6) à partir de `lg`
          // — même hauteur, élargi sur les côtés. Voir HomeHero.tsx.
          className="pointer-events-none relative size-56 md:size-64 lg:h-64 lg:w-96 overflow-hidden bg-[var(--color-bg-elev)] isolate"
          style={{ opacity: 0 }}
        >
          <div
            ref={photoBoxRef}
            className="pointer-events-auto absolute inset-0 select-none"
            style={{
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
            }}
          >
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
              // opacity: 0 initial — entrance "lays" the items one by one.
              className="text-2xl md:text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none motion-reduce:transition-none whitespace-nowrap"
              style={{ opacity: 0 }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div
        ref={arrowRef}
        aria-hidden
        className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
        style={{ opacity: 0 }}
      >
        <ChevronDown
          size={26}
          strokeWidth={1.5}
          className="scroll-cue text-[var(--color-fg)]"
        />
      </div>

      <div aria-hidden>
        <div
          ref={spacerRef}
          className="h-[100svh] pointer-events-none"
        />
      </div>
    </>
  );
}
