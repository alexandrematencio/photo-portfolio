import {
  fitSlotToCapBand,
  measureCapAscentPx,
  measureCapHeightPx,
  measureSideBearings,
} from './measure';
import type { SplashTimeline } from './constants';

type Gsap = (typeof import('gsap'))['default'];

/**
 * Construit la timeline du splash sur ses éléments déjà montés : mesures,
 * cycle de photos Willem, glyph, vol vers le glyph du hero, fondu. Tout est
 * synchrone : la tête de lecture est encore à 0 au retour. `revealAt` est
 * l'instant où le glyph se pose (TRAVEL_END), que le scrub doit connaître.
 */
export function buildSplashTimeline({
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
}: {
  gsap: Gsap;
  overlay: HTMLDivElement;
  left: HTMLSpanElement;
  right: HTMLSpanElement;
  slot: HTMLDivElement;
  glyphWrap: HTMLDivElement;
  photos: HTMLDivElement[];
  verticalMobile: boolean;
  finish: () => void;
  dispatchReveal: (skip: boolean) => void;
}): { tl: SplashTimeline; revealAt: number } {
  // Letter height drives slot + glyph sizing.
  // - Horizontal (default): STRICT cap-height — top of the capitals down
  //   to the BASELINE, and not a pixel further (`measureCapAscentPx`).
  //   Slot reads as the exact visible extent of the letters — a 4ᵗʰ
  //   "letter substitute". Measuring the full ink box instead let the
  //   « C » overshoot inflate it, and the slot overhung the caps
  //   (2026-08-24).
  // - Vertical mobile (verticalMobile && < md): full line-box height
  //   (= font-size, since lineHeight:1). Slot occupies the same vertical
  //   real estate as a line of text, so it reads "as tall as the letters"
  //   in the stacked ALX / slot / MTNC column. UNCHANGED by the above —
  //   this branch never read a cap-height for its slot.
  const isVerticalMobile =
    verticalMobile && window.matchMedia('(max-width: 768px)').matches;
  let letterH = isVerticalMobile
    ? left.getBoundingClientRect().height
    : measureCapAscentPx(left);

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

    // Même correction, sur l'autre axe : le slot se cale AU PIXEL ÉCRAN
    // sur la bande de capitales — haut sur la ligne des capitales, bas sur
    // la ligne de base PEINTE (cf. fitSlotToCapBand : la rangée glisse de
    // moins d'un demi-pixel pour que la ligne de base tombe sur un pixel
    // entier). La hauteur renvoyée, arrondie au pixel écran, sert aussi au
    // glyph. Appliqué AVANT la mesure de slotRect, comme les marges
    // horizontales, pour que le glyph reste posé sur le slot rendu.
    const row = slot.parentElement as HTMLElement;
    letterH = fitSlotToCapBand(row, left, slot, letterH);
  } else {
    slot.style.marginLeft = '';
    slot.style.marginRight = '';

    // Vertical mobile: HALVE the air between ALX and MTNC (demande
    // Alexandre, 2026-08-24). Stacked, the two words drift apart far more
    // than they do side by side — and the CSS gap is the smaller half of
    // the reason. With `lineHeight: 1`, each line box still carries its own
    // leading: Inter leaves ~0.137em of empty band above the caps and as
    // much below the baseline. At a 95 px font that is 13 px per side, on
    // top of the 8 px gap — 42 px of air where the horizontal layout has
    // 16 px, so "ALXMTNC" stops reading as one word at slot height 0.
    //
    // The pull is MEASURED, never written down: the leading scales with the
    // font size, which is a clamp() (80 → 130 px). A hardcoded negative
    // margin would halve the air at one viewport width and overshoot at
    // another. It sits on the SLOT rather than on the letters so the slot's
    // own height — the animated property — stays untouched, and it is
    // applied BEFORE slotRect is measured, so the glyph still lands centred
    // on the slot. It only ever eats leading (10.5 px of the 21 px
    // available per side), never a glyph.
    const row = slot.parentElement as HTMLElement | null;
    const rowGapPx = row
      ? parseFloat(window.getComputedStyle(row).rowGap) || 0
      : 0;
    const leadingPx = Math.max(0, (letterH - measureCapHeightPx(left)) / 2);
    const pullPx = (leadingPx + rowGapPx) / 2;
    slot.style.marginTop = `${-pullPx}px`;
    slot.style.marginBottom = `${-pullPx}px`;
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

    // ALX se retire DEVANT le glyph au lieu de se faire traverser
    // (demande Alexandre, 2026-08-24). Le fondu reste — c'est un départ
    // qui glisse, pas un remplacement.
    //
    // Le rapport 2:1 est obtenu par la DISTANCE, pas par la durée : même
    // instant de départ, même durée, même `power3.inOut` que le vol, mais
    // deux fois son déplacement vertical. Deux courbes identiques mises à
    // l'échelle l'une de l'autre ont un rapport de vitesse constant à
    // CHAQUE frame — 2:1 du début à la fin, sans qu'aucun des deux ne
    // rattrape l'autre en cours de route. Raccourcir la durée de moitié
    // donnerait bien 2× la vitesse moyenne, mais sur la même distance :
    // ALX s'arrêterait à mi-vol et le glyph le rejoindrait à l'arrivée.
    //
    // Le déplacement est DÉRIVÉ de `dy`, jamais écrit : c'est la seule
    // façon d'être proportionné au trajet réel, qui n'a pas la même
    // ampleur d'une largeur d'écran à l'autre (mesuré : ~130 px de
    // remontée en 430 px de large, ~210 px en 1440). Le signe suit celui
    // du vol, donc ALX s'écarte TOUJOURS dans le sens du glyph, jamais
    // au-devant de lui — et si un jour le glyph du hero passait SOUS la
    // composition du splash, ALX descendrait avec, sans une ligne de plus.
    //
    // Le fondu de 0,4 s coupe la glissade à ~37 % de sa course : ALX a
    // parcouru 51 px (mobile) / 85 px (desktop) quand il disparaît. Le
    // reste de la course n'est jamais vu, mais il maintient la vitesse
    // constante jusqu'au bout — un tween écourté à la durée du fondu
    // finirait par un freinage visible.
    const ALX_CLEAR_RATIO = 2;
    tl.to(
      left,
      {
        y: dy * ALX_CLEAR_RATIO,
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

  // 6 — Overlay background fades out so HomeHero (already mounted
  // and now mid-entrance) takes over visually. The splash glyph fades
  // with the overlay — by then it sits on top of the hero's own centered
  // glyph, so the handoff reads as one continuous element.
  tl.to(overlay, { opacity: 0, duration: 0.4, ease: 'power2.in' }, TRAVEL_END);

  return { tl, revealAt: TRAVEL_END };
}
