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

export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
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
  }
}
