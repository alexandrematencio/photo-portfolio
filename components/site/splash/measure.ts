/**
 * Mesures typographiques du splash : bande de capitales, approches latérales,
 * calage du slot au pixel écran. Fonctions pures sur le DOM, sans état.
 */

/**
 * Measure the total INK extent (topmost painted pixel → bottommost painted
 * pixel) of the rendered text in `el`. Uses an off-screen canvas + alpha scan.
 * Awaits `document.fonts.ready` upstream so the measured font matches what's
 * rendered on screen (not a fallback metric).
 *
 * Falls back to `fontSize × 0.72` on errors.
 *
 * ⚠️ This is NOT the cap-height, despite the name it has carried since the
 * first version: the scan runs past the baseline, and it catches the round
 * letter's overshoot — the « C » of MTNC dips 2,56 px below the baseline at a
 * 160 px font, so the value comes back ~3,3 % over the real band. The
 * horizontal layout, which SIZES a visible rectangle against the capitals,
 * uses `measureCapAscentPx` instead (2026-08-24). This one is kept for the
 * vertical-mobile pull, whose halving is calibrated on it and must not move by
 * a pixel (demande Alexandre) — there it only estimates leading, where a
 * couple of pixels are noise.
 */
export function measureCapHeightPx(el: HTMLElement): number {
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
export function measureSideBearings(
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

/**
 * Cap-height proper: from the top of the capitals DOWN TO THE BASELINE, in CSS
 * pixels at `el`'s current font size. Nothing under the baseline counts.
 *
 * That last clause is the whole point, and it is what `measureCapHeightPx`
 * gets wrong: a round capital overshoots the baseline (« C » of MTNC, 2,56 px
 * at a 160 px font) and an alpha scan of the full ink box swallows it. A slot
 * built on that value stands 3,8 px taller than the letters it is supposed to
 * substitute for, and centring spreads the excess — 3,4 px of it above the
 * caps (retour Alexandre, 2026-08-24 : « il dépasse sur le haut »).
 *
 * `actualBoundingBoxAscent` is the rasterizer's own ink ascent, free of the
 * antialiasing fringe an alpha threshold picks up. But it is the ascent of
 * the TALLEST glyph of the string it is given — and the « C » overshoots the
 * cap line at the TOP just as it does at the bottom. Measured on 'ALXMTNC',
 * the value came back 116,96 px for 114,24 px of flat capitals at a 160 px
 * Helvetica Neue Bold (Chrome, 2026-11-07): with the bottom pinned on the
 * baseline by `measureCapBandShiftPx`, the whole 2,7 px surplus stuck out
 * ABOVE the letters (retour Alexandre, photo-splash-fix.png). The 2026-08-24
 * fix had removed the bottom overshoot and kept the top one.
 *
 * Hence 'H': the typographic definition of the cap height, flat top, flat
 * foot — the line the eye draws across A, L, X, M, T, N. Never measure a
 * string containing a round or pointed capital (C, O, G, S, V…).
 *
 * And the PAINTED height, not the metric one. The rasterizer grid-fits the
 * outline: at a 120 px font on a 2x screen, the metric says 171,36 device
 * pixels and the page paints 172,3 — a full row more, which reads as the
 * letters standing taller than the photo. So 'H' is drawn on a canvas at the
 * REAL device size (font size × devicePixelRatio, baseline on a whole row)
 * and its rows are counted, the top partial row by its coverage. Checked
 * against screenshots of the DOM (Chrome, 2026-11-07): same coverage to the
 * hundredth at 2x, under half a pixel apart at 1x — both round to the same
 * row. The result is rounded to the device grid by `fitSlotToCapBand`.
 * Falls back on `actualBoundingBoxAscent`, then on `fontSize × 0.72`.
 */
export function measureCapAscentPx(el: HTMLElement): number {
  const style = window.getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return 0;

  const dpr = window.devicePixelRatio || 1;
  const px = fontSize * dpr;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(px * 1.2);
  canvas.height = Math.ceil(px * 1.5);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fontSize * 0.72;

  ctx.font = `${style.fontWeight} ${px}px ${style.fontFamily}`;
  ctx.textBaseline = 'alphabetic';
  const metric = ctx.measureText('H').actualBoundingBoxAscent / dpr;
  const fallback =
    Number.isFinite(metric) && metric > 0 ? metric : fontSize * 0.72;

  const baseline = Math.round(px * 1.25);
  ctx.fillStyle = '#000';
  ctx.fillText('H', Math.round(px * 0.1), baseline);
  const { data, width } = ctx.getImageData(0, 0, canvas.width, baseline);

  // Topmost row with ink, and how much of it is inked (max alpha across the
  // row: the flat top of the H spans whole pixels, so its max IS its coverage).
  for (let y = 0; y < baseline; y++) {
    let cover = 0;
    for (let x = 0; x < width; x++) {
      cover = Math.max(cover, data[(y * width + x) * 4 + 3]);
    }
    if (cover > 4) {
      const painted = (baseline - y - 1 + cover / 255) / dpr;
      // Garde-fou : un rendu qui s'écarte de plus de 2 px écran de la
      // métrique n'est pas la bonne fonte (repli pas encore remplacé).
      return Math.abs(painted - fallback) * dpr <= 2 ? painted : fallback;
    }
  }
  return fallback;
}

/** Baseline of `el`'s line, in viewport CSS px, as the LAYOUT ENGINE places it. */
function readBaselineY(el: HTMLElement): number {
  const probe = document.createElement('span');
  probe.style.cssText =
    'display:inline-block;width:0;height:0;vertical-align:baseline';
  el.appendChild(probe);
  const y = probe.getBoundingClientRect().top;
  probe.remove();
  return y;
}

/**
 * Seat the horizontal slot EXACTLY in the band of the capitals: its top on the
 * cap line, its bottom on the baseline, to the screen pixel. Returns the slot
 * height actually applied (device-pixel snapped), which the glyph reuses.
 *
 * Three things stood in the way, each one measured, each one paid:
 *
 * 1. The row is `items-center`, so the browser centres the slot on the LINE
 *    BOX of ALX / MTNC (`lineHeight: 1`). The baseline does not sit in its
 *    middle: Helvetica's ascent + descent exceed the em, and the cap band ends
 *    up a hair below the box centre (~2 px at a 160 px font). Centred, the
 *    slot overhung the caps at the top (retour Alexandre, 2026-08-24).
 *
 * 2. The cap HEIGHT must come from a flat capital (`measureCapAscentPx`, 'H'):
 *    the « C » overshoots the cap line by 2,7 px at 160 px (2026-11-07).
 *
 * 3. TEXT IS PAINTED ON A ROUNDED BASELINE, BOXES ARE NOT. Chrome draws the
 *    glyphs with their baseline snapped to a whole CSS pixel, while the slot
 *    box keeps its fractional position. Measured on the painted pixels
 *    (Chrome, 1867×1011 @2x, 2026-11-07): layout baseline 565,5 px, letters
 *    painted down to 566, photo stopping at 565 — the whole photo 2 screen
 *    pixels too high, top over the cap line and a band of air under it
 *    (retour Alexandre, Screenshot 2026-11-07 at 19.23.52). Every metric said
 *    « aligned »: only the pixels told the truth.
 *    The fix does not guess which way an engine rounds: it removes the
 *    fraction. The row is nudged by `position: relative; top` (< 0,5 px, the
 *    row already is `relative`) until the layout baseline lands ON a whole CSS
 *    pixel — there is nothing left to round, in Chrome, Safari or Firefox.
 *    Then the cap height is snapped to the device-pixel grid, and the slot is
 *    moved (opposing margins, footprint unchanged) so that its bottom sits on
 *    that baseline: top and bottom both fall on device-pixel edges, no
 *    antialiased half row of photo or background at either line.
 *
 * The baseline is asked to the LAYOUT ENGINE (zero-sized inline-block probe),
 * never derived from font tables: canvas `fontBoundingBox*` disagree across
 * engines. Everything runs in one synchronous pass, before any paint.
 */
export function fitSlotToCapBand(
  row: HTMLElement,
  letters: HTMLElement,
  slot: HTMLElement,
  capH: number
): number {
  const dpr = window.devicePixelRatio || 1;
  const height = Math.max(1, Math.round(capH * dpr)) / dpr;
  slot.style.height = `${height}px`;
  slot.style.marginTop = '';
  slot.style.marginBottom = '';

  row.style.top = '0px';
  const rawBaseline = readBaselineY(letters);
  if (!Number.isFinite(rawBaseline)) return height;
  row.style.top = `${Math.round(rawBaseline) - rawBaseline}px`;

  const baseline = readBaselineY(letters);
  const shift = baseline - height - slot.getBoundingClientRect().top;

  // Garde-fou : au-delà d'un quart de cap, la mesure est aberrante (fonte pas
  // encore posée, élément hors flux) — mieux vaut le centrage qu'un slot
  // expédié ailleurs.
  if (Math.abs(shift) <= capH / 4) {
    slot.style.marginTop = `${shift}px`;
    slot.style.marginBottom = `${-shift}px`;
  }
  return height;
}
