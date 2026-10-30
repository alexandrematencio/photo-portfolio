'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { colorOf, LABEL_STEPS, neighbourhood, type LabelKind, type LabelReach, type MapIndex, type MapNav } from './model';

/**
 * Le dessin de la Concept Map (Sigma, WebGL). Chargé en `ssr: false` par
 * `ConceptMapExplorer` : WebGL n'existe pas au build, et la page reste
 * entière sans lui (la liste porte la même information).
 *
 * Positions : celles du document, calculées une fois par `map:build` — aucune
 * mise en page dans le navigateur, la carte ne bouge pas d'une visite à
 * l'autre.
 *
 * Hiérarchie : l'article mène (gros, à l'encre), le mécanisme porte la
 * couleur de sa thématique, la thèse est un satellite gris. Les libellés
 * n'apparaissent qu'au zoom (`labelRenderedSizeThreshold`), sauf autour du
 * nœud survolé ou choisi.
 *
 * Zoom (2026-10-30, Alexandre : « trop sensible ») : on reprend la molette à
 * Sigma, qui multipliait le zoom par 1,7 à CHAQUE évènement — un pavé tactile
 * en envoie des dizaines par geste. Ici le défilement s'additionne en
 * exponentielle (un cran de molette ≈ ×1,2), et la caméra rejoint la cible en
 * glissant (constante de temps `ZOOM_TAU`), toujours vers le pointeur.
 *
 * Estompage : au survol, ce qui n'est pas voisin glisse vers la couleur du
 * papier en 180 ms (ease-out), et revient en 140 ms (la sortie est plus
 * courte que l'entrée). Rien sous `prefers-reduced-motion` : la bascule est
 * immédiate, la caméra ne voyage pas. Une entrée du menu survolée estompe
 * presque tout (`PREVIEW`) ; choisie, l'estompage va au bout et la caméra cadre le
 * système (`fit`).
 */

const PAPER = '#fafaf8';
const FADE_IN = 180;
const FADE_OUT = 140;
/**
 * Une entrée du menu survolée : son système s'isole, le reste se voile presque
 * entièrement ; le clic achève l'estompage. À 0,45, le reste se lisait encore
 * (« des nœuds de toutes les thématiques se dévoilent », Alexandre, 2026-10-30).
 */
const PREVIEW = 0.85;
/**
 * Le cadrage d'un système choisi : le plus près possible sans qu'aucun nœud ni
 * nom ne sorte du cadre. Les noms sont MESURÉS (ils se dessinent à droite du
 * nœud, à taille fixe) et entrent dans le calcul : pas de nom rogné. Marge de
 * 48 px — la pratique courante des « fit to selection » est d'environ 50 px —
 * et 80 en haut, où se posent l'indication de zoom et « Désélectionner ».
 * Un nom ne compte que jusqu'à 60 % de la largeur utile : au-delà (un titre
 * d'article sur téléphone), aucun zoom ne le ferait tenir, et le reste du
 * système deviendrait illisible pour lui. Sur petit écran, la marge tombe à 20.
 */
const FIT_PAD = 48;
const FIT_PAD_SMALL = 20;
const FIT_LABEL_SHARE = 0.6;
const FIT_TOP = 80;
/** Un déplacement de caméra sur place : ease-in-out, entre 0,5 et 0,75 s (Alexandre). */
const FIT_MS = 620;
/** Au-delà, les voisins d'un nœud gardent leur pastille mais pas leur libellé : on ne lirait plus rien. */
const MAX_FORCED_LABELS = 14;

const reduced = () => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function mix(hex: string, into: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
  const c = [0, 1, 2].map((i) => Math.round(p(hex, i) + (p(into, i) - p(hex, i)) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Zoom : par pixel de défilement, molette ou pavé, puis par pixel de pincement (`ctrlKey`, deltas bien plus courts). */
const WHEEL_K = 0.0018;
const PINCH_K = 0.012;
/** Un évènement ne pèse jamais plus qu'un cran franc : une molette « libre » ne fait pas sauter la carte. */
const WHEEL_CAP = 120;
/** Le glissé vers la cible : 63 % du chemin en 70 ms, le reste en freinant — sans jamais la dépasser. */
const ZOOM_TAU = 70;
/** Un cran du clavier ou du faux clavier. */
const KEY_ZOOM = 1.35;
/** Déplacement au clavier, en pixels d'écran par seconde, et le temps pour prendre (ou perdre) son allure. */
const PAN_SPEED = 620;
const PAN_TAU = 110;
const MIN_RATIO = 0.12;
const MAX_RATIO = 1.6;

export type MapGestures = { held: () => boolean; refused: (gesture: 'wheel' | 'touch') => void };
/** Le système d'une entrée du menu survolée ; `key` : l'id du nœud quand l'entrée en est un. */
export type MapPreview = { key: string; ids: Set<string> } | null;

const NODE_SIZE = { article: 13, thesis: 3.5 } as const;
const EDGE_STYLE = {
  part: { color: '#d9d5cd', size: 0.8 },
  uses: { color: '#e6e3dc', size: 0.5 },
  rhyme: { color: '#6e6960', size: 1.4 },
} as const;
const EDGE_FOCUS = '#8d887c';

export default function ConceptMapGraph({
  ix,
  visible,
  selected,
  center = 0,
  inset = 0,
  zoom = 0.7,
  sticky = false,
  labels,
  nav,
  gestures,
  preview = null,
  fit = 0,
  onSelect,
}: {
  ix: MapIndex;
  visible: Set<string>;
  selected: string | null;
  /** Change quand la sélection vient d'ailleurs (panneau, adresse) : la caméra va la chercher. */
  center?: number;
  /** Pixels masqués à droite par le panneau : le nœud cherché se pose au milieu de ce qui reste visible. */
  inset?: number;
  /** Zoom maximal quand la caméra va chercher un nœud (plus petit = plus près). */
  zoom?: number;
  /**
   * La sélection TIENT (`/concept-map`, 2026-10-30, Alexandre) : tant qu'un
   * nœud est choisi, survoler un nœud voilé ne rallume pas son système — il
   * montre seulement son nom — et cliquer dans le vide la lâche. Un nœud voilé
   * reste cliquable : il devient la sélection. Sans elle (la carte d'un
   * article), tout nœud survolé s'allume.
   */
  sticky?: boolean;
  /** Jusqu'où chaque rang garde son nom ; sans, le seuil de taille de Sigma (la carte d'un article). */
  labels?: LabelReach;
  /** Rempli au montage : les commandes du clavier et du faux clavier passent par là. */
  nav?: MutableRefObject<MapNav | null>;
  /**
   * Carte COOPÉRATIVE (`/concept-map`, 2026-10-30, Alexandre) : la molette ne
   * zoome qu'une fois la carte tenue (`held`) — ou avec ⌘/Ctrl, ou au
   * pincement — et un doigt seul fait défiler la page. `refused` : un geste
   * laissé à la page, pour qu'on dise comment s'en servir sur la carte. Sans
   * elle (la petite carte d'un article), la carte prend tous les gestes.
   */
  gestures?: MapGestures;
  /** Survolé dans le menu : allumé à moitié, par-dessus la sélection. */
  preview?: MapPreview;
  /**
   * Change quand un système est choisi (`/concept-map`) : la caméra le cadre au
   * plus près — le voisinage du nœud choisi, sinon tout ce que les filtres
   * laissent voir.
   */
  fit?: number;
  onSelect: (id: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const sigma = useRef<Sigma | null>(null);
  // L'état que lisent les reducers : des refs, pour ne pas reconstruire Sigma.
  const state = useRef({ visible, selected, hovered: null as string | null, peek: null as string | null, preview: null as MapPreview, shown: null as string | null, lit: false, around: new Set<string>(), fade: 0, kept: new Set<string>(), reach: null as Record<LabelKind, number> | null, ratio: 1 });
  const select = useRef(onSelect);
  select.current = onSelect;
  const gest = useRef(gestures);
  gest.current = gestures;
  const insetNow = useRef(inset);
  insetNow.current = inset;

  useEffect(() => {
    const container = box.current;
    if (!container) return;
    const graph = new Graph();
    for (const n of ix.view.nodes)
      graph.addNode(n.id, {
        x: n.x,
        y: n.y,
        label: n.label,
        kind: n.kind,
        color: colorOf(ix, n),
        size: n.kind === 'mechanism' ? 5 + 1.5 * (n.articles.length - 1) : NODE_SIZE[n.kind],
        zIndex: n.kind === 'article' ? 3 : n.kind === 'mechanism' ? 2 : 1,
      });
    for (const e of ix.view.edges) {
      // La suite des thèses d'un article tient dans leur ordre : un trait de plus brouillerait le dessin.
      if (e.kind === 'next' || !graph.hasNode(e.source) || !graph.hasNode(e.target) || graph.hasEdge(e.source, e.target)) continue;
      graph.addEdge(e.source, e.target, { ...EDGE_STYLE[e.kind], zIndex: e.kind === 'rhyme' ? 1 : 0 });
    }

    const s = state.current;
    const font = getComputedStyle(document.body).fontFamily;
    const renderer = new Sigma(graph, container, {
      labelFont: font,
      labelSize: 12,
      labelWeight: '600',
      labelColor: { color: '#0a0a0a' },
      // Avec `labels`, c'est le réducteur qui décide, rang par rang.
      labelRenderedSizeThreshold: labels ? 0 : 9,
      labelDensity: 0.5,
      labelGridCellSize: 140,
      zIndex: true,
      stagePadding: 48,
      minCameraRatio: MIN_RATIO,
      maxCameraRatio: MAX_RATIO,
      nodeReducer: (node, data) => {
        if (!s.visible.has(node)) return { ...data, hidden: true };
        const far = !!s.reach && !(s.ratio <= s.reach[data.kind as LabelKind]);
        const out = { ...data, highlighted: node === s.selected, label: far ? null : data.label };
        if (!s.lit || s.fade === 0) return out;
        if (s.around.has(node)) return { ...out, label: data.label, zIndex: (data.zIndex ?? 0) + 4, forceLabel: node === s.shown || s.around.size <= MAX_FORCED_LABELS };
        // Un nœud voilé sous le pointeur : il garde son voile, mais dit son nom.
        if (node === s.peek) return { ...out, color: mix(data.color, PAPER, 0.4 * s.fade), label: data.label, forceLabel: true, zIndex: 5 };
        // `out.label`, pas `data.label` : le temps du fondu, un nom que le zoom
        // tait ne doit pas reparaître (le « flash » au survol, 2026-10-30).
        return { ...out, color: mix(data.color, PAPER, 0.82 * s.fade), label: s.fade > 0.5 ? null : out.label, zIndex: 0 };
      },
      edgeReducer: (edge, data) => {
        const [a, b] = graph.extremities(edge);
        if (!s.visible.has(a) || !s.visible.has(b)) return { ...data, hidden: true };
        if (!s.lit || s.fade === 0) return data;
        if (s.around.has(a) && s.around.has(b))
          return { ...data, color: data.color === EDGE_STYLE.rhyme.color ? data.color : mix(data.color, EDGE_FOCUS, s.fade), zIndex: 2 };
        return { ...data, color: mix(data.color, PAPER, 0.85 * s.fade) };
      },
    });
    sigma.current = renderer;

    // L'estompage glisse vers sa profondeur : 1 pour un nœud survolé ou choisi,
    // `PREVIEW` pour une entrée du menu survolée. De l'aperçu au clic, il ne
    // fait que s'approfondir — le focus « s'intensifie ».
    let raf = 0;
    const lightUp = (around: Set<string> | null, depth = 1, key: string | null = null) => {
      cancelAnimationFrame(raf);
      const from = s.fade;
      const to = around ? depth : 0;
      if (around) Object.assign(s, { around, shown: key, lit: true });
      const end = () => !around && Object.assign(s, { shown: null, lit: false });
      if (reduced() || from === to) {
        s.fade = to;
        end();
        renderer.refresh({ skipIndexation: true });
        return;
      }
      const start = performance.now();
      const duration = to > from ? FADE_IN : FADE_OUT;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        s.fade = from + (to - from) * easeOut(t);
        if (t === 1) end();
        renderer.refresh({ skipIndexation: true });
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    // Qui s'allume : le nœud survolé, sinon l'entrée survolée du menu, sinon la sélection.
    const settle = () => {
      const p = s.preview;
      if (s.hovered) lightUp(neighbourhood(ix, s.hovered), 1, s.hovered);
      else if (p && p.key !== s.selected && [...p.ids].some((id) => s.visible.has(id))) lightUp(p.ids, PREVIEW);
      else if (s.selected) lightUp(s.kept, 1, s.selected);
      else lightUp(null);
    };
    (renderer as Sigma & { settle?: typeof settle }).settle = settle;

    const camera = renderer.getCamera();
    const middle = () => {
      const { width, height } = renderer.getDimensions();
      return { x: width / 2, y: height / 2 };
    };

    // Le zoom : une cible, que la caméra rejoint en glissant (log du rapport, pour une vitesse égale en rapprochant et en reculant).
    const z = { target: 1, anchor: { x: 0, y: 0 }, raf: 0, last: 0 };
    const zoomStep = (now: number) => {
      const dt = Math.min(64, now - z.last);
      z.last = now;
      const r = camera.ratio;
      const next = Math.exp(Math.log(r) + Math.log(z.target / r) * (1 - Math.exp(-dt / ZOOM_TAU)));
      const done = Math.abs(Math.log(z.target / next)) < 0.002;
      camera.setState(renderer.getViewportZoomedState(z.anchor, done ? z.target : next));
      z.raf = done ? 0 : requestAnimationFrame(zoomStep);
    };
    const zoomBy = (factor: number, anchor: { x: number; y: number }) => {
      if (!z.raf) z.target = camera.ratio;
      z.target = camera.getBoundedRatio(z.target * factor);
      z.anchor = anchor;
      if (reduced()) return camera.setState(renderer.getViewportZoomedState(anchor, z.target));
      if (!z.raf) {
        z.last = performance.now();
        z.raf = requestAnimationFrame(zoomStep);
      }
    };
    const local = (e: { clientX: number; clientY: number }) => {
      const r = container.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // La molette est entièrement à nous, prise AVANT Sigma (capture). Sigma 3.0.3
    // ne sait pas s'en abstenir : `preventSigmaDefault()` coche une copie de
    // l'évènement (`getWheelCoords`), et son propre zoom (×1,7, animé 250 ms)
    // courait en même temps que le nôtre. Sa course dépassait la cible, la
    // nôtre y ramenait la caméra : le « rebond » (2026-10-30, Alexandre).
    let pinchedAt = 0;
    const onWheel = (e: WheelEvent) => {
      e.stopPropagation();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      // Le pincement d'un pavé tactile arrive en molette, `ctrlKey` levé, à petits pas ; Ctrl + vraie molette, à grands pas.
      const pinch = e.ctrlKey && e.deltaMode === 0 && Math.abs(dy) < 50;
      // Carte coopérative : sans clic préalable ni ⌘/Ctrl, la molette fait défiler la page.
      if (gest.current && !e.ctrlKey && !e.metaKey && !gest.current.held()) {
        // En largeur, il n'y a rien à faire défiler : on coupe le glissé « page
        // précédente », que `SwipeBackGuard` ne voit plus passer.
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault();
        else gest.current.refused('wheel');
        return;
      }
      e.preventDefault();
      if (pinch) pinchedAt = performance.now();
      zoomBy(Math.exp(Math.max(-WHEEL_CAP, Math.min(WHEEL_CAP, dy)) * (pinch ? PINCH_K : WHEEL_K)), local(e));
    };
    container.addEventListener('wheel', onWheel, { capture: true, passive: false });

    // Safari ne donne pas le pincement du pavé en molette mais en `gesture*` —
    // sans ça, il agrandissait la PAGE. Sur écran tactile, ce sont les doigts
    // (Sigma) qui zooment : on ne compte pas deux fois.
    type Gesture = Event & { scale: number; clientX: number; clientY: number };
    let scale = 1;
    let fingers = 0;
    const onGesture = (e: Event) => {
      e.preventDefault();
      const g = e as Gesture;
      if (e.type === 'gesturechange' && !fingers && performance.now() - pinchedAt > 200) zoomBy(scale / g.scale, local(g));
      scale = e.type === 'gestureend' ? 1 : g.scale;
    };
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) container.addEventListener(type, onGesture, { passive: false });

    // Toucher coopératif (la règle de Google Maps) : un doigt fait défiler la
    // page, deux doigts déplacent et zooment la carte. Le doigt seul n'atteint
    // pas Sigma, qui bloquerait le défilement dès qu'il touche l'écran ; un
    // simple appui choisit toujours un point (le clic que le navigateur en tire).
    const solo = { on: false, x: 0, y: 0, told: false };
    const onTouch = (e: TouchEvent) => {
      fingers = e.touches.length;
      if (!gest.current) return;
      if (e.type === 'touchstart') {
        solo.on = e.touches.length === 1;
        if (!solo.on) return;
        e.stopPropagation();
        Object.assign(solo, { x: e.touches[0].clientX, y: e.touches[0].clientY, told: false });
        return;
      }
      if (!solo.on) return;
      e.stopPropagation();
      if (e.type !== 'touchmove' || solo.told) return;
      const t = e.touches[0];
      if (t && Math.hypot(t.clientX - solo.x, t.clientY - solo.y) > 12) {
        solo.told = true;
        gest.current.refused('touch');
      }
    };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) container.addEventListener(type, onTouch as EventListener, { capture: true, passive: true });
    // Sigma interdit au navigateur tout geste sur la carte (`touch-action: none`) : on lui rend le défilement vertical.
    if (gest.current) container.querySelectorAll('canvas').forEach((c) => (c.style.touchAction = 'pan-y'));

    // Le déplacement tenu : l'allure rejoint la direction demandée (départ qui accélère, arrêt qui freine).
    const p = { dir: { x: 0, y: 0 }, v: { x: 0, y: 0 }, raf: 0, last: 0 };
    const panStep = (now: number) => {
      const dt = Math.min(64, now - p.last);
      p.last = now;
      const k = reduced() ? 1 : 1 - Math.exp(-dt / PAN_TAU);
      p.v.x += (p.dir.x * PAN_SPEED - p.v.x) * k;
      p.v.y += (p.dir.y * PAN_SPEED - p.v.y) * k;
      const c = middle();
      const a = renderer.viewportToFramedGraph(c);
      const b = renderer.viewportToFramedGraph({ x: c.x + (p.v.x * dt) / 1000, y: c.y + (p.v.y * dt) / 1000 });
      const { x, y } = camera.getState();
      camera.setState({ x: x + b.x - a.x, y: y + b.y - a.y });
      const moving = p.dir.x || p.dir.y || Math.hypot(p.v.x, p.v.y) > 4;
      p.raf = moving ? requestAnimationFrame(panStep) : 0;
      if (!moving) p.v = { x: 0, y: 0 };
    };
    if (nav)
      nav.current = {
        drive: (x, y) => {
          p.dir = { x, y };
          if (!p.raf && (x || y)) {
            p.last = performance.now();
            p.raf = requestAnimationFrame(panStep);
          }
        },
        zoom: (step) => zoomBy(KEY_ZOOM ** -step, middle()),
        reset: () => {
          cancelAnimationFrame(z.raf);
          z.raf = 0;
          const home = { x: 0.5, y: 0.5, ratio: 1, angle: 0 };
          if (reduced()) camera.setState(home);
          else camera.animate(home, { duration: 450, easing: 'quadraticInOut' });
        },
      };

    // Les noms par rang : on ne relit les réducteurs que quand un rang franchit son seuil.
    const band = () => (s.reach ? (Object.keys(s.reach) as LabelKind[]).map((k) => +(s.ratio <= s.reach![k])).join('') : '');
    let lastBand = band();
    camera.on('updated', ({ ratio }) => {
      s.ratio = ratio;
      const b = band();
      if (b === lastBand) return;
      lastBand = b;
      renderer.refresh({ skipIndexation: true });
    });
    (renderer as Sigma & { relabel?: () => void }).relabel = () => {
      lastBand = band();
      renderer.refresh({ skipIndexation: true });
    };

    // Avec `sticky`, un nœud hors du voisinage choisi dit son nom au survol, sans rallumer son système.
    const outside = (node: string) => sticky && !!s.selected && !s.kept.has(node);
    renderer.on('enterNode', ({ node }) => {
      container.style.cursor = 'pointer';
      if (outside(node)) {
        s.peek = node;
        return renderer.refresh({ skipIndexation: true });
      }
      s.hovered = node;
      settle();
    });
    renderer.on('leaveNode', () => {
      container.style.cursor = '';
      if (s.peek) {
        s.peek = null;
        renderer.refresh({ skipIndexation: true });
      }
      if (!s.hovered) return;
      s.hovered = null;
      settle();
    });
    renderer.on('clickNode', ({ node }) => {
      s.peek = null;
      select.current(node);
    });
    renderer.on('clickStage', () => select.current(null));

    // Cadrer un système : on cherche le rapport le plus serré où nœuds ET noms
    // tiennent dans le cadre (moins le panneau, à droite), par dichotomie —
    // la taille rendue des nœuds suit le zoom, celle des noms non.
    const measure = document.createElement('canvas').getContext('2d');
    const frameOn = (ids: Set<string>) => {
      const pts = [...ids].flatMap((id) => {
        const d = s.visible.has(id) ? renderer.getNodeDisplayData(id) : undefined;
        return d ? [{ id, d }] : [];
      });
      const { width: W, height: H } = renderer.getDimensions();
      const pad = W < 600 ? FIT_PAD_SMALL : FIT_PAD;
      const room = { w: W - insetNow.current - 2 * pad, h: H - FIT_TOP - pad };
      if (!pts.length || room.w < 80 || room.h < 80) return;
      // Les noms qui se liront : tous pour un petit système (ils sont forcés), ceux des articles sinon.
      const named = ids.size <= MAX_FORCED_LABELS;
      if (measure) measure.font = `600 12px ${font}`;
      const tail = pts.map(({ id }) => {
        const n = graph.getNodeAttributes(id);
        return (named || n.kind === 'article') && measure ? Math.min(measure.measureText(n.label).width + 3, room.w * FIT_LABEL_SHARE) : 0;
      });
      const xs = pts.map((p) => p.d.x);
      const ys = pts.map((p) => p.d.y);
      const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
      const extent = (ratio: number) => {
        const cam = { ...mid, ratio, angle: 0 };
        const e = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity, cam };
        pts.forEach(({ d }, i) => {
          const v = renderer.framedGraphToViewport(d, { cameraState: cam });
          const rad = renderer.scaleSize(d.size, ratio);
          e.l = Math.min(e.l, v.x - rad);
          e.r = Math.max(e.r, v.x + rad + tail[i]);
          e.t = Math.min(e.t, v.y - Math.max(rad, 8));
          e.b = Math.max(e.b, v.y + Math.max(rad, 8));
        });
        return e;
      };
      const fits = (e: ReturnType<typeof extent>) => e.r - e.l <= room.w && e.b - e.t <= room.h;
      let lo = Math.log(MIN_RATIO);
      let hi = Math.log(MAX_RATIO);
      if (!fits(extent(Math.exp(lo))))
        for (let i = 0; i < 24; i++) {
          const m = (lo + hi) / 2;
          if (fits(extent(Math.exp(m)))) hi = m;
          else lo = m;
        }
      else hi = lo;
      const e = extent(Math.exp(hi));
      // Le dessin se pose au milieu de la place libre : la caméra part à l'opposé du décalage.
      const dx = pad + room.w / 2 - (e.l + e.r) / 2;
      const dy = FIT_TOP + room.h / 2 - (e.t + e.b) / 2;
      const to = renderer.viewportToFramedGraph({ x: W / 2 - dx, y: H / 2 - dy }, { cameraState: e.cam });
      cancelAnimationFrame(z.raf);
      z.raf = 0;
      const target = { x: to.x, y: to.y, ratio: Math.exp(hi) };
      if (reduced()) camera.setState(target);
      else camera.animate(target, { duration: FIT_MS, easing: 'cubicInOut' });
    };
    (renderer as Sigma & { frameOn?: typeof frameOn }).frameOn = frameOn;

    // Sigma ne suit que la fenêtre : un cadre qui change de largeur sans elle (le
    // menu de gauche qui se replie, 2026-10-30) redessine à chaque image du geste.
    const resized = new ResizeObserver(() => renderer.refresh({ skipIndexation: true }));
    resized.observe(container);

    return () => {
      resized.disconnect();
      container.removeEventListener('wheel', onWheel, { capture: true });
      for (const type of ['gesturestart', 'gesturechange', 'gestureend']) container.removeEventListener(type, onGesture);
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) container.removeEventListener(type, onTouch as EventListener, { capture: true });
      cancelAnimationFrame(raf);
      cancelAnimationFrame(z.raf);
      cancelAnimationFrame(p.raf);
      if (nav) nav.current = null;
      renderer.kill();
      sigma.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `sticky`, `nav` et la présence de `labels` ne changent pas d'une vie à l'autre du dessin
  }, [ix]);

  // Les crans de `labels` → le zoom (rapport de caméra) en deçà duquel chaque rang garde son nom.
  useEffect(() => {
    const s = state.current;
    if (!labels) return;
    const span = MAX_RATIO / MIN_RATIO;
    const at = (v: number) => (v <= 0 ? 0 : v >= LABEL_STEPS ? Infinity : MIN_RATIO * span ** (v / LABEL_STEPS));
    s.reach = { article: at(labels.article), mechanism: at(labels.mechanism), thesis: at(labels.thesis) };
    (sigma.current as (Sigma & { relabel?: () => void }) | null)?.relabel?.();
  }, [labels]);

  // Filtres et sélection : on relit les refs, Sigma ne se reconstruit pas.
  useEffect(() => {
    const s = state.current;
    s.visible = visible;
    s.selected = selected && visible.has(selected) ? selected : null;
    s.kept = s.selected ? neighbourhood(ix, s.selected) : new Set();
    const r = sigma.current as (Sigma & { settle?: () => void }) | null;
    if (!r) return;
    if (!s.hovered) r.settle?.();
    else r.refresh({ skipIndexation: true });
  }, [ix, visible, selected]);

  // Une entrée du menu survolée, puis quittée.
  useEffect(() => {
    state.current.preview = preview;
    (sigma.current as (Sigma & { settle?: () => void }) | null)?.settle?.();
  }, [preview]);

  // Cadrer le système choisi (après les filtres et la sélection, que l'effet du dessus vient de relire).
  useEffect(() => {
    const s = state.current;
    const r = sigma.current as (Sigma & { frameOn?: (ids: Set<string>) => void }) | null;
    if (!fit || !r) return;
    r.frameOn?.(s.selected ? s.kept : s.visible);
  }, [fit]);

  // Aller chercher un nœud choisi hors du dessin.
  useEffect(() => {
    const r = sigma.current;
    const id = state.current.selected;
    if (!r || !center || !id) return;
    const d = r.getNodeDisplayData(id);
    if (!d) return;
    const camera = r.getCamera();
    const now = camera.getState();
    const ratio = Math.min(now.ratio, zoom);
    // Le décalage en coordonnées du graphe, mesuré au zoom courant puis ramené au zoom visé.
    const { width, height } = r.getDimensions();
    const a = r.viewportToFramedGraph({ x: width / 2, y: height / 2 });
    const b = r.viewportToFramedGraph({ x: width / 2 + inset / 2, y: height / 2 });
    const k = ratio / now.ratio;
    const target = { x: d.x + (b.x - a.x) * k, y: d.y + (b.y - a.y) * k, ratio };
    if (reduced()) camera.setState(target);
    else camera.animate(target, { duration: 450, easing: 'quadraticInOut' });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seul un nouveau `center` déplace la caméra
  }, [center]);

  return <div ref={box} className="absolute inset-0" />;
}
