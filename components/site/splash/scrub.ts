import type { RefObject } from 'react';
import {
  SCRUB_EASE,
  SCRUB_IDLE_RESUME_MS,
  SCRUB_MIN_DELTA_PX,
  SCRUB_SECONDS_PER_PX,
  SCRUB_SECONDS_PER_PX_TOUCH,
  SCRUB_SNAP_SECONDS,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_SMOOTHING,
  type SplashTimeline,
} from './constants';

/**
 * Contrôleur du scrub manuel du splash. Branche ses écouteurs de geste dès
 * l'appel (au moment où le splash décide de jouer), reçoit la timeline par
 * `attachScrub` une fois construite, et se débranche par `dispose` au démontage.
 */
export function createSplashScrub({
  speedRef,
  revealedRef,
  dispatchReveal,
}: {
  speedRef: RefObject<HTMLDivElement | null>;
  revealedRef: RefObject<boolean>;
  dispatchReveal: (skip: boolean) => void;
}) {
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

  const dispose = () => {
      window.removeEventListener('wheel', onWheel, gestureOpts);
      window.removeEventListener('touchstart', onTouchStart, gestureOpts);
      window.removeEventListener('touchmove', onTouchMove, gestureOpts);
      window.removeEventListener('touchend', onTouchEnd, gestureOpts);
      window.removeEventListener('touchcancel', onTouchEnd, gestureOpts);
      if (scrubRaf) cancelAnimationFrame(scrubRaf);
      if (idleTimer) window.clearTimeout(idleTimer);
  };

  return { attachScrub, dispose };
}
