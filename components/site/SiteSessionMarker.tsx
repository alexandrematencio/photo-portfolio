'use client';

import { usePathname } from 'next/navigation';
import { markSplashSeen } from '@/lib/site/splash-session';

/**
 * Tracks whether the user has navigated within the (site) area in this tab.
 *
 * Implementation rationale — why a render-time write (not useEffect):
 *
 *   The marker lives in the (site) layout. SplashScreen lives in the home
 *   page. React runs `useEffect`s depth-first (deeper components first), so
 *   a useEffect in the marker would run AFTER SplashScreen's gate reads
 *   localStorage. On the very first arrival to `/` that's fine — we want
 *   the splash to play and we want the marker NOT to have set the flag yet.
 *   But on internal navigations (e.g. /contact → / via the logo Link), the
 *   same depth-first order would cause SplashScreen to read localStorage
 *   BEFORE the marker had a chance to set it on the new pathname — so the
 *   splash would still play. That's the exact bug we hit with the previous
 *   `setTimeout(0)` strategy (worse: a macrotask delay on top).
 *
 *   Setting during render fixes the ordering. React's render phase is
 *   strictly synchronous and tree-top-down: the layout (and the marker
 *   inside it) renders BEFORE the page's `SplashScreen`. So by the time
 *   the page's effects start, the flag is already in localStorage. The
 *   write is idempotent — we only ever `setItem('siteVisited', 'true')`,
 *   never reset — so even Strict-Mode double renders are safe.
 *
 *   `initialPathname` is module-level: it persists across React renders
 *   (so we can compare against it later) but resets on full reload / new
 *   tab (= new JS realm). On the very first render in a tab we just record
 *   it without touching localStorage. Once the user moves to a different
 *   path, `pathname !== initialPathname` becomes true and we mark the
 *   session — any subsequent SplashScreen mount on `/` will then see the
 *   flag and skip.
 *
 *   Edge cases:
 *     - First arrival on `/`, no nav yet: marker doesn't set localStorage,
 *       SplashScreen reads empty → plays. ✓
 *     - First arrival on `/contact`, then logo click to `/`: marker sees
 *       pathname changed, sets localStorage → SplashScreen on `/` reads
 *       'true' → skip. ✓
 *     - First arrival on `/`, navigate to /about, browser-back to `/`:
 *       localStorage was set during the /about render, persists through
 *       the back → SplashScreen sees it → skip. ✓
 *     - F5 reload of `/`: JS realm fresh, localStorage carries over. Since
 *       2026-10-01 the splash plays at most once every 12 h: the marker and the
 *       splash write the SAME key (`splashSeen`, lib/site/splash-session.ts)
 *       and SplashScreen skips while it is under 12 h old. ✓
 */

let initialPathname: string | null = null;

export function SiteSessionMarker() {
  const pathname = usePathname();
  if (typeof window !== 'undefined') {
    if (initialPathname === null) {
      // First time the marker runs in this JS realm — record the landing
      // path, but don't yet mark the session as visited. That's what makes
      // a fresh direct arrival on `/` play the splash.
      initialPathname = pathname;
    } else if (pathname !== initialPathname) {
      // The user has navigated within the (site) area. Mark the session so
      // any later SplashScreen mount on `/` skips its intro.
      // Same key as the splash itself (single source since 2026-09-10 —
      // a second key made "delete it in DevTools to replay" silently fail).
      markSplashSeen();
    }
  }
  return null;
}
