'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { asset } from '@/lib/utils/asset';
import { cn } from '@/lib/utils/cn';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils/scrollLock';
import { hasSeenSplash, markSplashSeen } from '@/lib/site/splash-session';
import { peekHomeReturn } from '@/lib/site/home-return';
import { createSplashScrub } from './splash/scrub';
import { SplashGlyph } from './splash/SplashGlyph';
import { buildSplashTimeline } from './splash/timeline';
import {
  SPLASH_PHOTOS,
  SPLASH_REVEAL_EVENT,
  type SplashRevealDetail,
} from './splash/constants';

// HomeHero importe l'événement d'ici : on le garde au même endroit.
export { SPLASH_REVEAL_EVENT, type SplashRevealDetail };

/**
 * SplashScreen — entrance animation of the home (`/`).
 *
 * Inspired by codepen.io/osmosupply/pen/wBGYEMd (Willem) — letters on either
 * side of a "letter-substitute" slot in which photos cycle, then a final
 * element (here: the ALXMTNC glyph) appears and travels to its place in the
 * hero banner.
 *
 * Mounted by `app/(site)/page.tsx` only (the /splash-test sandbox it was
 * prototyped on was removed on 2026-11-04, audit 1.4).
 *
 * Honors `prefers-reduced-motion` (skips straight to onComplete). Escape skips.
 * A scroll gesture hands the playhead over to the user — see MANUAL SCRUB.
 *
 * Fichiers (`./splash/`) : `constants` (photos, réglages du scrub, événement
 * de reveal), `measure` (mesures typographiques), `SplashGlyph`, `scrub`
 * (contrôleur du geste) et `timeline` (construction de la chorégraphie). L'effet
 * ci-dessous garde la gate, le verrou de restauration du scroll et le cycle de vie.
 */


type Props = {
  /** Fires when the splash finishes (or is skipped) and starts to unmount. */
  onComplete?: () => void;
  /**
   * Opt-in: on mobile (< md), stack ALX / slot / MTNC vertically and bump the
   * letter font-size. Desktop layout unchanged. Used by the home.
   */
  verticalMobile?: boolean;
};

export function SplashScreen({ onComplete, verticalMobile = false }: Props) {
  // Retour par le logo (lib/site/home-return.ts) : le splash ne se monte PAS.
  // Sa gate le ferait sauter de toute façon, mais dans un effet — donc après
  // un premier rendu où l'overlay opaque z-9999 couvre l'écran une frame. En
  // pleine transition, c'est un flash blanc au milieu du mouvement. Au
  // chargement d'une page il n'y a jamais de témoin : serveur et client
  // rendent `true` tous les deux, l'hydratation n'en sait rien.
  const [mounted, setMounted] = useState(() => !peekHomeReturn());
  const overlayRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const photoRefs = useRef<(HTMLDivElement | null)[]>([]);
  const glyphRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // Guarantees SPLASH_REVEAL_EVENT fires AT MOST ONCE per mount — Esc pressed
  // after the glyph has already landed, for instance, must not re-dispatch.
  const revealedRef = useRef(false);

  const dispatchReveal = (skip: boolean) => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    if (typeof window !== 'undefined') {
      markSplashSeen();
      window.dispatchEvent(
        new CustomEvent<SplashRevealDetail>(SPLASH_REVEAL_EVENT, {
          detail: { skip },
        })
      );
    }
  };

  // Lock body scroll while the splash plays — the underlying HomeHero binds a
  // ScrollTrigger that we don't want firing mid-splash. Uses the shared
  // refcounted lock so the HomeHero entrance (which also locks) can keep the
  // body locked after the splash unmounts, until the entrance itself completes.
  useEffect(() => {
    if (!mounted) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [mounted]);

  // Skip on Escape — convenient when iterating. Bypass = treat as "skip" so
  // the hero immediately shows everything instead of running the slow entrance.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatchReveal(true);
        onComplete?.();
        setMounted(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, onComplete]);

  useEffect(() => {
    if (!mounted) return;

    // ────────────────────────────────────────────────────────────────────
    // Activation gate — decide whether this mount should actually play.
    //
    // Spec (2026-10-01 : au plus une fois toutes les 12 h) :
    //   • 1ʳᵉ arrivée sur / depuis 12 h                → PLAY
    //   • clé `splashSeen` posée (lib/site/splash-session.ts) — splash
    //     déjà vu OU visiteur déjà passé par une autre page ; reload
    //     compris, même au hero                        → SKIP
    //   • back / forward navigation                    → SKIP
    //   • reload IN GALLERY (scrollY > 0)              → SKIP
    //   Rejouer l'intro : supprimer `splashSeen` (DevTools → Application →
    //   Local Storage), puis recharger EN HAUT de la page.
    //
    // Skip path : dispatchReveal(true) so HomeHero shows everything in its
    // scroll-aware morphed state, no entrance animation, no hero overlay
    // flashing over the gallery for a second.
    // ────────────────────────────────────────────────────────────────────
    let shouldSkip = false;
    if (typeof window !== 'undefined') {
      const navEntries = performance.getEntriesByType('navigation');
      const navType = (navEntries[0] as PerformanceNavigationTiming | undefined)
        ?.type;
      // <SiteSessionMarker /> (in the (site) layout) sets the same key AT
      // RENDER TIME on the first pathname change in this tab. By the time
      // our own useEffect runs, the layout has already committed its render
      // — so for a /contact → / Link nav, the flag is in localStorage
      // BEFORE we read it here, and the splash correctly skips.
      // The render-time approach is what makes this race-free; an earlier
      // useEffect-based attempt suffered from React's depth-first effect
      // order (SplashScreen, deeper, would read before the marker, shallower,
      // set).
      const splashSeen = hasSeenSplash();
      // 4 px tolerance — browsers sometimes restore scroll a couple px off 0.
      const atHero = window.scrollY <= 4;

      if (splashSeen || navType === 'back_forward') {
        shouldSkip = true;
      } else if (navType === 'reload') {
        // Unseen splash on a reload: only when the tab is scrolled into the
        // gallery (never saw the hero reveal) do we keep the reader's place.
        shouldSkip = !atHero;
      }
      // else 'navigate', first home load of the session → PLAY
    }

    if (shouldSkip || reduced) {
      // Reduced motion OR contextual skip: bypass the whole splash. Defer
      // the event by one macrotask so HomeHero's listener (added in its own
      // useEffect on the same render commit) is bound before we dispatch.
      // Without this, the event would fire before the listener exists and
      // HomeHero would wait for the 8 s safety net to reveal itself.
      if (typeof window !== 'undefined') {
        window.setTimeout(() => dispatchReveal(true), 0);
      }
      onComplete?.();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- la gate lit localStorage et performance, illisibles au rendu sans écart d'hydratation
      setMounted(false);
      return;
    }

    // ────────────────────────────────────────────────────────────────────
    // We've decided to PLAY the full intro. By definition the user is at the
    // top of the hero. Two things to nail down before the splash runs:
    //
    //   1. window.scrollTo(0, 0) — start the intro from the very top.
    //   2. history.scrollRestoration = 'manual' — stop the browser from
    //      applying its ASYNCHRONOUS scroll restoration.
    //
    // Why (2) matters — the production bug it fixes: on a slow cold load the
    // gate above reads scrollY ≈ 0 (the document is still too short to restore
    // into, because the gallery images haven't loaded yet) → we PLAY. A second
    // or two later the gallery images arrive, the document grows to full height,
    // and the browser applies the *deferred* restored scroll (~1 viewport down).
    // The HomeHero scroll-morph (scrub) and the static-glyph fader both read
    // window.scrollY, so they react to that phantom scroll and collapse the hero
    // into the nav-bar on its own — exactly the "hero disappears 1-2 s after the
    // reveal" symptom. Disabling restoration here removes the trigger. The body
    // stays locked through the entrance, so even a late restoration attempt is
    // clamped to 0 until we hand off.
    //
    // Scoped to the PLAY path only: reload-in-gallery / back-forward SKIP the
    // splash (above) and never reach this code, so their native scroll
    // restoration is untouched. We capture the previous value and restore it on
    // unmount (cleanup) so a later reload still behaves normally.
    // ────────────────────────────────────────────────────────────────────
    let prevScrollRestoration: ScrollRestoration | null = null;
    if (typeof window !== 'undefined') {
      try {
        prevScrollRestoration = history.scrollRestoration;
        history.scrollRestoration = 'manual';
      } catch {
        prevScrollRestoration = null;
      }
      window.scrollTo(0, 0);
    }

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    // MANUAL SCRUB — contrat complet en tête de `./splash/scrub.ts`. Les
    // écouteurs de geste se branchent ici, avant le préchargement, pour
    // qu'un geste arrivé avant la timeline soit mis en réserve.
    const { attachScrub, dispose: disposeScrub } = createSplashScrub({
      speedRef,
      revealedRef,
      dispatchReveal,
    });

    // Preload all splash images so the cycle is smooth on first paint. Raw
    // JPEGs in /public/ can be 3-13 MB each (test-grade source files); without
    // preload the wipe-in reveals would render half-blank frames.
    const preload = Promise.all(
      SPLASH_PHOTOS.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.src = asset(src);
            img.onload = () => resolve();
            img.onerror = () => resolve();
          })
      )
    );

    // Wait for the real font (Inter via next/font) to be loaded BEFORE measuring
    // cap-height, otherwise the canvas would scan fallback-font glyphs whose
    // metrics differ from what's actually painted on screen.
    const fontsReady =
      typeof document !== 'undefined' && document.fonts?.ready
        ? document.fonts.ready
        : Promise.resolve();

    Promise.all([import('gsap'), preload, fontsReady]).then(([gsapModule]) => {
      if (cancelled) return;
      const gsap = gsapModule.default ?? gsapModule;

      const overlay = overlayRef.current;
      const left = leftRef.current;
      const right = rightRef.current;
      const slot = slotRef.current;
      const glyphWrap = glyphRef.current;
      const photos = photoRefs.current.filter(Boolean) as HTMLDivElement[];
      if (!overlay || !left || !right || !slot || !glyphWrap || photos.length !== 3) {
        return;
      }

      // Single exit door, shared by the automatic playhead and the manual
      // scrub (which seeks with `.time()` and therefore never triggers the
      // timeline's own onComplete). Idempotent — both can reach it.
      let finished = false;
      const finish = () => {
        if (cancelled || finished) return;
        finished = true;
        onComplete?.();
        setMounted(false);
      };

      const { tl, revealAt } = buildSplashTimeline({
        gsap,
        overlay,
        left,
        right,
        slot,
        glyphWrap,
        photos,
        verticalMobile,
        finish,
        dispatchReveal,
      });

      attachScrub(tl, finish, revealAt);

      cleanup = () => {
        tl.kill();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
      disposeScrub();
      // Restore the browser's native scroll restoration so subsequent reloads
      // (which SKIP the splash) keep their position as before.
      if (prevScrollRestoration !== null) {
        try {
          history.scrollRestoration = prevScrollRestoration;
        } catch {
          // ignore — leaving it 'manual' is a benign fallback
        }
      }
    };
  }, [mounted, reduced, onComplete, verticalMobile]);

  if (!mounted) return null;

  return (
    <div
      ref={overlayRef}
      aria-hidden
      // z-[9999] sits above SiteHeader (z-50), HomeHero overlay (z-30) and
      // CursorInvert. pointer-events: none lets the underlying page stay
      // interactive in case anything wants focus during the splash (we still
      // lock scroll via body.style.overflow).
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[var(--color-bg)] overflow-hidden pointer-events-none"
    >
      <div
        className={cn(
          // gap-2 (8 px) : petit espace de respiration symétrique entre ALX,
          // le slot, et MTNC. L'effet Willem reste lisible (les lettres sont
          // quasi-collées au start, slot à width 0, juste 16 px d'écart total
          // entre ALX et MTNC) tout en laissant un gap visible à la fin de
          // l'expansion. gap-0 faisait littéralement toucher les glyphs aux
          // bords du slot, ce qui paraissait trop tight visuellement.
          // `relative` : positioning context for the speed readout below.
          'relative flex items-center gap-2 leading-none',
          // verticalMobile: stack ALX / slot / MTNC vertically on < md. The
          // column shrinks to its widest child (MTNC), `items-start` aligns
          // ALX and the slot on that left edge. The OUTER overlay's
          // `items-center justify-center` then centers the whole column both
          // horizontally and vertically in the viewport.
          verticalMobile && 'max-md:flex-col max-md:items-start'
        )}
      >
        <span
          ref={leftRef}
          className={cn(
            'font-bold tracking-[-0.04em] text-[var(--color-fg)] select-none',
            // Default + desktop: same range as before (clamp 48-160 px).
            'text-[clamp(48px,12vw,160px)]',
            // verticalMobile override: bigger range below md so the letters
            // read big without the horizontal width constraint of the row.
            verticalMobile && 'max-md:text-[clamp(80px,22vw,130px)]'
          )}
          style={{ lineHeight: 1, opacity: 0 }}
        >
          ALX
        </span>

        <div
          ref={slotRef}
          className="relative overflow-hidden bg-[var(--color-bg-elev)] shrink-0"
        >
          {SPLASH_PHOTOS.map((src, i) => (
            <div
              key={src}
              ref={(el) => {
                photoRefs.current[i] = el;
              }}
              className="absolute inset-0"
              style={{ clipPath: 'inset(0 100% 0 0)' }}
            >
              <Image
                src={asset(src)}
                alt=""
                fill
                sizes="(max-width: 768px) 30vw, 240px"
                className="object-cover"
                priority
                draggable={false}
              />
            </div>
          ))}
        </div>

        <span
          ref={rightRef}
          className={cn(
            'font-bold tracking-[-0.04em] text-[var(--color-fg)] select-none',
            'text-[clamp(48px,12vw,160px)]',
            verticalMobile && 'max-md:text-[clamp(80px,22vw,130px)]'
          )}
          style={{ lineHeight: 1, opacity: 0 }}
        >
          MTNC
        </span>

        {/* Speed readout — only visible while the user is scrubbing the intro
            by hand (see MANUAL SCRUB). ABSOLUTE on purpose, not a flex child:
            the glyph's travel target is measured from the slot's rect at
            mount, so anything able to reflow the row AFTER that measurement
            would land the glyph beside its hero position. Out of flow, the
            composition stays put whether the readout is there or not — and it
            can appear mid-animation without shifting a single pixel.
            No positive letter-spacing (CLAUDE.md §4): the skip link remains
            the only place on the site that carries one. */}
        <div
          ref={speedRef}
          className={cn(
            'absolute top-full left-1/2 -translate-x-1/2',
            'mt-[clamp(16px,3.5vw,36px)]',
            'font-mono text-[clamp(11px,1.1vw,14px)] leading-none',
            'text-[var(--color-fg-muted)] select-none',
            'transition-opacity duration-200 ease-out',
            // Vertical mobile stacks ALX / slot / MTNC left-aligned
            // (items-start), so the readout follows that edge rather than the
            // block's centre — otherwise it floats off on its own axis.
            verticalMobile && 'max-md:left-0 max-md:translate-x-0'
          )}
          style={{ opacity: 0 }}
        >
          ×2
        </div>
      </div>

      {/* Glyph wrapper — fixed-positioned sibling of the row so the travel
          phase can translate freely outside the row's flex bounds. Position
          and size are set in JS at mount to align exactly over the slot. */}
      <div
        ref={glyphRef}
        className="fixed pointer-events-none"
        style={{
          left: 0,
          top: 0,
          color: 'var(--color-accent)',
          clipPath: 'inset(0 100% 0 0)',
          willChange: 'transform, clip-path',
        }}
      >
        <SplashGlyph />
      </div>
    </div>
  );
}
