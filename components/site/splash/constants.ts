/**
 * Constantes du splash de la home : photos du slot, réglages du scrub manuel,
 * et l'événement de reveal que HomeHero écoute (re-exporté par SplashScreen).
 */

export const SPLASH_PHOTOS = [
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
export const SCRUB_SECONDS_PER_PX = 0.00175;
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
export const SCRUB_SECONDS_PER_PX_TOUCH = 0.0042;
/** Below this, the delta is trackpad noise (or a horizontal-ish gesture). */
export const SCRUB_MIN_DELTA_PX = 1;
/** Playhead catch-up per frame — the inertia of a ScrollTrigger `scrub`. */
export const SCRUB_EASE = 0.18;
/** Close enough to the target to snap onto it and stop the rAF loop. */
export const SCRUB_SNAP_SECONDS = 0.004;
/** Idle time after the last gesture before automatic playback resumes. */
export const SCRUB_IDLE_RESUME_MS = 700;
/**
 * Damping of the speed readout. Heavy on purpose: the raw playhead rate
 * swings wildly inside a single trackpad flick, and a digit that dances is
 * exactly the kind of thing the splash is supposed not to do. At this value
 * the readout settles on one number for most of a gesture.
 */
export const SPEED_SMOOTHING = 0.08;
/** Readout bounds. Floor: below ×2 it isn't worth announcing. Ceiling: keeps
 *  the label two characters wide, so it never changes width mid-gesture. */
export const SPEED_MIN = 2;
export const SPEED_MAX = 9;

/** The GSAP timeline type, without importing gsap eagerly for it. */
export type SplashTimeline = ReturnType<(typeof import('gsap'))['default']['timeline']>;

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
