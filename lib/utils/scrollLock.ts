/**
 * Reference-counted body scroll lock.
 *
 * Allows multiple components to lock the body scroll independently — scroll
 * stays locked as long as ANY locker is active, restored to the original
 * inline `overflow` value only when the LAST locker releases.
 *
 * Why this exists: the SplashScreen overlay locks scroll on mount and releases
 * on unmount. The HomeHero entrance choreography (triggered by the splash's
 * reveal event) also locks scroll for its duration. The splash unmounts a few
 * hundred ms BEFORE the entrance finishes — and naive `body.style.overflow`
 * juggling between the two would either (a) unlock prematurely (splash
 * cleanup restores to the pre-splash value while the entrance is still
 * running, letting the user wheel-scroll into a partial scroll-morph state
 * that snaps when ScrollTrigger binds), or (b) leave scroll locked forever
 * (entrance restores to the value captured WHILE the splash had already
 * locked = `'hidden'`).
 *
 * The refcount solves both. Each `lockBodyScroll()` increments, each
 * `unlockBodyScroll()` decrements. The original inline value is captured on
 * the first lock and restored on the last unlock.
 *
 * Safe across SSR (no-ops when `document` is undefined).
 */

let lockCount = 0;
let originalOverflow: string | null = null;

/**
 * `overflow: hidden` kills the NATIVE scroll — not a smooth-scroll library.
 * Lenis (mounted by ScrollPhysicsGallery on the home, in parallel with the
 * splash) keeps its own `wheel` listener on `window` and keeps integrating
 * deltas into its internal target while we hold the lock. Nothing moves on
 * screen — the viewport isn't scrollable — but the banked distance is applied
 * in ONE jump the moment the last locker releases. A user who wheels through
 * the splash would land mid-gallery, hero already collapsed into the nav-bar.
 *
 * So the lock swallows the gestures themselves, in the CAPTURE phase on
 * `window` — i.e. BEFORE Lenis's bubble-phase listener ever sees them.
 *
 * `stopPropagation()`, NEVER `stopImmediatePropagation()`: other capture
 * listeners on `window` must still receive the event. The splash reads these
 * very deltas to let the user scrub its intro by hand (see SplashScreen), and
 * it binds later than the first `lockBodyScroll()` — with the immediate
 * variant, registration order would decide whether the feature works at all.
 *
 * Consequence to keep in mind: while the lock is held, NOTHING can be scrolled
 * by wheel or touch, inner scrollers included. That is exactly the intent for
 * the splash → entrance window. A future locker that needs a live scrollable
 * area must opt out here rather than juggle `overflow` on its own.
 */
function swallowGesture(e: Event): void {
  // Non-passive registration below, so preventDefault is honoured.
  e.preventDefault();
  e.stopPropagation();
}

const GESTURE_EVENTS = ['wheel', 'touchmove'] as const;
const GESTURE_OPTS: AddEventListenerOptions = { capture: true, passive: false };

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    for (const type of GESTURE_EVENTS) {
      window.addEventListener(type, swallowGesture, GESTURE_OPTS);
    }
  }
  lockCount++;
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) return;
  lockCount--;
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow ?? '';
    originalOverflow = null;
    for (const type of GESTURE_EVENTS) {
      window.removeEventListener(type, swallowGesture, GESTURE_OPTS);
    }
  }
}
