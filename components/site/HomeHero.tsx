'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { GlyphLogo } from './GlyphLogo';
import { MagnifierHeading } from './MagnifierHeading';
import { useReducedMotion } from '@/lib/motion/useReducedMotion';
import { asset } from '@/lib/utils/asset';

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/flat-gallery', label: 'Flat Gallery' },
  { href: '/contact', label: 'Contact' },
  { href: '/hire-me', label: 'Hire me' },
];

// Cibles de la transition (≈ taille finale du header)
const GLYPH_INITIAL = 108;
const GLYPH_TARGET = 28;
const NAV_FONT_INITIAL = 32;
// 32 = pas de shrink, les nav-items gardent leur taille initiale (32px)
// en mode nav-bar fixed top. Seule la position morphe (vertical → horizontal).
const NAV_FONT_TARGET = 32;
const HEADER_HEIGHT = 64; // h-16 — identique sur toutes les pages (SiteHeader)
// Nav-bar final = pleine largeur, items space-between
const PAD_LEFT = 32;
const PAD_RIGHT = 64;

// Timing du morph dans la timeline (en "unités" timeline, 1 = full)
// La durée totale en SECONDES est gérée par le `scrub` du ScrollTrigger.
const FADE_FAST_DURATION = 0.15; // photo-profile, arrow, nom : vanish vite
const MORPH_SLOW_DURATION = 1; // logo + nav items : morph lent, prend toute la timeline

export function HomeHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const logoBlockRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const navItemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const arrowRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const navBgRef = useRef<HTMLDivElement>(null);
  // CSS-anchored landing glyph. Independent of the GSAP morph math so that even
  // when the morph drifts (mobile address-bar resize invalidates viewport-relative
  // measurements), the glyph the user actually sees is locked at top:18 / left:32.
  const staticGlyphRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Bande opaque h-14/h-16 en haut du viewport + static landing glyph. Au scroll,
  // l'opacité des deux passe de 0 → 1 sur la pin range (20vh mobile / 70vh desktop),
  // au même rythme que le morph dépose le glyph en haut-gauche. Le glyph statique
  // est CSS-ancré (top:18px, left:32px) — pas de math viewport-relative, donc
  // immune au mobile address-bar resize qui faisait dériver la morph.
  useEffect(() => {
    const bg = navBgRef.current;
    const glyph = staticGlyphRef.current;
    if (!bg && !glyph) return;
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const fadeRange = isMobile ? 0.2 : 0.7;
    let raf = 0;
    const update = () => {
      const p = Math.min(1, window.scrollY / (window.innerHeight * fadeRange));
      if (bg) bg.style.opacity = String(p);
      if (glyph) glyph.style.opacity = String(p);
      raf = 0;
    };
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Photo profil — magnifier hover effect.
  // Layer 1 (default, always visible)   : alex-profile-pic-default.jpg
  // Layer 2 (revealed under the cursor) : alex-profile-pic-hover-reveal.jpg
  // The cursor itself is hidden inside the photo box; a 96 px circular clip on
  // layer 2 follows the pointer, "peeking" through the default image.
  const profileSrcDefault = asset('/img/alex-profile-pic-default.jpg');
  const profileSrcReveal = asset('/img/alex-profile-pic-hover-reveal.jpg');
  const profileAlt = 'Portrait of A. Matencio';
  const photoBoxRef = useRef<HTMLDivElement>(null);
  const revealLayerRef = useRef<HTMLDivElement>(null);

  // Bind the magnifier reveal — purely DOM mutation (no React re-render) for 60 fps.
  // Respects prefers-reduced-motion: in that case, the reveal layer stays hidden.
  useEffect(() => {
    if (reducedMotion) return;
    const box = photoBoxRef.current;
    const reveal = revealLayerRef.current;
    if (!box || !reveal) return;

    // Desktop: 74 px radius (~148 px diameter, = mobile / 1.3).
    // Mobile: 96 px radius — finger-driven engagement needs more reveal area.
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const RADIUS = isMobile ? 96 : 74;
    let raf = 0;
    let pendingX = 0;
    let pendingY = 0;

    const apply = () => {
      reveal.style.clipPath = `circle(${RADIUS}px at ${pendingX}px ${pendingY}px)`;
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      const rect = box.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const onEnter = (e: PointerEvent) => {
      // Mouse: hide the cursor (the revealed disc takes over).
      // Touch/pen: nothing to hide — the finger is the cursor.
      if (e.pointerType === 'mouse') box.style.cursor = 'none';
      onMove(e);
    };

    const onLeave = () => {
      box.style.cursor = '';
      reveal.style.clipPath = 'circle(0px at 50% 50%)';
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    // iOS long-press → context menu (Save image, Copy, Share). Kill it on this box.
    const onContextMenu = (e: Event) => e.preventDefault();

    box.addEventListener('pointerenter', onEnter);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerleave', onLeave);
    box.addEventListener('pointercancel', onLeave);
    box.addEventListener('contextmenu', onContextMenu);

    return () => {
      box.removeEventListener('pointerenter', onEnter);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      box.removeEventListener('pointercancel', onLeave);
      box.removeEventListener('contextmenu', onContextMenu);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;

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

        const logoInit = capture(logoBlockRef.current!);
        const navInit = navItemsRef.current.map((el) => (el ? capture(el) : null));

        const logoTargetScale = GLYPH_TARGET / GLYPH_INITIAL;
        const navTargetScale = NAV_FONT_TARGET / NAV_FONT_INITIAL;

        // Pour les calculs de spacing horizontal, on utilise la largeur VISIBLE
        // du logo (le glyph seul = GLYPH_TARGET 28px) — PAS la largeur du bloc
        // entier qui inclut le MagnifierHeading invisible (~330px). Sinon
        // l'espacement diffère du SiteHeader des autres pages qui n'a que le glyph.
        const logoVisibleWidth = GLYPH_TARGET;
        const navTargetWidths = navInit.map((init) =>
          init ? init.width * navTargetScale : 0
        );

        const totalContentWidth =
          logoVisibleWidth + navTargetWidths.reduce((a, b) => a + b, 0);
        const availableWidth = window.innerWidth - PAD_LEFT - PAD_RIGHT;
        const itemGap = (availableWidth - totalContentWidth) / NAV_LINKS.length;

        const logoTargetTop = (HEADER_HEIGHT - GLYPH_TARGET) / 2;
        // Le block logo contient glyph + MagnifierHeading. Le MagnifierHeading
        // a un spacer invisible plus large que le glyph → le glyph est centré
        // dans un bloc plus large. Compensation pour que le GLYPH (pas le block)
        // atterrisse à PAD_LEFT exactement.
        const glyphOffsetInBlock = (logoInit.width - GLYPH_INITIAL) / 2;
        const logoDx =
          PAD_LEFT - glyphOffsetInBlock * logoTargetScale - logoInit.left;
        const logoDy = logoTargetTop - logoInit.top;

        const targetLeftFor = (i: number) => {
          let cursor = PAD_LEFT + logoVisibleWidth + itemGap;
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
        // - scrub: 2 → l'animation suit le scroll avec 2s de lag (= feel "slow/luxe")
        // - Pendant le pin, la gallery ne peut pas entrer dans le viewport.
        //
        // Mobile : pin range RACCOURCI à 20vh. Sur iOS/Android, le viewport se
        // redimensionne au scroll (collapse address-bar) et `logoInit.top` capturé
        // au mount devient périmé. Avec un long pin (70vh), le glyph "atterrit"
        // visiblement plus bas que la nav-bar cible. En raccourcissant le pin,
        // le morph se complete avant que l'écart soit perceptible — et de toute
        // façon, sur mobile la nav est cachée donc seul le logo bouge.
        const isMobileViewport = window.matchMedia('(max-width: 768px)').matches;
        const pinEnd = isMobileViewport ? '+=20vh' : '+=70vh';

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: spacerRef.current,
            start: 'top top',
            pin: true,
            pinSpacing: true,
            scrub: isMobileViewport ? 0.5 : 2,
            end: pinEnd,
            invalidateOnRefresh: true,
          },
        });

        // Fades RAPIDES (photo-profile + nom + down-arrow vanishent ensemble, vite).
        tl.to(
          arrowRef.current,
          { opacity: 0, y: 10, ease: 'power2.out', duration: FADE_FAST_DURATION },
          0
        );
        tl.to(
          photoRef.current,
          { opacity: 0, scale: 0.5, ease: 'power2.in', duration: FADE_FAST_DURATION },
          0
        );
        tl.to(
          nameRef.current,
          { opacity: 0, ease: 'power2.in', duration: FADE_FAST_DURATION },
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
          return PAD_LEFT - glyphOffset * logoTargetScale - init.left;
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
        // over as the visible element at top:18/left:32.
        tl.to(
          logoBlockRef.current,
          { opacity: 0, ease: 'power2.in', duration: 0.3 },
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

        cleanup = () => {
          // On ne tue QUE notre timeline + son scrollTrigger.
          // `kill(true)` = revert : enlève le wrapper <pin-spacer> que GSAP a inséré
          // autour du spacer et restaure le DOM original. Sans le `true`, React
          // crashe au unmount avec "removeChild: node is not a child of this node"
          // parce qu'il essaie de retirer le spacer dont GSAP a changé le parent.
          tl.scrollTrigger?.kill(true);
          tl.kill();
        };
      }
    );

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [reducedMotion]);

  return (
    <>
      {/*
        Bande nav-bar opaque en haut du viewport. Fade-in au scroll → après le
        morph, aucune photo ne peut être visible dans la zone du nav-bar.
        z-20 < z-30 (items HomeHero) : la bande est BEHIND les items mais
        DEVANT les photos de la gallery.
      */}
      <div
        ref={navBgRef}
        aria-hidden
        className="fixed inset-x-0 top-0 h-16 z-20 bg-[var(--color-bg)] pointer-events-none"
        style={{ opacity: 0 }}
      />

      {/*
        Static landing glyph — CSS-anchored at (32, 18). The morphing logoBlock
        targets this position via GSAP transforms, but on mobile the math drifts
        when the address-bar resizes mid-scroll. This element doesn't move: pure
        CSS `fixed top: 18 / left: 32`. Fade-in matches the pin range so it's at
        opacity 1 exactly when the morphing block fades to 0. Aria-hidden — the
        accessible navigation lives in <SiteHeader /> (other pages) and
        <MobileMenu /> (mobile burger drawer).
      */}
      <div
        ref={staticGlyphRef}
        aria-hidden
        className="fixed top-[18px] left-[32px] z-50 pointer-events-none"
        style={{ opacity: 0 }}
      >
        <GlyphLogo size={GLYPH_TARGET} title="A. Matencio" />
      </div>

      {/* Overlay plein-écran fixed : items centrés (flex), animés par GSAP. */}
      <div
        ref={sectionRef}
        aria-label="Home"
        className="fixed inset-0 z-30 pointer-events-none flex flex-col items-center justify-center gap-16 px-4 py-12 md:py-16 text-center"
      >
        <div
          ref={logoBlockRef}
          className="pointer-events-auto flex flex-col items-center gap-3"
        >
          <GlyphLogo size={GLYPH_INITIAL} title="A. Matencio" />
          <MagnifierHeading
            ref={nameRef}
            short="ALXMTNC"
            long="Alexandre Matencio"
            className="font-bold text-2xl md:text-[26px] tracking-[-0.04em] text-[var(--color-fg)] mt-1"
            longClassName="font-bold text-[36px] md:text-[40px] tracking-[-0.04em] text-[var(--color-fg)]"
          />
        </div>

        <div
          ref={photoRef}
          className="pointer-events-none relative size-56 md:size-64 overflow-hidden bg-[var(--color-bg-elev)]"
        >
          {/* Inner box owns the pointer events. On touch devices we also kill native
              gestures that would interfere with the reveal: native scroll under the finger,
              long-press → context menu (Save image / Copy / Share), text selection, image drag. */}
          <div
            ref={photoBoxRef}
            className="pointer-events-auto absolute inset-0 select-none"
            style={{
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
            }}
          >
            {/* Default image — always visible */}
            <Image
              src={profileSrcDefault}
              alt={profileAlt}
              fill
              sizes="(max-width: 768px) 14rem, 16rem"
              className="object-cover pointer-events-none"
              draggable={false}
              priority
            />
            {/* Reveal image — clipped to a circle that follows the pointer.
                Initial clip-path collapsed to 0 px so nothing shows until pointer enters. */}
            <div
              ref={revealLayerRef}
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{ clipPath: 'circle(0px at 50% 50%)' }}
            >
              <Image
                src={profileSrcReveal}
                alt=""
                fill
                sizes="(max-width: 768px) 14rem, 16rem"
                className="object-cover"
                draggable={false}
              />
            </div>
          </div>
        </div>

        <nav
          aria-label="Main navigation"
          className="pointer-events-auto hidden md:flex flex-col items-center gap-2 md:gap-3"
        >
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              ref={(el) => {
                navItemsRef.current[i] = el;
              }}
              className="text-2xl md:text-[32px] font-bold tracking-[-0.04em] text-[var(--color-fg)] leading-none transition-opacity hover:opacity-60 motion-reduce:transition-none whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile burger + drawer ont migré dans <MobileMenu /> au niveau layout. */}

      {/* Down-arrow fixed bottom (opacité gérée par la timeline) */}
      <div
        ref={arrowRef}
        aria-hidden
        className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
      >
        <ChevronDown
          size={26}
          strokeWidth={1.5}
          className="scroll-cue text-[var(--color-fg)]"
        />
      </div>

      {/*
        Spacer pinned : pendant 70vh de scroll, la page est "trappée" et la
        timeline GSAP joue. Photos de la gallery ne peuvent pas entrer dans
        le viewport tant que le pin n'est pas relâché → zéro overlap garanti.

        Le wrapper externe est un buffer React-stable : GSAP insère son
        <pin-spacer> à L'INTÉRIEUR. Au unmount, React supprime ce wrapper
        et tous ses descendants (y compris les ajouts GSAP), évitant un
        crash "removeChild: node is not a child of this node".
      */}
      <div aria-hidden>
        <div
          ref={spacerRef}
          className="h-[100svh] pointer-events-none"
        />
      </div>
    </>
  );
}
