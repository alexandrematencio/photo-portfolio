/**
 * Stack-based browser-history integration for nested modals.
 *
 * Problem this solves: the lightbox + original viewer live entirely in React
 * state, not in the URL. So when the user opens them and presses the
 * browser's back button, the browser pops to the previous URL (Google, an
 * About page, …) — almost certainly NOT what the user expected. They also
 * lose any way to "back out of the modal first". Then forward-from-Google
 * often paints a blank page because the previous tab was left with a locked
 * `body.style.overflow` and other modal state.
 *
 * Fix: each modal pushes a benign history entry on mount (no URL change,
 * just an extra slot). A single `popstate` listener walks a stack of close
 * handlers — the topmost wins. So back press 1 closes the topmost modal,
 * back press 2 closes the next, and only AFTER all modals are closed does
 * a third back leave the page. Forward then restores the page cleanly
 * because the modal state is already torn down.
 *
 * Cleanup semantics:
 *   - Modal unmounted because of popstate (browser back): the entry was
 *     already popped by the browser. The cleanup removes the modal from
 *     the stack only — no extra `history.back()`.
 *   - Modal unmounted because of user action (Esc / X / backdrop click):
 *     we pop our entry manually with `history.back()` so the browser's
 *     back button is consistent afterwards. We mute the popstate listener
 *     for one tick around this call so the cascade doesn't also close
 *     the next-down modal in the stack.
 */

type CloseFn = () => void;

type StackEntry = { close: CloseFn; viaPopState: { current: boolean } };

const stack: StackEntry[] = [];
let listener: ((e: PopStateEvent) => void) | null = null;
let listenerMuted = false;

function attachListener() {
  if (listener || typeof window === 'undefined') return;
  listener = () => {
    if (listenerMuted) return;
    const top = stack[stack.length - 1];
    if (!top) return;
    top.viaPopState.current = true;
    top.close();
  };
  window.addEventListener('popstate', listener);
}

function detachListenerIfEmpty() {
  if (!listener || stack.length > 0 || typeof window === 'undefined') return;
  window.removeEventListener('popstate', listener);
  listener = null;
}

/**
 * Push a history entry tied to this modal. Returns a cleanup function the
 * caller must invoke when the modal unmounts (typically from useEffect's
 * return). The cleanup pops the entry on user-initiated close and is a
 * no-op on popstate close.
 */
export function pushModalHistory(close: CloseFn): () => void {
  if (typeof window === 'undefined') return () => {};
  window.history.pushState({ modal: true }, '');
  const entry: StackEntry = { close, viaPopState: { current: false } };
  stack.push(entry);
  attachListener();
  return () => {
    const idx = stack.indexOf(entry);
    if (idx >= 0) stack.splice(idx, 1);
    if (!entry.viaPopState.current && typeof window !== 'undefined') {
      // User closed via UI (X, Esc, backdrop, swipe-away). Pop the entry we
      // pushed on open so later browser-back works consistently. Mute the
      // listener for one event-loop tick so the popstate this back() emits
      // doesn't also pop the next modal in the stack.
      listenerMuted = true;
      window.history.back();
      window.setTimeout(() => {
        listenerMuted = false;
      }, 0);
    }
    detachListenerIfEmpty();
  };
}
