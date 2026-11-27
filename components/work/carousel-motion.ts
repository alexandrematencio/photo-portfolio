/**
 * Carrousels 3D de /work. Mécanique adaptée de « On-Scroll 3D Carousel », Codrops
 * (https://github.com/codrops/3DCarousel, licence MIT, © Codrops). Écarts à la démo et raisons :
 * doc/plans/2026-11-27_PLAN_work-carrousel-3d.md §0.
 */
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, Observer, SplitText);

/** Réglages de mouvement. Les changer ici, nulle part ailleurs. */
export const WORK_MOTION = {
  scroll: { turn: 90, tilt: 3, cardTilt: 10, ease: 'sine.inOut' }, // démo : ±90°, ±3°, ±10°
  springs: { spread: 0.05, maxSpread: 120, lean: 0.006, maxLean: 12, stiffness: 120, damping: 14 }, // démo : max 180 px et 20°
  drag: { spin: 0.12, smoothing: 0.6, inertia: 0.35, minimum: 4 }, // = démo
  open: { total: 1.2, flipAt: 0, flip: 0.56, throughAt: 0.26, through: 0.94, gridAt: 0.7 },
  close: { gridOut: 0.25, ringAt: 0.15, ring: 0.6 },
  grid: { depth: 100, duration: 0.4, stagger: 0.1, max: 12 },
} as const;

export type WorkMotion = {
  /** Conteneur de défilement (`[data-scroll-container]`). */
  scroller: HTMLElement;
  scenes: HTMLElement[];
  /** Vrai : un album s'ouvre, est ouvert ou se ferme. Plus de ressort, plus de glisser. */
  setLocked(locked: boolean): void;
  destroy(): void;
};

const reducedMotion = () => !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

type Spring = { value: number; velocity: number };

/**
 * Ressort masse-ressort intégré à la main (démo : `createSpeedSprings`) : la vitesse écarte
 * (`spread`) et penche (`lean`). `apply` pose les valeurs ; il n'est rappelé qu'au repos
 * (valeurs à 0) puis plus du tout.
 */
function createSpeedSprings(apply: (spread: number, lean: number) => void) {
  const S = WORK_MOTION.springs;
  const springs: Record<'spread' | 'lean', Spring> = {
    spread: { value: 0, velocity: 0 },
    lean: { value: 0, velocity: 0 },
  };
  let atRest = true;
  return (speed: number, dt: number) => {
    const targets = {
      spread: Math.min(Math.abs(speed) * S.spread, S.maxSpread),
      lean: gsap.utils.clamp(-S.maxLean, S.maxLean, -speed * S.lean),
    };
    let moving = false;
    (Object.keys(springs) as ('spread' | 'lean')[]).forEach((key) => {
      const sp = springs[key];
      sp.velocity += (S.stiffness * (targets[key] - sp.value) - S.damping * sp.velocity) * dt;
      sp.value += sp.velocity * dt;
      if (Math.abs(targets[key] - sp.value) > 0.01 || Math.abs(sp.velocity) > 0.01) moving = true;
    });
    if (!moving && atRest) return;
    atRest = !moving;
    if (atRest) springs.spread.value = springs.lean.value = 0;
    apply(springs.spread.value, springs.lean.value);
  };
}

/** Défilement : l'anneau tourne de +turn à −turn pendant que la scène traverse l'écran. */
function bindScroll(scene: HTMLElement, scroller: HTMLElement): ScrollTrigger | undefined {
  const ring = scene.querySelector<HTMLElement>('[data-ring]');
  const cards = scene.querySelectorAll('[data-card]');
  if (!ring) return;
  const { turn, tilt, cardTilt, ease } = WORK_MOTION.scroll;
  const tl = gsap.timeline({
    defaults: { ease },
    scrollTrigger: { trigger: scene, scroller, start: 'top bottom', end: 'bottom top', scrub: true },
  });
  tl.fromTo(ring, { rotationY: turn }, { rotationY: -turn }, 0)
    .fromTo(ring, { rotationZ: tilt, rotationX: tilt }, { rotationZ: -tilt, rotationX: -tilt }, 0)
    .fromTo(cards, { rotationZ: cardTilt }, { rotationZ: -cardTilt, ease: 'none' }, 0);
  return tl.scrollTrigger;
}

export function bindWorkCarousels(root: HTMLElement): WorkMotion | null {
  const scroller = root.closest<HTMLElement>('[data-scroll-container]');
  if (!scroller) return null;
  const scenes = [...root.querySelectorAll<HTMLElement>('[data-scene]')];
  const reduced = reducedMotion();
  let locked = false;

  const cleanups: (() => void)[] = [];
  const splits: SplitText[] = [];
  const triggers = new Map<HTMLElement, ScrollTrigger>();

  const ctx = gsap.context(() => {
    // ── 3a. Défilement + titre ────────────────────────────────────────────────
    if (!reduced) {
      scenes.forEach((scene) => {
        const st = bindScroll(scene, scroller);
        if (st) triggers.set(scene, st);
        const span = scene.querySelector<HTMLElement>('[data-split]');
        if (span) {
          const split = SplitText.create(span, { type: 'words, chars', charsClass: 'char' });
          splits.push(split);
          gsap.fromTo(
            split.chars,
            { autoAlpha: 0 },
            {
              autoAlpha: 1,
              duration: 0.02,
              stagger: { each: 0.04 },
              scrollTrigger: {
                trigger: scene,
                scroller,
                start: 'top center',
                toggleActions: 'play none none reverse',
              },
            },
          );
        }
      });
    }
  }, root);

  // ── 3e. Anneaux lointains masqués (jamais démontés) ─────────────────────────
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const ring = e.target.querySelector<HTMLElement>('[data-ring]');
        if (ring) ring.style.display = e.isIntersecting ? '' : 'none';
      }
    },
    { root: scroller, rootMargin: '100% 0px 100% 0px' },
  );
  scenes.forEach((s) => io.observe(s));
  cleanups.push(() => {
    io.disconnect();
    scenes.forEach((s) => {
      const ring = s.querySelector<HTMLElement>('[data-ring]');
      if (ring) ring.style.display = '';
    });
  });

  // ── 3c. Glisser ─────────────────────────────────────────────────────────────
  const D = WORK_MOTION.drag;
  type Spin = { value: number; target: number; to?: (v: number) => void };
  const spins = new Map<HTMLElement, Spin>();
  const spinOf = (ring: HTMLElement): Spin => {
    let s = spins.get(ring);
    if (!s) {
      const created: Spin = { value: 0, target: 0 };
      if (!reduced) {
        created.to = gsap.quickTo(created, 'value', {
          duration: D.smoothing,
          ease: 'power3',
          onUpdate: () => ring.style.setProperty('--spin', `${created.value}deg`),
        }) as (v: number) => void;
      }
      s = created;
      spins.set(ring, s);
    }
    return s;
  };
  const turnBy = (ring: HTMLElement, degrees: number) => {
    const s = spinOf(ring);
    s.target += degrees;
    if (s.to) s.to(s.target);
    else {
      s.value = s.target;
      ring.style.setProperty('--spin', `${s.value}deg`);
    }
  };

  let dragged: HTMLElement | null = null;
  let wasDrag = false;
  const prevTouchAction = root.style.touchAction;
  root.style.touchAction = 'pan-y';

  const observer = Observer.create({
    target: root,
    type: 'pointer,touch',
    lockAxis: true, // un geste parti de côté tourne l'anneau, un geste vertical défile la page
    dragMinimum: D.minimum,
    onPress: (self) => {
      const t = self.event.target as Element | null;
      dragged = t?.closest<HTMLElement>('[data-scene]')?.querySelector<HTMLElement>('[data-ring]') ?? null;
    },
    onDragStart: () => {
      if (!locked) root.classList.add('is-dragging');
    },
    onChangeX: (self) => {
      if (!dragged || locked) return;
      wasDrag = true;
      turnBy(dragged, self.deltaX * D.spin);
    },
    onDragEnd: (self) => {
      root.classList.remove('is-dragging');
      if (!dragged || locked || reduced) return;
      if (Math.abs(self.velocityX) > Math.abs(self.velocityY)) turnBy(dragged, self.velocityX * D.inertia * D.spin);
    },
  });

  // Un glisser n'est jamais un clic. `stopPropagation`, jamais `stopImmediatePropagation` (§3.6 inv. 5).
  const onPointerDown = () => {
    wasDrag = false;
  };
  const onClickCapture = (e: MouseEvent) => {
    if (!wasDrag) return;
    e.preventDefault();
    e.stopPropagation();
    wasDrag = false;
  };
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('click', onClickCapture, true);

  // Clavier : ← / → dans une scène = tourner d'une carte (équivalent du glisser).
  const onKeyDown = (e: KeyboardEvent) => {
    if (locked || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const scene = (e.target as Element | null)?.closest<HTMLElement>('[data-scene]');
    const ring = scene?.querySelector<HTMLElement>('[data-ring]');
    if (!ring) return;
    const n = ring.querySelectorAll('[data-cell]').length || 1;
    e.preventDefault();
    turnBy(ring, (e.key === 'ArrowRight' ? 1 : -1) * (360 / n));
  };
  root.addEventListener('keydown', onKeyDown);

  // ── 3b. Ressorts de vitesse (pas en mouvement réduit) ───────────────────────
  let tick: gsap.TickerCallback | null = null;
  if (!reduced) {
    const applied = new Set<HTMLElement>();
    const scrollSpring = createSpeedSprings((spread, lean) => {
      // Seules les scènes dont l'anneau est affiché ET actif reçoivent les variables.
      const nowActive = new Set<HTMLElement>();
      scenes.forEach((s) => {
        const ring = s.querySelector<HTMLElement>('[data-ring]');
        if (triggers.get(s)?.isActive && ring && ring.style.display !== 'none') nowActive.add(s);
      });
      applied.forEach((s) => {
        if (!nowActive.has(s)) {
          s.style.removeProperty('--spread');
          s.style.removeProperty('--lean');
        }
      });
      nowActive.forEach((s) => {
        s.style.setProperty('--spread', `${spread}px`);
        s.style.setProperty('--lean', `${lean}deg`);
      });
      applied.clear();
      nowActive.forEach((s) => applied.add(s));
    });
    const ringSprings = new Map<HTMLElement, ReturnType<typeof createSpeedSprings>>();
    const lastSpin = new Map<HTMLElement, number>();
    let lastTop = scroller.scrollTop;

    tick = (_time, deltaTime) => {
      const dt = Math.min(deltaTime / 1000, 1 / 30); // plafonné : un onglet en veille ne catapulte pas les ressorts
      const top = scroller.scrollTop;
      const speed = deltaTime > 0 ? ((top - lastTop) / deltaTime) * 1000 : 0; // px/s
      lastTop = top;
      scrollSpring(locked ? 0 : speed, dt);
      spins.forEach((s, ring) => {
        let spring = ringSprings.get(ring);
        if (!spring) {
          spring = createSpeedSprings((spread, lean) => {
            ring.style.setProperty('--spin-spread', `${spread}px`);
            ring.style.setProperty('--spin-lean', `${lean}deg`);
          });
          ringSprings.set(ring, spring);
        }
        const last = lastSpin.get(ring) ?? s.value;
        lastSpin.set(ring, s.value);
        const degPerSecond = deltaTime > 0 ? ((s.value - last) / deltaTime) * 1000 : 0;
        // Tourner de +1° revient à défiler vers le haut de 1 / spin px.
        spring(locked ? 0 : -degPerSecond / D.spin, dt);
      });
    };
    gsap.ticker.add(tick);
  }

  // Le layout a bougé depuis le montage (§3.6 inv. 4).
  ScrollTrigger.refresh();

  return {
    scroller,
    scenes,
    setLocked(v) {
      locked = v;
      if (v) root.classList.remove('is-dragging');
    },
    destroy() {
      if (tick) gsap.ticker.remove(tick);
      observer.kill();
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('click', onClickCapture, true);
      root.removeEventListener('keydown', onKeyDown);
      root.style.touchAction = prevTouchAction;
      root.classList.remove('is-dragging');
      cleanups.forEach((fn) => fn());
      splits.forEach((s) => s.revert());
      ctx.revert();
      scenes.forEach((s) => {
        s.style.removeProperty('--spread');
        s.style.removeProperty('--lean');
        const ring = s.querySelector<HTMLElement>('[data-ring]');
        ring?.style.removeProperty('--spin');
        ring?.style.removeProperty('--spin-spread');
        ring?.style.removeProperty('--spin-lean');
      });
    },
  };
}
