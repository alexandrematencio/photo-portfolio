import type { RefObject } from 'react';

/** Les éléments du hero que les hooks animent — les refs de `HomeHero`, stables. */
export type HeroRefs = {
  sectionRef: RefObject<HTMLDivElement | null>;
  logoBlockRef: RefObject<HTMLDivElement | null>;
  nameRef: RefObject<HTMLParagraphElement | null>;
  photoRef: RefObject<HTMLDivElement | null>;
  navItemsRef: RefObject<(HTMLElement | null)[]>;
  arrowRef: RefObject<HTMLButtonElement | null>;
  spacerRef: RefObject<HTMLDivElement | null>;
  staticGlyphRef: RefObject<HTMLDivElement | null>;
};
