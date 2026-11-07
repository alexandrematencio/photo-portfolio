import { useEffect, type RefObject } from 'react';
import type GsapDefault from 'gsap';
import { NAV_LINKS } from '@/lib/site/nav';
import type { HeroRefs } from './refs';
import {
  FADE_FAST_DURATION,
  GLYPH_INITIAL,
  GLYPH_TARGET,
  HEADER_HEIGHT,
  MORPH_SLOW_DURATION,
  NAV_FONT_INITIAL,
  NAV_FONT_TARGET,
  PAD_RIGHT,
  pageGutter,
} from './constants';

type Gsap = typeof GsapDefault;

/**
 * Le scroll-morph : le hero centré devient la nav-bar au défilement (timeline
 * GSAP pinnée au spacer, `scrub`). Branché seulement une fois l'entrée finie
 * (`entranceDone`). Sorti de HomeHero.tsx tel quel (audit 1.6) : appelé à la
 * place de l'effet, il garde son rang parmi les effets du composant.
 */
export function useScrollMorph(
  { sectionRef, logoBlockRef, nameRef, photoRef, navItemsRef, arrowRef, spacerRef }: HeroRefs,
  morphRef: RefObject<{ gsap: Gsap; tl: gsap.core.Timeline; bg: string } | null>,
  reducedMotion: boolean,
  entranceDone: boolean
) {
  useEffect(() => {
    const section = sectionRef.current;
    // Le fond opaque du hero ne sert qu'à masquer la galerie remontée dans
    // le bas de l'écran (spacer à 67svh). En mouvement réduit il n'y a pas
    // de timeline pour le fondre : on le retire, sinon la galerie reste
    // cachée.
    if (reducedMotion) {
      // Pas de fondu : le fond opaque cacherait la galerie, et le spacer
      // court laisserait la phrase d'auteur monter dans le hero. On rend
      // le plein écran d'avant.
      if (section) {
        section.style.backgroundColor = 'transparent';
        section.style.pointerEvents = 'none';
      }
      if (spacerRef.current) spacerRef.current.style.height = '100svh';
      return;
    }
    if (spacerRef.current) spacerRef.current.style.height = '';
    // GATED behind the entrance: this scroll-morph timeline does
    // `fromTo({x:0,y:0,scale:1}, ...)` on the nav items with ScrollTrigger
    // scrub, which would forcibly set those properties to 0 at scroll-progress
    // 0 and clobber the entrance transforms. Wait until entrance is settled.
    if (!entranceDone) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([gsapModule, stModule]) => {
        if (cancelled) return;
        const gsap = gsapModule.default ?? gsapModule;
        const ScrollTrigger =
          (stModule as { ScrollTrigger?: typeof import('gsap/ScrollTrigger').ScrollTrigger }).ScrollTrigger ??
          stModule.default;
        gsap.registerPlugin(ScrollTrigger);

        const ease = 'power3.out'; // cubic-bezier natural ease-out

        // Capture des rects initiales (sans transform), centrées dans le hero
        const capture = (el: HTMLElement) => {
          const t = el.style.transform;
          el.style.transform = '';
          const rect = el.getBoundingClientRect();
          el.style.transform = t;
          return rect;
        };

        const navInit = navItemsRef.current.map((el) => (el ? capture(el) : null));

        const logoTargetScale = GLYPH_TARGET / GLYPH_INITIAL;
        const navTargetScale = NAV_FONT_TARGET / NAV_FONT_INITIAL;

        // Pour les calculs de spacing horizontal, on utilise la largeur VISIBLE
        // du logo (le glyph seul = GLYPH_TARGET 28px) — PAS la largeur du bloc
        // entier, élargi par la ligne « PHOTOGRAPHY » qui fond en route. Sinon
        // l'espacement diffère du SiteHeader des autres pages qui n'a que le glyph.
        const logoVisibleWidth = GLYPH_TARGET;
        const navTargetWidths = navInit.map((init) =>
          init ? init.width * navTargetScale : 0
        );

        const totalContentWidth =
          logoVisibleWidth + navTargetWidths.reduce((a, b) => a + b, 0);
        const padLeft = pageGutter();
        const availableWidth = window.innerWidth - padLeft - PAD_RIGHT;
        const itemGap = (availableWidth - totalContentWidth) / NAV_LINKS.length;

        const targetLeftFor = (i: number) => {
          let cursor = padLeft + logoVisibleWidth + itemGap;
          for (let j = 0; j < i; j++) {
            cursor += navTargetWidths[j] + itemGap;
          }
          return cursor;
        };
        const targetCenterXFor = (i: number) =>
          targetLeftFor(i) + navTargetWidths[i] / 2;
        const navTargetY = HEADER_HEIGHT / 2;

        // Timeline unique pinnée au spacer.
        // - pin: true → la page est "trappée" pendant N vh de scroll
        // - scrub : lag entre scroll et progression de l'animation (= feel "slow/luxe")
        // - Pendant le pin, la gallery ne peut pas entrer dans le viewport.
        //
        // Pin range mobile 90vh / desktop 105vh : sur mobile, un swipe pouce
        // couvre ~200-400px ; à 30vh (~230px) le morph se jouait en UN swipe et
        // paraissait instantané. À 90vh (~690px) il faut ~3 swipes — feel
        // délibéré et immersif, l'utilisateur "tire" la page pour révéler la galerie.
        // Le static glyph fade-in (autre useEffect) utilise les mêmes fractions
        // (0.9 / 1.05) pour que le crossfade reste calé au pin end.
        //
        // Note mobile : sur iOS/Android le viewport se redimensionne au scroll
        // (collapse address-bar) et `logoInit.top` capturé au mount devient périmé.
        // Le static glyph CSS-ancré à top:18 prend le relais via crossfade — donc
        // même si la math GSAP dérive vers la fin du morph, la position finale
        // visible reste solide. C'est ce qui nous permet de pousser le pin range
        // mobile aussi loin sans craindre le drift.
        const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
        const pinEnd = isMobileViewport ? '+=90vh' : '+=105vh';

        // Le spacer ne fait plus que 67svh : le bas de l'écran contient déjà
        // le début de la galerie. Ce fond, de la couleur du papier, le cache
        // tant que le hero est ouvert et disparaît sur la course du pin —
        // au moment où le hero est replié, Selected Works est un tiers plus
        // haut qu'avec un spacer plein écran. On fond la couleur vers sa
        // propre valeur à alpha 0 (pas vers `transparent`, qui passe par
        // le noir). `pointer-events` suit : tant que le fond couvre, il
        // avale les clics ; une fois parti, la galerie redevient cliquable.
        const section = sectionRef.current!;
        const computedBg = getComputedStyle(section).backgroundColor;
        const clearBg = computedBg.startsWith('rgba')
          ? computedBg.replace(/[\d.]+\)$/, '0)')
          : computedBg.replace('rgb(', 'rgba(').replace(')', ', 0)');
        section.style.pointerEvents = 'auto';

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: spacerRef.current,
            start: 'top top',
            pin: true,
            pinSpacing: true,
            scrub: isMobileViewport ? 1 : 2,
            end: pinEnd,
            invalidateOnRefresh: true,
          },
        });

        tl.to(
          section,
          {
            backgroundColor: clearBg,
            ease: 'none',
            duration: 1,
            onUpdate: () => {
              section.style.pointerEvents = tl.progress() > 0.98 ? 'none' : 'auto';
            },
          },
          0
        );

        // Fades RAPIDES (photo-profile + nom + down-arrow vanishent ensemble, vite).
        //
        // ⚠️ `autoAlpha` et JAMAIS `opacity` : le hero est un overlay
        // `fixed inset-0` qui ne part JAMAIS (il est seulement rendu
        // transparent). Or `opacity: 0` ne retire pas un élément du hit-test —
        // ces éléments restaient donc cliquables, invisibles, par-dessus la
        // galerie tout le reste de la page. Bugs réels payés : la boîte de la
        // photo de profil (192 × 128 px mesurés au centre exact du viewport)
        // volait le curseur — son `pointerenter` pose `cursor: none` pour
        // l'effet loupe, sans rien afficher en échange — avalait les clics sur
        // les photos de la curation, et son `touch-action: none` empêchait le
        // défilement au doigt commencé en plein centre de l'écran ; la flèche
        // du bas restait un bouton cliquable qui renvoyait au début de la
        // galerie. `autoAlpha` pose `visibility: hidden` à l'opacité 0 exacte
        // (et la retire dès qu'elle repasse au-dessus, en remontant) : les
        // éléments deviennent inertes précisément quand ils deviennent
        // invisibles.
        tl.to(
          arrowRef.current,
          { autoAlpha: 0, y: 10, ease: 'power2.out', duration: FADE_FAST_DURATION },
          0
        );
        tl.to(
          photoRef.current,
          { autoAlpha: 0, scale: 0.5, ease: 'power2.in', duration: FADE_FAST_DURATION },
          0
        );
        tl.to(
          nameRef.current,
          { autoAlpha: 0, ease: 'power2.in', duration: FADE_FAST_DURATION },
          0
        );

        // Morph LENT : logo (vers top-left) + nav-items (vers full-width space-between).
        // Durée 1 = toute la timeline. Couplé au scrub, le déploiement est plus lent que les fades.
        //
        // x / y en function getters : avec `invalidateOnRefresh: true`, GSAP appelle ces
        // fonctions à chaque refresh (resize, viewport change, mobile address-bar collapse).
        // Sans ça, `logoInit.top` capturé au mount devient périmé et le glyph atterrit ailleurs
        // que top:18px sur mobile.
        const getLogoDx = () => {
          const init = capture(logoBlockRef.current!);
          const glyphOffset = (init.width - GLYPH_INITIAL) / 2;
          return pageGutter() - glyphOffset * logoTargetScale - init.left;
        };
        const getLogoDy = () => {
          const init = capture(logoBlockRef.current!);
          const targetTop = (HEADER_HEIGHT - GLYPH_TARGET) / 2;
          return targetTop - init.top;
        };

        tl.fromTo(
          logoBlockRef.current,
          { x: 0, y: 0, scale: 1, transformOrigin: '0 0' },
          {
            x: getLogoDx,
            y: getLogoDy,
            scale: logoTargetScale,
            transformOrigin: '0 0',
            ease,
            duration: MORPH_SLOW_DURATION,
          },
          0
        );

        // Fade out the morphing block before it "lands". On mobile, the GSAP
        // landing position is unreliable (viewport mutates during scroll, refresh
        // events lag), so we make sure the morphing element is invisible by the
        // time it'd hit its drifted target. The static glyph (CSS-anchored) takes
        // over as the visible element at top:18 / left: page gutter.
        // autoAlpha, même raison que les fades ci-dessus : ce bloc est
        // `pointer-events-auto` et resterait un obstacle invisible en haut au
        // centre de l'écran une fois fondu.
        tl.to(
          logoBlockRef.current,
          { autoAlpha: 0, ease: 'power2.in', duration: 0.3 },
          0.7
        );

        // En mobile, la nav stack est cachée (display:none → offsetWidth = 0) :
        // on skip la morph des items pour éviter des calculs sur des éléments invisibles.
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (!isMobile) {
          navItemsRef.current.forEach((item, i) => {
            if (!item) return;
            const init = navInit[i];
            if (!init) return;
            const dx = targetCenterXFor(i) - (init.left + init.width / 2);
            const dy = navTargetY - (init.top + init.height / 2);

            tl.fromTo(
              item,
              { x: 0, y: 0, scale: 1, transformOrigin: '50% 50%' },
              {
                x: dx,
                y: dy,
                scale: navTargetScale,
                transformOrigin: '50% 50%',
                ease,
                duration: MORPH_SLOW_DURATION,
              },
              0
            );
          });
        }

        // Late-binding hygiene: this morph only binds AFTER the splash entrance
        // (~5 s on a cold load), by which point fonts and the first gallery
        // images have likely shifted the layout since the trigger geometry was
        // first measured. Recompute now so start/end and progress are read from
        // the settled layout against the current (top, on the splash-play path)
        // scroll position.
        ScrollTrigger.refresh();
        morphRef.current = { gsap, tl, bg: computedBg };

        cleanup = () => {
          morphRef.current = null;
          // On ne tue QUE notre timeline + son scrollTrigger.
          // `kill(true)` = revert : enlève le wrapper <pin-spacer> que GSAP a inséré
          // autour du spacer et restaure le DOM original. Sans le `true`, React
          // crashe au unmount avec "removeChild: node is not a child of this node"
          // parce qu'il essaie de retirer le spacer dont GSAP a changé le parent.
          tl.scrollTrigger?.kill(true);
          tl.kill();
          section.style.pointerEvents = '';
        };
      }
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion, entranceDone, sectionRef, logoBlockRef, nameRef, photoRef, navItemsRef, arrowRef, spacerRef, morphRef]);
}
