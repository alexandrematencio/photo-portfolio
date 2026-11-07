import { useEffect, type MouseEvent, type RefObject } from 'react';
import type GsapDefault from 'gsap';
import type { useRouter } from 'next/navigation';
import { isExternal } from '@/lib/site/sites';
import {
  announcePageArrival,
  boxOf,
  ghostOf,
  measureNavBar,
  slideOut,
} from '@/lib/site/page-transition';
import { smoothstep } from '@/lib/motion/rubber';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/utils/scrollLock';
import type { HeroRefs } from './refs';
import { MENU_LEAVE_DURATION, MENU_LEAVE_SAMPLES, centerOf } from './constants';

type Gsap = typeof GsapDefault;

/** Sorti de HomeHero.tsx tel quel (audit 1.6). Rend le gestionnaire de clic des liens du menu. */
export function useMenuLeave(
  { sectionRef, logoBlockRef, nameRef, photoRef, navItemsRef, arrowRef, staticGlyphRef }: HeroRefs,
  morphRef: RefObject<{ gsap: Gsap; tl: gsap.core.Timeline; bg: string } | null>,
  leavingRef: RefObject<boolean>,
  router: ReturnType<typeof useRouter>
) {
  // ────────────────────────────────────────────────────────────────────────
  // DÉPART PAR LE MENU DU HERO (2026-10-15). Le hero MONTE en nav-bar — c'est
  // le scroll-morph, joué tout seul au lieu d'être scrubbé — et, DANS LE MÊME
  // TEMPS, la nouvelle page entre par la droite en poussant la photo vers la
  // gauche (lib/site/page-transition.ts).
  //
  // La navigation part dès le clic. Or la home démonte le hero au commit :
  // tout ce qui bouge est donc une COPIE posée sur <body>. Le morph n'est pas
  // rejoué sur les copies — on l'ÉCHANTILLONNE : la timeline est parcourue
  // une fois, synchrone, et chaque cible y laisse ses styles inline à chaque
  // pas ; la copie les relit image par image. Même courbe, mêmes fondus, au
  // pixel près, sans timeline vivante sur un arbre démonté.
  //
  // La nav-bar de la page d'arrivée reste masquée jusqu'à l'atterrissage des
  // copies : sinon les libellés seraient en double pendant le vol.
  //
  // Repli sur la navigation simple quand le morph n'est pas encore branché
  // (entrée en cours), en mouvement réduit, et pour un clic modifié.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(
    () => () => {
      if (leavingRef.current) unlockBodyScroll();
    },
    [leavingRef]
  );

  const leaveFromMenu = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Lien vers un autre site (le journal) : chargement complet, pas de vol.
    if (isExternal(href)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const morph = morphRef.current;
    const section = sectionRef.current;
    if (!morph || !section) return;
    e.preventDefault();
    if (leavingRef.current) return;
    leavingRef.current = true;
    lockBodyScroll();

    const { gsap, tl, bg } = morph;
    // Le scroll ne pilote plus la timeline. `false` : le pin reste en place,
    // rien ne bouge dans la mise en page.
    tl.scrollTrigger?.disable(false);

    // Où la timeline pose les libellés, contre où la nav-bar de la page de
    // destination les attend — son item actif est surligné, ce qui décale la
    // rangée (cf. `measureNavBar`). L'écart est rattrapé le long du morph,
    // pas en fin de course : à l'arrivée, nav-bar et copies coïncident.
    const bar = measureNavBar(href);
    // Une COPIE du tableau : au démontage du hero, React remet chaque
    // référence à `null` dans le tableau même — en plein vol.
    const items = [...navItemsRef.current];
    const staticGlyph = staticGlyphRef.current;
    const p0 = tl.progress();
    tl.progress(1);
    const landed = items.map((el) => (el && el.offsetParent !== null ? boxOf(el) : null));
    tl.progress(p0);
    const zero = { x: 0, y: 0 };
    const shift = items.map((_, i) => {
      const from = landed[i];
      const to = bar?.nav[i];
      if (!from || !to) return zero;
      const a = centerOf(from);
      const b = centerOf(to);
      return { x: b.x - a.x, y: b.y - a.y };
    });
    const staticSvg = staticGlyph?.querySelector('svg');
    const glyphShift =
      bar && staticSvg
        ? {
            x: bar.glyph.left - staticSvg.getBoundingClientRect().left,
            y: bar.glyph.top - staticSvg.getBoundingClientRect().top,
          }
        : zero;

    // ── Échantillonnage du morph, de p0 à 1. ──
    const targets = ([logoBlockRef.current, nameRef.current, ...items] as (HTMLElement | null)[])
      .filter((el): el is HTMLElement => el !== null);
    const frames = targets.map(() => [] as { t: string; o: string; v: string }[]);
    for (let n = 0; n < MENU_LEAVE_SAMPLES; n++) {
      tl.progress(p0 + ((1 - p0) * n) / (MENU_LEAVE_SAMPLES - 1));
      targets.forEach((el, j) =>
        frames[j].push({ t: el.style.transform, o: el.style.opacity, v: el.style.visibility })
      );
    }
    tl.progress(p0);

    // ── Les copies, à l'état du moment. ──
    // Le hero entier, fond transparent : les cibles s'y retrouvent par leur
    // rang dans l'arbre (cloneNode garde l'ordre).
    const all = Array.from(section.querySelectorAll<HTMLElement>('*'));
    const menu = ghostOf(section, 60);
    menu.style.backgroundColor = 'transparent';
    const twins = Array.from(menu.querySelectorAll<HTMLElement>('*'));
    const twin = (el: HTMLElement) => twins[all.indexOf(el)];
    const photo = photoRef.current;
    if (photo) twin(photo).style.visibility = 'hidden';
    // Le libellé cliqué est SURVOLÉ : CursorInvert l'a rendu transparent en
    // style inline (il dessine son négatif par-dessus). La copie, elle, n'est
    // plus survolée — elle reprend son encre.
    for (const el of items) if (el) twin(el).style.color = '';
    const glyphGhost = staticGlyph ? ghostOf(staticGlyph, 61) : null;

    // La photo : sa propre copie, SOUS la page qui arrive — c'est elle qui la
    // pousse. À son opacité du moment (le visiteur a pu commencer à défiler).
    const arrival = announcePageArrival(href, 1);
    let arrived = false;
    let landedMenu = false;
    if (photo && getComputedStyle(photo).visibility !== 'hidden') {
      const ghost = ghostOf(photo, 40);
      ghost.style.opacity = getComputedStyle(photo).opacity;
      arrival.onArrive.push(() => slideOut(ghost, -1));
      // Filet : la page d'arrivée n'est jamais venue.
      window.setTimeout(() => ghost.remove(), 5000);
    }

    // L'original ne montre plus que son fond papier : il cache la galerie
    // jusqu'au commit, et personne n'a demandé à la voir.
    section.style.backgroundColor = bg;
    for (const el of [...targets, photo, arrowRef.current, staticGlyph]) {
      if (el) el.style.visibility = 'hidden';
    }

    // La nav-bar de la page d'arrivée attend les copies.
    const header = document.querySelector<HTMLElement>('header[data-top-bar]');
    if (header) header.style.visibility = 'hidden';
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (header) header.style.visibility = '';
      menu.remove();
      glyphGhost?.remove();
    };
    // On ne rend la main à la nav-bar qu'une fois les DEUX faits acquis : les
    // copies posées, et la page d'arrivée montée (en dev, le commit peut
    // tomber après l'atterrissage).
    arrival.onArrive.push(() => {
      arrived = true;
      if (landedMenu) finish();
    });
    window.setTimeout(finish, 5000);

    const span = 1 - p0;
    const proxy = { k: 0 };
    gsap.to(proxy, {
      k: 1,
      // `none` : chaque tween échantillonné porte déjà son propre ease
      // (`power3.out` pour le morph) — c'est le geste du scroll, sans scroll.
      ease: 'none',
      duration: MENU_LEAVE_DURATION * Math.max(0.35, span),
      onUpdate: () => {
        const { k } = proxy;
        const n = Math.round(k * (MENU_LEAVE_SAMPLES - 1));
        targets.forEach((el, j) => {
          const copy = twin(el);
          const f = frames[j][n];
          const i = (items as (HTMLElement | null)[]).indexOf(el);
          const d = i >= 0 ? shift[i] : zero;
          copy.style.transform = `translate(${d.x * k}px, ${d.y * k}px) ${f.t}`;
          copy.style.opacity = f.o;
          copy.style.visibility = f.v;
        });
        // Le glyph d'atterrissage suit d'habitude `scrollY` : ici, la
        // progression. Mêmes fractions que son écouteur de scroll.
        if (glyphGhost) {
          glyphGhost.style.opacity = String(smoothstep(0.85, 1, p0 + span * k));
          glyphGhost.style.transform = `translate(${glyphShift.x * k}px, ${glyphShift.y * k}px)`;
        }
      },
      onComplete: () => {
        landedMenu = true;
        if (arrived) finish();
      },
    });

    // Dès le clic : la page charge et entre pendant que le menu monte.
    router.push(href);
  };

  return leaveFromMenu;
}
