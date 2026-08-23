'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { asset } from '@/lib/utils/asset';
import { cn } from '@/lib/utils/cn';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils/scrollLock';

/**
 * SplashScreen — entrance animation prototyped on /splash-test.
 *
 * Inspired by codepen.io/osmosupply/pen/wBGYEMd (Willem) — letters on either
 * side of a "letter-substitute" slot in which photos cycle, then a final
 * element (here: the ALXMTNC glyph) appears and travels to its place in the
 * hero banner.
 *
 * Scope: this component is the ONLY new runtime piece. It is mounted exclusively
 * by `/splash-test` for now. Deleting this file + the `/splash-test` route is
 * enough to fully roll back. See the rollback note in app/(site)/splash-test.
 *
 * Honors `prefers-reduced-motion` (skips straight to onComplete). Escape skips.
 * A scroll gesture hands the playhead over to the user — see MANUAL SCRUB.
 */

const SPLASH_PHOTOS = [
  '/img/splashscreen/splash-active-1.jpg',
  '/img/splashscreen/splash-active-2.jpg',
  '/img/splashscreen/splash-active-3.jpg',
] as const;

// ── Manual scrub tuning (see the MANUAL SCRUB block in the effect) ────────
/**
 * Timeline seconds gained per pixel of scroll input. The choreography lasts
 * ~4.1 s, so ~2400 px of gesture takes you from the first letter to the glyph
 * landing — a few firm trackpad flicks, roughly two screen-heights of scroll.
 * A single wheel notch (100 px ≈ 0.18 s) reads as a nudge.
 *
 * Deliberately HALF of what feels "responsive" in isolation: a trackpad flick
 * carries hundreds of pixels, and at twice this rate the intro jumped ~10×
 * its own speed on one gesture — a hard cut wearing the costume of a scrub,
 * out of step with the rest of the site's motion. The gesture is meant to
 * hurry the intro along, not to skip it.
 */
const SCRUB_SECONDS_PER_PX = 0.00175;
/**
 * Cadence propre au DOIGT — 2,4× celle de la molette (demande Alexandre,
 * 2026-08-23 : « il me faut environ 5 scrolls, je voudrais 2 »).
 *
 * Ce n'est pas un caprice de réglage, les deux entrées ne fournissent pas la
 * même matière. Un pavé tactile ou une molette envoient des `deltaY` gonflés
 * par l'inertie du système : un seul geste porte des centaines de pixels
 * APRÈS que la main s'est arrêtée. Un doigt, ici, n'en porte aucun : le body
 * est verrouillé, il ne défile rien, donc aucune inertie n'est produite et
 * `touchmove` ne rend que le déplacement RÉEL du pouce — au mieux la hauteur
 * de l'écran par balayage.
 *
 * L'arithmétique : la chorégraphie dure ~4,2 s jusqu'à l'atterrissage du
 * glyph. À 0,00175 s/px il fallait ~2400 px de pouce, soit cinq balayages
 * fermes — exactement ce qu'Alexandre a mesuré à la main. À 0,0042 s/px il en
 * faut ~1000, soit deux.
 *
 * ⚠️ Ne PAS remonter la cadence molette pour autant : le commentaire
 * ci-dessus documente qu'à son double, un flick de trackpad faisait bondir
 * l'intro de 10× sa vitesse — une coupe franche déguisée en scrub.
 */
const SCRUB_SECONDS_PER_PX_TOUCH = 0.0042;
/** Below this, the delta is trackpad noise (or a horizontal-ish gesture). */
const SCRUB_MIN_DELTA_PX = 1;
/** Playhead catch-up per frame — the inertia of a ScrollTrigger `scrub`. */
const SCRUB_EASE = 0.18;
/** Close enough to the target to snap onto it and stop the rAF loop. */
const SCRUB_SNAP_SECONDS = 0.004;
/** Idle time after the last gesture before automatic playback resumes. */
const SCRUB_IDLE_RESUME_MS = 700;
/**
 * Damping of the speed readout. Heavy on purpose: the raw playhead rate
 * swings wildly inside a single trackpad flick, and a digit that dances is
 * exactly the kind of thing the splash is supposed not to do. At this value
 * the readout settles on one number for most of a gesture.
 */
const SPEED_SMOOTHING = 0.08;
/** Readout bounds. Floor: below ×2 it isn't worth announcing. Ceiling: keeps
 *  the label two characters wide, so it never changes width mid-gesture. */
const SPEED_MIN = 2;
const SPEED_MAX = 9;

/** The GSAP timeline type, without importing gsap eagerly for it. */
type SplashTimeline = ReturnType<(typeof import('gsap'))['default']['timeline']>;

/**
 * Event dispatched on `window` when the splash exits — either because the
 * glyph just landed at the hero banner's centered glyph position (full
 * choreography path) or because the splash was bypassed (Escape / reduced
 * motion / safety net). Listeners receive a CustomEvent whose `detail.skip`
 * tells them which one:
 *   - `detail.skip === false` → play the "egg-laying" entrance (photo unfurl
 *     → nav items dropped one by one with bounce → arrow fade-in).
 *   - `detail.skip === true`  → skip the entrance and show everything
 *     immediately. The user didn't see the splash land, no point making them
 *     wait through the entrance either.
 *
 * Guaranteed to fire AT MOST ONCE per splash mount (internal ref dedup).
 */
export const SPLASH_REVEAL_EVENT = 'splash:reveal-hero';
export type SplashRevealDetail = { skip: boolean };

/**
 * Measure the actual visible cap-height (top-of-glyph → bottom-of-glyph in
 * pixels, baseline ignored) of the rendered text in `el`. Uses an off-screen
 * canvas + alpha scan. Awaits `document.fonts.ready` upstream so the measured
 * font matches what's rendered on screen (not a fallback metric).
 *
 * Returns the cap-height in CSS pixels at the element's current font-size.
 * Falls back to `fontSize × 0.72` (Inter Bold cap ratio) on errors.
 */
function measureCapHeightPx(el: HTMLElement): number {
  const style = window.getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return 0;

  // Render at a high reference size (200 px) for sub-pixel measurement
  // precision, then scale the result back to the actual rendered size.
  const SAMPLE_FS = 200;
  const sampleScale = SAMPLE_FS / fontSize;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fontSize * 0.72;

  const text = 'ALXMTNC';
  const fontString = `${style.fontWeight} ${SAMPLE_FS}px ${style.fontFamily}`;
  ctx.font = fontString;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  const padding = SAMPLE_FS;
  canvas.width = Math.ceil(m.width) + padding * 2;
  canvas.height = SAMPLE_FS * 3;

  // Canvas resize resets state — re-apply font + draw.
  ctx.font = fontString;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText(text, padding, SAMPLE_FS * 2);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let topY = -1;
  let bottomY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (img[(y * canvas.width + x) * 4 + 3] > 10) {
        if (topY === -1) topY = y;
        bottomY = y;
        break;
      }
    }
  }

  if (topY === -1 || bottomY === -1) return fontSize * 0.72;
  return (bottomY - topY + 1) / sampleScale;
}

/**
 * Measure the LEFT and RIGHT side bearings of `text` rendered in the same
 * font/weight/size as `el`. Side bearings = empty horizontal space inside the
 * text's box (advance width) between the box edge and the first/last visible
 * pixel of the glyph. They're typically asymmetric per character: for the
 * splash, Inter Bold "X" has a notable right bearing while "M" has a small
 * left bearing — so without compensation the visual whitespace LEFT of the
 * photo slot is bigger than the whitespace RIGHT of it, even with symmetric
 * CSS gap. We use this to apply asymmetric margin to the slot and balance
 * the two visual gaps.
 *
 * Letter-spacing is intentionally NOT applied on the canvas — it only affects
 * inter-letter spacing, not outer bearings, so its absence doesn't bias the
 * measurement.
 */
function measureSideBearings(
  text: string,
  el: HTMLElement
): { leftBearing: number; rightBearing: number } {
  const style = window.getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) {
    return { leftBearing: 0, rightBearing: 0 };
  }

  const SAMPLE_FS = 200;
  const sampleScale = SAMPLE_FS / fontSize;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { leftBearing: 0, rightBearing: 0 };

  const fontString = `${style.fontWeight} ${SAMPLE_FS}px ${style.fontFamily}`;
  ctx.font = fontString;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  const padding = SAMPLE_FS;
  canvas.width = Math.ceil(m.width) + padding * 2;
  canvas.height = SAMPLE_FS * 3;

  ctx.font = fontString;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText(text, padding, SAMPLE_FS * 2);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // Scan column by column from the left, find first column with any ink.
  let leftmostX = -1;
  for (let x = 0; x < canvas.width; x++) {
    let hasInk = false;
    for (let y = 0; y < canvas.height; y++) {
      if (img[(y * canvas.width + x) * 4 + 3] > 10) {
        hasInk = true;
        break;
      }
    }
    if (hasInk) {
      leftmostX = x;
      break;
    }
  }

  // Scan from the right.
  let rightmostX = -1;
  for (let x = canvas.width - 1; x >= 0; x--) {
    let hasInk = false;
    for (let y = 0; y < canvas.height; y++) {
      if (img[(y * canvas.width + x) * 4 + 3] > 10) {
        hasInk = true;
        break;
      }
    }
    if (hasInk) {
      rightmostX = x;
      break;
    }
  }

  if (leftmostX < 0 || rightmostX < 0) {
    return { leftBearing: 0, rightBearing: 0 };
  }

  // Text box runs from x=padding to x=padding+m.width.
  const leftBearingSample = leftmostX - padding;
  const rightBearingSample = padding + m.width - (rightmostX + 1);

  return {
    leftBearing: Math.max(0, leftBearingSample / sampleScale),
    rightBearing: Math.max(0, rightBearingSample / sampleScale),
  };
}

// Glyph SVG inlined (rather than reusing GlyphLogo) so the wrapping element can
// be sized, positioned and colored independently for the travel phase.
function SplashGlyph() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 559 521"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ALXMTNC"
    >
      <g clipPath="url(#splash-glyph-clip)">
        <path
          opacity="0.3"
          d="M85.6254 273.246V372.848L174.835 321.12"
          fill="currentColor"
        />
        <path
          d="M343.313 422.277L257.688 372.848L472.766 248.43V149.166L257.688 273.246L172.062 223.885L386.735 99.4667L386.938 0L172.062 124.283L85.6254 74.9212V173.644L0 124.688V322.675L85.6254 372.848V273.246L172.062 322.675V422.277L343.313 521L558.797 397.394L559 297.994L343.313 422.277Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="splash-glyph-clip">
          <rect width="559" height="521" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

type Props = {
  /** Fires when the splash finishes (or is skipped) and starts to unmount. */
  onComplete?: () => void;
  /**
   * Sandbox-only opt-in: on mobile (< md), stack ALX / slot / MTNC vertically
   * and bump the letter font-size. Desktop layout unchanged. Used by
   * /splash-test while we iterate on the mobile composition without touching
   * the production splash on /.
   */
  verticalMobile?: boolean;
};

export function SplashScreen({ onComplete, verticalMobile = false }: Props) {
  const [mounted, setMounted] = useState(true);
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
    // Spec :
    //   • 1ʳᵉ arrivée sur /  (pas de flag de session)  → PLAY
    //   • reload AU HERO  (scrollY ≈ 0)                → PLAY
    //   • reload IN GALLERY (scrollY > 0)              → SKIP
    //   • back / forward navigation                    → SKIP
    //   • internal Link navigation back to /           → SKIP
    //     (sessionStorage flag set when the splash first played in this tab)
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
      // `siteVisited` is set by <SiteSessionMarker /> (in the (site) layout)
      // AT RENDER TIME on the first pathname change in this tab. By the time
      // our own useEffect runs, the layout has already committed its render
      // — so for a /contact → / Link nav, the flag is in sessionStorage
      // BEFORE we read it here, and the splash correctly skips.
      // The render-time approach is what makes this race-free; an earlier
      // useEffect-based attempt suffered from React's depth-first effect
      // order (SplashScreen, deeper, would read before the marker, shallower,
      // set).
      const siteVisited = sessionStorage.getItem('siteVisited') === 'true';
      // 4 px tolerance — browsers sometimes restore scroll a couple px off 0.
      const atHero = window.scrollY <= 4;

      if (navType === 'back_forward') {
        shouldSkip = true;
      } else if (navType === 'reload') {
        shouldSkip = !atHero;
      } else {
        // 'navigate' (first load OR client-side Link nav back to /)
        shouldSkip = siteVisited;
      }
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

    // ────────────────────────────────────────────────────────────────────
    // MANUAL SCRUB — « quand elle me fait chier, je scrolle »
    //
    // A scroll gesture (wheel, trackpad, touch drag) suspends automatic
    // playback and hands the playhead to the hand: pixels scrolled become
    // timeline seconds, followed with a little inertia (same feel as a
    // ScrollTrigger `scrub`). The whole choreography still runs — the glyph
    // still lands on the hero, the seam is preserved — it just runs at the
    // user's speed.
    //
    // Four things this is deliberately NOT, each one a way to break it:
    //
    //  1. NOT a dead end. Stop scrolling and, after SCRUB_IDLE_RESUME_MS,
    //     automatic playback picks up from wherever the playhead was left.
    //     A pure scrub would strand the splash half-played (overlay frozen,
    //     body still locked) on a single wheel notch followed by a pause.
    //  2. NOT bidirectional. Scrubbing back would re-cross the reveal point
    //     — already fired and deduped, so the hero would keep its entrance
    //     while the splash rewound OVER it. The gesture means "get on with
    //     it", not "replay it": negative deltas are ignored.
    //  3. NOT dependent on the timeline existing yet. Image preload + fonts
    //     can take a second on a cold load; a gesture arriving before that
    //     is banked and applied at hand-over, never swallowed.
    //  4. NOT reliant on the timeline's own callbacks. `.time()` seeks are
    //     event-suppressed in GSAP, so the reveal hand-off and the end of
    //     the splash are driven explicitly from `afterSeek`.
    //
    // The gestures reach us even though the body is locked: the lock kills
    // the scroll, not the events. It swallows them in the CAPTURE phase on
    // `window` (so Lenis can't bank them, cf. lib/utils/scrollLock) with
    // `stopPropagation`, not `stopImmediatePropagation` — which is exactly
    // why our own capture-phase listener below still fires, whatever the
    // registration order between the two.
    // ────────────────────────────────────────────────────────────────────
    let scrubTl: SplashTimeline | null = null;
    let scrubFinish: (() => void) | null = null;
    let revealTime = Number.POSITIVE_INFINITY;
    let manual = false;
    let scrubTarget = 0;
    let bankedPx = 0;
    let scrubRaf = 0;
    let idleTimer = 0;
    let touchY: number | null = null;

    // Speed readout ("×3") — how much faster than real time the playhead is
    // currently running. Written straight to the DOM: this updates on a rAF,
    // React state would re-render the whole splash sixty times a second.
    let smoothRate = 0;
    let lastRateMs = 0;
    let shownRate = 0;

    const showReadout = (visible: boolean) => {
      const el = speedRef.current;
      if (el) el.style.opacity = visible ? '1' : '0';
    };

    const updateReadout = (advancedSeconds: number) => {
      const el = speedRef.current;
      if (!el) return;
      const nowMs = performance.now();
      const dt = lastRateMs ? (nowMs - lastRateMs) / 1000 : 0;
      lastRateMs = nowMs;
      // First frame has no dt, and a hitch (tab throttling, a long task)
      // would report a fake rate — skip both rather than flash a wrong number.
      if (!(dt > 0 && dt < 0.1)) return;
      const rate = advancedSeconds / dt;
      smoothRate =
        smoothRate === 0 ? rate : smoothRate + (rate - smoothRate) * SPEED_SMOOTHING;
      const shown = Math.max(SPEED_MIN, Math.min(SPEED_MAX, Math.round(smoothRate)));
      if (shown !== shownRate) {
        shownRate = shown;
        el.textContent = `×${shown}`;
      }
    };

    /**
     * Give the playhead back to automatic playback, from wherever the scrub
     * left it. Two callers: the idle timer (the user stopped scrolling) and
     * the reveal hand-off (see `afterSeek`).
     */
    const resumeAuto = () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
        idleTimer = 0;
      }
      if (!manual || !scrubTl) return;
      manual = false;
      showReadout(false);
      if (scrubRaf) {
        cancelAnimationFrame(scrubRaf);
        scrubRaf = 0;
      }
      scrubTl.play();
    };

    // The two moments the timeline would normally announce itself, checked by
    // hand because seeking suppresses them. Both targets are idempotent
    // (`dispatchReveal` dedups, `finish` guards), so the automatic path
    // reaching them too costs nothing.
    const afterSeek = (t: number) => {
      if (t >= revealTime && !revealedRef.current) {
        // THE SCRUB OWNS THE INTRO, NOT THE HAND-OFF. The glyph has just
        // landed on the hero: `dispatchReveal` starts the hero entrance, a
        // fixed 1.6 s choreography that cannot be scrubbed. What is left of
        // OUR timeline is the 0.4 s overlay fade that uncovers it — and
        // leaving those under the gesture is what produced the pause and the
        // washed-out flash: the fade would stall part-way (asymptotic settle,
        // or the user simply stopped scrolling and had to wait out the 700 ms
        // idle timer) with the hero showing through a half-opaque background.
        // `power2.in` made it worse — an ease-in barely moves at first, so a
        // slowly-scrubbed fade reads as frozen, then rushes.
        // So the moment the reveal fires, the tail goes back to automatic and
        // plays at 1×, exactly as it does when the splash was never touched.
        dispatchReveal(false);
        resumeAuto();
      }
      if (scrubTl && t >= scrubTl.duration() - SCRUB_SNAP_SECONDS) {
        scrubFinish?.();
      }
    };

    const stepScrub = () => {
      scrubRaf = 0;
      const tl = scrubTl;
      if (!tl || !manual) return;
      const now = tl.time();
      const remaining = scrubTarget - now;
      const next =
        remaining < SCRUB_SNAP_SECONDS
          ? scrubTarget
          : now + remaining * SCRUB_EASE;
      const t = Math.min(next, tl.duration());
      tl.time(t);
      updateReadout(t - now);
      afterSeek(t);
      if (remaining >= SCRUB_SNAP_SECONDS && manual) {
        scrubRaf = requestAnimationFrame(stepScrub);
      }
    };

    const onScrollIntent = (
      px: number,
      secPerPx: number = SCRUB_SECONDS_PER_PX
    ) => {
      if (!(px >= SCRUB_MIN_DELTA_PX)) return; // NaN-safe, forward-only
      // Past the reveal the splash is only a fade over a hero entrance that
      // is already running — there is nothing left worth scrubbing, and
      // grabbing it back would re-open the stall described in `afterSeek`.
      // Covers the automatic path too: `revealedRef` is set by whichever of
      // the two fired it.
      if (revealedRef.current) return;
      const tl = scrubTl;
      if (!tl) {
        // Mis en réserve en pixels ÉQUIVALENTS-MOLETTE : la timeline n'existe
        // pas encore, donc on ne peut pas convertir en secondes, et le rejeu
        // de `attachScrub` se fera à la cadence par défaut. Convertir ici
        // garde le geste tactile à sa juste valeur.
        bankedPx += (px * secPerPx) / SCRUB_SECONDS_PER_PX;
        return;
      }
      if (!manual) {
        manual = true;
        tl.pause();
        scrubTarget = tl.time();
        smoothRate = 0;
        lastRateMs = 0;
        shownRate = SPEED_MIN;
        if (speedRef.current) speedRef.current.textContent = `×${SPEED_MIN}`;
        showReadout(true);
      }
      scrubTarget = Math.min(tl.duration(), scrubTarget + px * secPerPx);
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(resumeAuto, SCRUB_IDLE_RESUME_MS);
      if (!scrubRaf) scrubRaf = requestAnimationFrame(stepScrub);
    };

    /**
     * Hand the built timeline over to the controller. Called at the very end
     * of the build, where `TRAVEL_END` and `duration()` are final — and where
     * the playhead is still at 0, the whole build being synchronous.
     */
    const attachScrub = (
      tl: SplashTimeline,
      finish: () => void,
      revealAt: number
    ) => {
      scrubTl = tl;
      scrubFinish = finish;
      revealTime = revealAt;
      if (bankedPx > 0) {
        const px = bankedPx;
        bankedPx = 0;
        onScrollIntent(px);
      }
    };

    // deltaMode: 0 = pixels, 1 = lines (Firefox), 2 = pages.
    const onWheel = (e: WheelEvent) => {
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      onScrollIntent(e.deltaY * unit);
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y === undefined || touchY === null) return;
      // Doigt qui monte = on avance. Cadence tactile : cf. SCRUB_SECONDS_PER_PX_TOUCH.
      onScrollIntent(touchY - y, SCRUB_SECONDS_PER_PX_TOUCH);
      touchY = y;
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    // Capture phase + passive: we only READ the deltas here. Cancelling them
    // is the scroll lock's job (and it is already holding, this component
    // locks on mount).
    const gestureOpts: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };
    window.addEventListener('wheel', onWheel, gestureOpts);
    window.addEventListener('touchstart', onTouchStart, gestureOpts);
    window.addEventListener('touchmove', onTouchMove, gestureOpts);
    window.addEventListener('touchend', onTouchEnd, gestureOpts);
    window.addEventListener('touchcancel', onTouchEnd, gestureOpts);

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

      // Letter height drives slot + glyph sizing.
      // - Horizontal (default): STRICT cap-height (bottom-of-glyph → top-of-
      //   glyph, baseline + descender padding excluded). Slot reads as the
      //   exact visible extent of the letters — a 4ᵗʰ "letter substitute".
      // - Vertical mobile (verticalMobile && < md): full line-box height
      //   (= font-size, since lineHeight:1). Slot occupies the same vertical
      //   real estate as a line of text, so it reads "as tall as the letters"
      //   in the stacked ALX / slot / MTNC column.
      const isVerticalMobile =
        verticalMobile && window.matchMedia('(max-width: 768px)').matches;
      const letterH = isVerticalMobile
        ? left.getBoundingClientRect().height
        : measureCapHeightPx(left);

      // Slot footprint = letter-height tall, 1.5× wide (3:2 ratio, matches the
      // source photos so no crop is needed). All 3 photos object-cover into this
      // stable rectangle — width never changes during the cycle, so ALX and MTNC
      // stay anchored either side. The glyph then occupies the same letter-height
      // vertical band (at its natural ~1.07 aspect ratio).
      const slotW = Math.round(letterH * 1.5);
      slot.style.height = `${letterH}px`;
      slot.style.width = `${slotW}px`;

      // Compensate for font side-bearing asymmetry. Inter Bold "X" leaves a
      // notable right bearing (empty space at the right of its advance width),
      // while "M" has a small left bearing. With purely symmetric CSS gap, the
      // visual whitespace LEFT of the slot is therefore bigger than the one
      // RIGHT of it. We measure both bearings, take half their difference, and
      // apply it as opposing margins on the slot — total slot layout footprint
      // stays the same (margin-left + margin-right cancel), but the slot
      // shifts horizontally toward the "looser" side until the two visual
      // whitespaces match. Must be applied BEFORE measuring slotRect for the
      // glyph wrapper, otherwise the glyph lands at the un-shifted position
      // and looks slightly off-center vs the rendered slot.
      // Skipped in vertical-mobile layout — column direction, side bearings
      // are irrelevant.
      if (!isVerticalMobile) {
        const leftBearings = measureSideBearings('ALX', left);
        const rightBearings = measureSideBearings('MTNC', right);
        const asymmetryPx =
          (leftBearings.rightBearing - rightBearings.leftBearing) / 2;
        slot.style.marginLeft = `${-asymmetryPx}px`;
        slot.style.marginRight = `${asymmetryPx}px`;
      } else {
        slot.style.marginLeft = '';
        slot.style.marginRight = '';
      }

      // Place the glyph wrapper EXACTLY over the slot when it's at its FINAL
      // expanded size. We measure first (slot at full size = letters pushed
      // apart, bearing-margin already applied), capture the glyph target
      // position, then collapse the slot's main axis to 0 for the Willem
      // expansion (next gsap.set below). The getBoundingClientRect() forces a
      // synchronous layout — by the time the browser actually paints (next
      // frame), the slot is already back at 0, so the user never sees the
      // temporary full-size frame.
      const slotRect = slot.getBoundingClientRect();
      const glyphH = letterH;
      const glyphW = glyphH * (559 / 521);
      const glyphLeft = slotRect.left + (slotRect.width - glyphW) / 2;
      const glyphTop = slotRect.top + (slotRect.height - glyphH) / 2;
      glyphWrap.style.width = `${glyphW}px`;
      glyphWrap.style.height = `${glyphH}px`;
      glyphWrap.style.left = `${glyphLeft}px`;
      glyphWrap.style.top = `${glyphTop}px`;

      // Willem expansion setup. The slot's main axis (width in horizontal
      // layout, height in vertical layout) collapses to 0, ALX and MTNC fall
      // back against each other as if "ALXMTNC" was one word. Phase 2 then
      // grows the slot back to full size, pushing the letters apart.
      // Photo 0 sits at clipPath inset(0 0 0 0) (fully revealed via the slot
      // growth itself — object-cover means the visible portion expands
      // symmetrically from the center as the slot widens). Photos 1 and 2
      // keep their initial inline clipPath inset(0 100% 0 0) and wipe in via
      // clipPath as before, inside the now-fixed-size slot.
      const expandProp: 'width' | 'height' = isVerticalMobile
        ? 'height'
        : 'width';
      const expandTarget = isVerticalMobile ? letterH : slotW;
      gsap.set(slot, { [expandProp]: 0 });
      gsap.set(photos[0], { clipPath: 'inset(0 0% 0 0)' });

      // Locate the HomeHero's centered glyph by DOM query — no edits to
      // HomeHero needed. We take the biggest GlyphLogo on the page that is
      // not part of the splash overlay.
      const allGlyphs = Array.from(
        document.querySelectorAll<SVGElement>('svg[viewBox="0 0 559 521"]')
      );
      const heroTarget = allGlyphs
        .filter((s) => !overlay.contains(s))
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 50)
        .sort((a, b) => b.rect.width - a.rect.width)[0];

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

      const tl = gsap.timeline({ onComplete: finish });

      // 1 — Letters rise + fade in together.
      tl.fromTo(
        [left, right],
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' },
        0
      );

      // 2 — Photo cycle, Willem-style.
      //   • Sub-phase 1: the slot grows from 0 to its full main-axis size
      //     (width horizontal / height vertical), pushing ALX and MTNC apart.
      //     Photo 0 is already clipPath-revealed (inset 0), so as the slot
      //     widens it fills with the photo — the center column of the image
      //     expands outward symmetrically (object-cover). Same easing/duration
      //     as the subsequent photo wipes for one continuous tempo.
      //   • Sub-phases 2 & 3: photos 1 and 2 wipe in via clipPath inside the
      //     now-fixed slot, like before — each covers the previous one with a
      //     left → right reveal.
      const REVEAL = 0.42;
      const HOLD = 0.16;
      let cursor = 0.4;
      tl.to(
        slot,
        { [expandProp]: expandTarget, duration: REVEAL, ease: 'power2.out' },
        cursor
      );
      cursor += REVEAL + HOLD;
      for (let i = 1; i < photos.length; i++) {
        tl.to(
          photos[i],
          { clipPath: 'inset(0 0% 0 0)', duration: REVEAL, ease: 'power2.out' },
          cursor
        );
        cursor += REVEAL + HOLD;
      }

      // 3 — Glyph wipes in (left → right) with the same easing as the photo
      // cycle for continuity. Simultaneously, the slot (photo-3 + elevated bg)
      // wipes OUT in the same direction (left edge disappears first) so that
      // behind the wipe-line the glyph appears alone on the splash background —
      // no photo, no slot panel, "rien derrière le logo".
      // Both tweens share `cursor`, `REVEAL` and `power2.out` so the wipe-line
      // stays perfectly aligned across the slot width.
      tl.to(
        glyphWrap,
        { clipPath: 'inset(0 0% 0 0)', duration: REVEAL, ease: 'power2.out' },
        cursor
      );
      tl.to(
        slot,
        { clipPath: 'inset(0 0 0 100%)', duration: REVEAL, ease: 'power2.out' },
        cursor
      );
      // Hold post-glyph aligné sur le HOLD inter-photos : le glyph est "le
      // 4ᵉ élément du cycle", donc même tempo que les swaps qui précèdent.
      // L'assouplissement du travel (power3.inOut, 0.95s ci-dessous) reste
      // intact — seule la pause d'attente est tightenée.
      cursor += REVEAL + HOLD;

      // 4 — Handoff. ALX/MTNC dissolve, then the glyph travels via a bezier
      // ease (`power3.inOut`) to the HomeHero centered glyph position. Falls
      // back to a stationary fade-out if no target is found (defensive). The
      // slot is already gone (clipped out in phase 3) so no need to touch it.
      tl.to([left, right], { opacity: 0, duration: 0.4, ease: 'power2.in' }, cursor);

      const TRAVEL_DUR = 0.95;
      const TRAVEL_START = cursor + 0.05;
      const TRAVEL_END = TRAVEL_START + TRAVEL_DUR;

      if (heroTarget) {
        const targetCx = heroTarget.rect.left + heroTarget.rect.width / 2;
        const targetCy = heroTarget.rect.top + heroTarget.rect.height / 2;
        const currentCx = glyphLeft + glyphW / 2;
        const currentCy = glyphTop + glyphH / 2;
        const dx = targetCx - currentCx;
        const dy = targetCy - currentCy;
        const scale = heroTarget.rect.width / glyphW;

        tl.to(
          glyphWrap,
          {
            x: dx,
            y: dy,
            scale,
            transformOrigin: '50% 50%',
            duration: TRAVEL_DUR,
            ease: 'power3.inOut',
          },
          TRAVEL_START
        );
      }

      // 5 — At the exact moment the glyph LANDS at its hero-banner position,
      // fire the reveal event (skip:false) so the hero can start its
      // "egg-laying" entrance (photo unfurl → nav items dropped → arrow). The
      // splash overlay then fades over the next 0.4s — by which time the photo
      // is unfurled and the first nav item is starting to drop.
      tl.call(
        () => {
          dispatchReveal(false);
        },
        undefined,
        TRAVEL_END
      );

      // 6 — Overlay background fades out so HomeHeroSplash (already mounted
      // and now mid-entrance) takes over visually. The splash glyph fades
      // with the overlay — by then it sits on top of the hero's own centered
      // glyph, so the handoff reads as one continuous element.
      tl.to(overlay, { opacity: 0, duration: 0.4, ease: 'power2.in' }, TRAVEL_END);

      attachScrub(tl, finish, TRAVEL_END);

      cleanup = () => {
        tl.kill();
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
      window.removeEventListener('wheel', onWheel, gestureOpts);
      window.removeEventListener('touchstart', onTouchStart, gestureOpts);
      window.removeEventListener('touchmove', onTouchMove, gestureOpts);
      window.removeEventListener('touchend', onTouchEnd, gestureOpts);
      window.removeEventListener('touchcancel', onTouchEnd, gestureOpts);
      if (scrubRaf) cancelAnimationFrame(scrubRaf);
      if (idleTimer) window.clearTimeout(idleTimer);
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
