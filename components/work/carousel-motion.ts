/**
 * Carrousels 3D de /work. Mécanique adaptée de « On-Scroll 3D Carousel », Codrops
 * (https://github.com/codrops/3DCarousel, licence MIT, © Codrops). Écarts à la démo et raisons :
 * doc/plans/2026-11-27_PLAN_work-carrousel-3d.md §0.
 */
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { FIRST_SCENE_MIN, ringFit } from './carousel-geometry';
import { afterPageArrival } from '@/lib/site/page-transition';
import { grainMask, rowsOf } from './grain-reveal';
import { bindSceneStep, restTopOf, type SceneStep } from './scene-step';

gsap.registerPlugin(ScrollTrigger, Observer, SplitText);

/** Réglages de mouvement. Les changer ici, nulle part ailleurs. */
export const WORK_MOTION = {
  scroll: { turn: 90, tilt: 3, cardTilt: 10, ease: 'sine.inOut' }, // démo : ±90°, ±3°, ±10°
  springs: { spread: 0.05, maxSpread: 120, lean: 0.006, maxLean: 12, stiffness: 120, damping: 14 }, // démo : max 180 px et 20°
  drag: { spin: 0.12, smoothing: 0.6, inertia: 0.35, minimum: 4 }, // = démo
  // Ouverture (≈ 1 s) : l'anneau recule en pivotant et se dissout photo par photo, l'album
  // monte dessous en fondu. Jamais de traversée de caméra (perspective 900 px) : c'était le flash.
  // Entrée de la première scène : l'anneau monte du bas de l'écran, `lead` secondes AVANT la fin du centrage de la page.
  enter: { lead: 0.5, duration: 1.08, ease: 'power3.out', titleAt: 0.46, title: 0.42 },
  open: { recenter: 0.6, spin: -100, recede: 260, tiltBack: 8, ring: 0.8, fadeAt: 0.1, fade: 0.4, fadeStagger: 0.035, albumAt: 0.3, album: 0.4, gridAt: 0.45 },
  close: { gridOut: 0.25, ringAt: 0.12, ring: 0.7, fade: 0.35, fadeStagger: 0.03 },
  // Grille : front de grains de gauche à droite (grain-reveal.ts). colStep = décalage entre deux vignettes
  // d'une rangée, rowStep = entre deux rangées ; settle = léger recul de l'image qui se pose (1,5 %).
  // TOUTES les vignettes visibles à l'ouverture jouent le reveal (plus de plafond) ; les autres le jouent
  // quand elles entrent à l'écran en défilant (`inset` = de combien elles doivent être entrées, en px).
  grid: { duration: 0.5, colStep: 0.07, rowStep: 0.16, settle: 1.015, inset: 48 },
} as const;

export type WorkMotion = {
  /** Conteneur de défilement (`[data-scroll-container]`). */
  scroller: HTMLElement;
  scenes: HTMLElement[];
  /** Vrai : un album s'ouvre, est ouvert ou se ferme. Plus de ressort, plus de glisser. */
  setLocked(locked: boolean): void;
  /** Ouverture d’un album (≈ 1,1 s). Rend la timeline, ou `null` si rien ne s'anime (mouvement
   *  réduit, arrivée par adresse) : `onComplete` est alors déjà appelé. */
  open(index: number, o: AlbumFlight & { instant?: boolean }): gsap.core.Timeline | null;
  /** Fermeture (≈ 0,8 s). Même contrat. */
  close(index: number, o: AlbumFlight): gsap.core.Timeline | null;
  /** Pas-à-pas de scène en scène (molette, doigt, ↑ ↓) et menu de gauche : `goTo`, scène active. */
  step: SceneStep;
  destroy(): void;
};

type AlbumFlight = {
  /** `[data-album]` : le conteneur de l'album (fondu). */
  album: HTMLElement;
  /** La grille de l'album : ses enfants sont les vignettes. */
  grid: HTMLElement;
  onComplete: () => void;
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

/**
 * Défilement : l'anneau tourne de +turn à −turn pendant que la scène traverse l'écran.
 * La PREMIÈRE scène n'a pas d'avant : elle part de face (0°) à sa position de repos (`firstRest`,
 * 0 sauf écran très bas), et ne joue que la seconde moitié du parcours (même pente au départ que
 * le milieu des autres : `sine.out` prolonge `sine.inOut`).
 */
function bindScroll(
  scene: HTMLElement,
  scroller: HTMLElement,
  firstRest: (() => number) | null,
): ScrollTrigger | undefined {
  const first = firstRest !== null;
  const ring = scene.querySelector<HTMLElement>('[data-ring]');
  const cards = scene.querySelectorAll('[data-card]');
  if (!ring) return;
  const { turn, tilt, cardTilt, ease } = WORK_MOTION.scroll;
  const tl = gsap.timeline({
    defaults: { ease: first ? 'sine.out' : ease },
    scrollTrigger: {
      trigger: scene,
      scroller,
      start: firstRest ?? 'top bottom',
      end: 'bottom top',
      scrub: true,
    },
  });
  const from = first ? 0 : 1;
  tl.fromTo(ring, { rotationY: turn * from }, { rotationY: -turn }, 0)
    .fromTo(ring, { rotationZ: tilt * from, rotationX: tilt * from }, { rotationZ: -tilt, rotationX: -tilt }, 0)
    .fromTo(cards, { rotationZ: cardTilt * from }, { rotationZ: -cardTilt, ease: 'none' }, 0);
  return tl.scrollTrigger;
}

const sceneParts = (scene: HTMLElement) => ({
  ring: scene.querySelector<HTMLElement>('[data-ring]'),
  flight: scene.querySelector<HTMLElement>('[data-flight]'),
  cards: scene.querySelectorAll<HTMLElement>('[data-card]'),
  chars: scene.querySelectorAll<HTMLElement>('.char'),
});

/**
 * Faces des cartes (photo + dos), du plus loin au plus près de l'œil. On fond les FEUILLES,
 * jamais `[data-card]` : une opacité < 1 sur un parent `preserve-3d` l'aplatit (dos visible).
 * La profondeur se lit à la largeur affichée : plus petite = plus loin.
 */
function facesBackToFront(scene: HTMLElement): HTMLElement[][] {
  return [...scene.querySelectorAll<HTMLElement>('[data-card]')]
    .map((card) => ({ faces: [...card.children] as HTMLElement[], w: card.getBoundingClientRect().width }))
    .sort((a, b) => a.w - b.w)
    .map((c) => c.faces);
}

/** Vignettes de la grille : celles que l'écran montre à l'ouverture, et le reste (sous la ligne de flottaison). */
function gridItems(grid: HTMLElement) {
  const all = [...grid.children] as HTMLElement[];
  const vh = window.innerHeight;
  const visible = all.filter((el) => el.getBoundingClientRect().top < vh);
  return { all, visible, rest: all.filter((el) => !visible.includes(el)) };
}

/** Distance de chaque vignette au centre de la grille. */
function distancesFromCenter(items: HTMLElement[], grid: HTMLElement) {
  const g = grid.getBoundingClientRect();
  const cx = g.left + g.width / 2;
  const cy = g.top + Math.min(g.height, window.innerHeight) / 2;
  const d = items.map((el) => {
    const r = el.getBoundingClientRect();
    return Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
  });
  return { d, dMax: Math.max(...d, 1) };
}

/** Pose sur `tl`, à l'instant `at`, le reveal en grain d'UNE vignette. */
function grainReveal(tl: gsap.core.Timeline, el: HTMLElement, at: number) {
  const G = WORK_MOTION.grid;
  tl.call(() => el.classList.add('is-grain-revealing'), undefined, at)
    .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, ease: 'none' }, at)
    .fromTo(
      el,
      { '--grain-x': '100%', scale: G.settle },
      {
        '--grain-x': '0%',
        scale: 1,
        duration: G.duration,
        ease: 'power2.out',
        onComplete: () => {
          el.classList.remove('is-grain-revealing');
          gsap.set(el, { clearProps: '--grain-x,scale' });
        },
      },
      at,
    );
}

/**
 * Les vignettes se révèlent en grain, de gauche à droite, rangée après rangée (grain-reveal.ts).
 * Rapide : la dernière vignette d'une rangée est entière ≈ 0,5 s après la première.
 */
function gridIn(items: HTMLElement[]): gsap.core.Timeline {
  const G = WORK_MOTION.grid;
  const tl = gsap.timeline();
  rowsOf(items).forEach((row, r) => row.forEach((el, c) => grainReveal(tl, el, r * G.rowStep + c * G.colStep)));
  return tl;
}

/**
 * Les vignettes sous la ligne de flottaison, cachées à l'ouverture, se révèlent à leur tour quand le
 * défilement de l'album les amène à l'écran. Plusieurs entrées dans la même passe se décalent comme à
 * l'ouverture (rangées, puis colonnes). Rend la fonction qui arrête tout (fermeture, démontage).
 */
function revealOnScroll(album: HTMLElement, items: HTMLElement[]): () => void {
  if (!items.length) return () => {};
  const G = WORK_MOTION.grid;
  const live = new Set<gsap.core.Timeline>();
  const io = new IntersectionObserver(
    (entries) => {
      const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target as HTMLElement);
      if (!entering.length) return;
      entering.forEach((el) => io.unobserve(el));
      const tl = gsap.timeline({ onComplete: () => live.delete(tl) });
      live.add(tl);
      rowsOf(entering).forEach((row, r) => row.forEach((el, c) => grainReveal(tl, el, r * G.rowStep + c * G.colStep)));
    },
    { root: album, rootMargin: `0px 0px -${G.inset}px 0px` },
  );
  items.forEach((el) => io.observe(el));
  return () => {
    io.disconnect();
    live.forEach((t) => t.progress(1)); // un reveal en cours se pose d'un coup : aucun masque ne reste
    live.clear();
  };
}

/** Sortie : du centre vers les bords, 0,25 s. */
function gridOut(grid: HTMLElement): gsap.core.Timeline {
  const { visible } = gridItems(grid);
  const { d, dMax } = distancesFromCenter(visible, grid);
  const tl = gsap.timeline();
  visible.forEach((el, k) => {
    tl.to(el, { autoAlpha: 0, z: -60, duration: WORK_MOTION.close.gridOut, ease: 'sine.in' }, (d[k] / dMax) * 0.05);
  });
  return tl;
}

/**
 * Décalage `y` MESURÉ qui met tout l'anneau sous le bas de sa scène (clippée : `overflow-clip`). La
 * perspective rapproche les cartes du fond du centre (échelle ≈ 0,6) : décaler de la hauteur de la
 * scène laisserait leur haut dépasser du cadre. On pose un décalage, on regarde la carte la plus haute,
 * et on rajoute ce qui manque. Laisse `y` posé à la valeur rendue.
 */
function distBelow(scene: HTMLElement, ring: HTMLElement): number {
  const cards = [...scene.querySelectorAll<HTMLElement>('[data-card]')];
  let d = Math.ceil(scene.offsetHeight);
  for (let i = 0; i < 4; i++) {
    gsap.set(ring, { y: d });
    const bottom = scene.getBoundingClientRect().bottom;
    const gap = 8 + bottom - Math.min(...cards.map((c) => c.getBoundingClientRect().top));
    if (gap <= 0) break;
    d += Math.ceil(gap / 0.5) + 24;
  }
  return d;
}

export function bindWorkCarousels(root: HTMLElement): WorkMotion | null {
  const scroller = root.closest<HTMLElement>('[data-scroll-container]');
  if (!scroller) return null;
  const scenes = [...root.querySelectorAll<HTMLElement>('[data-scene]')];
  const reduced = reducedMotion();
  let locked = false;
  /** `translateZ` de repos de `flight` (écrit en inline par le HTML servi) : on y revient exactement. */
  const restZ = new Map<HTMLElement, number>();
  scenes.forEach((s) => {
    const f = s.querySelector<HTMLElement>('[data-flight]');
    if (f) restZ.set(s, parseFloat(/translateZ\((-?[\d.]+)px\)/.exec(f.style.transform)?.[1] ?? '0'));
  });

  const cleanups: (() => void)[] = [];

  // ── La première scène remplit ce qui reste sous l'en-tête : l'anneau y est centré à l'œil,
  // pas au milieu d'une page dont le haut est pris par le titre. Le HTML serveur porte une
  // hauteur approchée (CarouselScene) ; ici la mesure exacte, et à chaque redimensionnement.
  // Puis chaque anneau prend l'échelle qui le fait tenir dans SA scène et dans la largeur de l'écran
  // (`--ring-fit`, lu par la boîte `data-fit`). Le CSS sert 1, ou 0,7 sous 768 px, avant cette mesure.
  const first = scenes[0];
  const served = first?.style.height ?? '';
  const fit = () => {
    if (first) first.style.height = `${Math.max(FIRST_SCENE_MIN, scroller.clientHeight - first.offsetTop)}px`;
    const w = scroller.clientWidth;
    scenes.forEach((s) => s.style.setProperty('--ring-fit', String(ringFit(s.offsetHeight, w))));
  };
  fit();
  const ro = new ResizeObserver(() => {
    fit();
    ScrollTrigger.refresh();
  });
  ro.observe(scroller);
  cleanups.push(() => {
    ro.disconnect();
    if (first) first.style.height = served;
    scenes.forEach((s) => s.style.removeProperty('--ring-fit'));
  });

  // ── Entrée : le premier anneau monte du bas, dès que la page est centrée ────
  // Le HTML l'a posé hors champ (`data-enter`, site.css : `translate`). GSAP écrit lui-même le
  // transform de l'anneau (défilement, rotation) et neutralise alors `translate` : l'entrée passe donc
  // par `y` de GSAP, pas par la propriété CSS. Mouvement réduit : il apparaît à sa place.
  // `finishEntrance` la termine d'un coup à l'ouverture d'un album (les vols mesurent les rects).
  let entrance: gsap.core.Timeline | null = null;
  let finishEntrance: (() => void) | null = null;
  const enterRing = first?.querySelector<HTMLElement>('[data-ring]');
  if (first && enterRing && first.hasAttribute('data-enter')) {
    const title = first.querySelector<HTMLElement>('[data-scene-title]');
    const settle = () => {
      first.removeAttribute('data-enter');
      gsap.set(enterRing, { y: 0 });
      if (title) gsap.set(title, { clearProps: 'opacity' });
    };
    if (reduced) {
      settle();
    } else {
      const E = WORK_MOTION.enter;
      const dist = () => distBelow(first, enterRing);
      gsap.set(enterRing, { y: dist() });
      let cancelWait = () => {};
      cancelWait = afterPageArrival(() => {
        entrance = gsap.timeline({ onComplete: settle });
        entrance.fromTo(enterRing, { y: dist() }, { y: 0, duration: E.duration, ease: E.ease }, 0);
        if (title) {
          entrance.fromTo(title, { opacity: 0 }, { opacity: 1, duration: E.title, ease: 'none' }, E.titleAt);
        }
      }, E.lead);
      finishEntrance = () => {
        cancelWait();
        entrance?.kill();
        entrance = null;
        settle();
        finishEntrance = null;
      };
      cleanups.push(() => {
        cancelWait();
        entrance?.kill();
        // Délié en cours de route (mode strict : lié, délié, relié) : état de départ remis, sinon la
        // liaison suivante trouverait un anneau déjà en place et ne jouerait rien.
        if (first.hasAttribute('data-enter')) {
          gsap.set(enterRing, { y: dist() });
          if (title) gsap.set(title, { clearProps: 'opacity' });
        }
        entrance = null;
        finishEntrance = null;
      });
    }
  }
  const splits: SplitText[] = [];
  const triggers = new Map<HTMLElement, ScrollTrigger>();

  const ctx = gsap.context(() => {
    // ── 3a. Défilement + titre ────────────────────────────────────────────────
    if (!reduced) {
      scenes.forEach((scene) => {
        const st = bindScroll(scene, scroller, scene === scenes[0] ? () => restTopOf(scenes, 0, scroller) : null);
        if (st) triggers.set(scene, st);
        const span = scene.querySelector<HTMLElement>('[data-split]');
        if (span) {
          const split = SplitText.create(span, { type: 'words, chars', charsClass: 'char' });
          splits.push(split);
          // Un coup, jamais lié à un `refresh` : un ScrollTrigger rattaché à la tween la remettait à zéro
          // (titre effacé) à chaque `ScrollTrigger.refresh()`, dont celui de la fermeture d'un album.
          const reveal = gsap.fromTo(
            split.chars,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.02, stagger: { each: 0.04 }, paused: true },
          );
          ScrollTrigger.create({ trigger: scene, scroller, start: 'top center', once: true, onEnter: () => reveal.play() });
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

  const step = bindSceneStep({ scroller, scenes, isLocked: () => locked, reduced });
  /** Arrête les reveals de la grille ouverte (fermeture, démontage). */
  let stopGrid: (() => void) | null = null;
  const endGrid = () => {
    stopGrid?.();
    stopGrid = null;
  };

  return {
    scroller,
    scenes,
    step,
    setLocked(v) {
      locked = v;
      scroller.style.overflow = v ? 'hidden' : ''; // le conteneur ne défile plus tant qu'un album est ouvert
      if (v) root.classList.remove('is-dragging');
    },
    open(index, { album, grid, onComplete, instant }) {
      const scene = scenes[index];
      const { flight, chars } = sceneParts(scene);
      finishEntrance?.(); // les vols mesurent les rects : l'anneau doit être à sa place
      endGrid();
      gsap.set(grid.children, { autoAlpha: 1 });
      if (reduced) {
        // Mouvement réduit : rien ne s'anime, tout est là.
        gsap.set(scene, { autoAlpha: 0 });
        gsap.set(album, { autoAlpha: 1 });
        onComplete();
        return null;
      }
      grid.style.setProperty('--grain-mask', grainMask());
      if (instant || !flight) {
        // Arrivée par adresse : pas de vol, mais la grille se révèle comme à l'ouverture
        // (visibles d'abord, le reste au défilement).
        const { visible, rest } = gridItems(grid);
        gsap.set([...visible, ...rest], { autoAlpha: 0 });
        gsap.set(scene, { autoAlpha: 0 });
        gsap.set(album, { autoAlpha: 1 });
        const intro = gridIn(visible);
        const stopScroll = revealOnScroll(album, rest);
        stopGrid = () => {
          intro.progress(1);
          stopScroll();
        };
        onComplete();
        return null;
      }
      const O = WORK_MOTION.open;
      const rest = restZ.get(scene) ?? 0;
      const { visible, rest: hidden } = gridItems(grid);
      gsap.set([...visible, ...hidden], { autoAlpha: 0 });
      gsap.set(album, { autoAlpha: 0 });
      stopGrid = revealOnScroll(album, hidden); // sous la ligne de flottaison : au défilement
      gsap.set(scene, { zIndex: 41 }); // l'anneau reste DEVANT l'album (z-index 40) pendant qu'il se dissout
      const faces = facesBackToFront(scene);
      const tl = gsap
        .timeline({
          onComplete: () => {
            gsap.set(scene, { autoAlpha: 0, clearProps: 'zIndex' });
            gsap.set(album, { autoAlpha: 1 });
            onComplete();
          },
        })
        .to(scroller, { scrollTop: restTopOf(scenes, index, scroller), duration: O.recenter, ease: 'power2.inOut' }, 0)
        .to(chars, { autoAlpha: 0, duration: 0.02, ease: 'none', stagger: { each: 0.015, from: 'end' } }, 0)
        // Un seul tween sur `flight` : il part en douceur et prend de l'élan en s'éloignant.
        .to(
          flight,
          { rotationY: O.spin, rotationX: O.tiltBack, z: rest - O.recede, duration: O.ring, ease: 'power2.in' },
          0,
        )
        .to(album, { autoAlpha: 1, duration: O.album, ease: 'sine.inOut' }, O.albumAt)
        .add(gridIn(visible), O.gridAt);
      // Les photos de l'anneau s'éteignent du fond vers l'avant : la plus proche part la dernière.
      faces.forEach((f, k) => tl.to(f, { autoAlpha: 0, duration: O.fade, ease: 'sine.in' }, O.fadeAt + k * O.fadeStagger));
      return tl;
    },
    close(index, { album, grid, onComplete }) {
      const scene = scenes[index];
      const { flight, cards, chars } = sceneParts(scene);
      endGrid();
      const finish = () => {
        if (flight) {
          // `clearProps` CIBLÉS, jamais 'all' (§3.7 inv. 4) ; puis le transform exact écrit par le serveur.
          gsap.set(flight, { clearProps: 'transform' });
          flight.style.transform = `translateZ(${restZ.get(scene) ?? 0}px)`;
        }
        gsap.set([scene, ...cards], { clearProps: 'zIndex,opacity,visibility' });
        gsap.set(scene.querySelectorAll('[data-card] > *'), { clearProps: 'opacity,visibility' });
        ScrollTrigger.refresh();
        gsap.set(chars, { autoAlpha: 1 });
        onComplete();
      };
      if (reduced || !flight) {
        finish();
        return null;
      }
      const C = WORK_MOTION.close;
      const ring = sceneParts(scene).ring;
      const rest = restZ.get(scene) ?? 0;
      // L'anneau n'est plus visible : on remet tout de suite le vol à sa place (celle du HTML), puis
      // l'anneau remonte du dessous comme à l'entrée de la page, au lieu de revenir en tournant.
      gsap.set(flight, { z: rest, rotationX: 0, rotationY: 0, rotationZ: 0 });
      gsap.set(scene, { zIndex: 41 });
      gsap.set(scene.querySelectorAll('[data-card] > *'), { autoAlpha: 1 });
      const below = ring ? distBelow(scene, ring) : 0;
      const tl = gsap
        .timeline({ onComplete: finish })
        .add(gridOut(grid), 0)
        .to(album, { autoAlpha: 0, duration: C.gridOut, ease: 'sine.in' }, 0)
        .set(scene, { autoAlpha: 1 }, C.ringAt);
      if (ring) tl.fromTo(ring, { y: below }, { y: 0, duration: C.ring, ease: 'power3.out' }, C.ringAt);
      tl.fromTo(
        chars,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.02, ease: 'none', stagger: { each: 0.015 } },
        C.ringAt + C.ring * 0.4,
      );
      return tl;
    },
    destroy() {
      endGrid();
      step.destroy();
      if (tick) gsap.ticker.remove(tick);
      observer.kill();
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('click', onClickCapture, true);
      root.removeEventListener('keydown', onKeyDown);
      root.style.touchAction = prevTouchAction;
      scroller.style.overflow = '';
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
