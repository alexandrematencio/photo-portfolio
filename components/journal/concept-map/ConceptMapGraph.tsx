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
 * immédiate, la caméra ne voyage pas.
 */

const PAPER = '#fafaf8';
const FADE_IN = 180;
const FADE_OUT = 140;
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
/** Le glissé vers la cible : 63 % du chemin en 90 ms, le reste en freinant. */
const ZOOM_TAU = 90;
/** Un cran du clavier ou du faux clavier. */
const KEY_ZOOM = 1.35;
/** Déplacement au clavier, en pixels d'écran par seconde, et le temps pour prendre (ou perdre) son allure. */
const PAN_SPEED = 620;
const PAN_TAU = 110;
const MIN_RATIO = 0.12;
const MAX_RATIO = 1.6;

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
  center,
  inset = 0,
  zoom = 0.7,
  sticky = false,
  labels,
  nav,
  onSelect,
}: {
  ix: MapIndex;
  visible: Set<string>;
  selected: string | null;
  /** Change quand la sélection vient d'ailleurs (panneau, adresse) : la caméra va la chercher. */
  center: number;
  /** Pixels masqués à droite par le panneau : le nœud cherché se pose au milieu de ce qui reste visible. */
  inset?: number;
  /** Zoom maximal quand la caméra va chercher un nœud (plus petit = plus près). */
  zoom?: number;
  /**
   * La sélection TIENT (`/concept-map`, 2026-10-30, Alexandre) : tant qu'un
   * nœud est choisi, survoler un nœud estompé ne rallume rien, et cliquer hors
   * de son voisinage — dans le vide comme sur un autre nœud — la lâche. Seul
   * un voisin allumé se choisit directement. Sans elle (la carte d'un
   * article), tout nœud survolé s'allume et tout nœud cliqué se choisit.
   */
  sticky?: boolean;
  /** Jusqu'où chaque rang garde son nom ; sans, le seuil de taille de Sigma (la carte d'un article). */
  labels?: LabelReach;
  /** Rempli au montage : les commandes du clavier et du faux clavier passent par là. */
  nav?: MutableRefObject<MapNav | null>;
  onSelect: (id: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const sigma = useRef<Sigma | null>(null);
  // L'état que lisent les reducers : des refs, pour ne pas reconstruire Sigma.
  const state = useRef({ visible, selected, hovered: null as string | null, shown: null as string | null, around: new Set<string>(), fade: 0, kept: new Set<string>(), reach: null as Record<LabelKind, number> | null, ratio: 1 });
  const select = useRef(onSelect);
  select.current = onSelect;

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
        if (!s.shown || s.fade === 0) return out;
        if (s.around.has(node)) return { ...out, label: data.label, zIndex: (data.zIndex ?? 0) + 4, forceLabel: node === s.shown || s.around.size <= MAX_FORCED_LABELS };
        return { ...out, color: mix(data.color, PAPER, 0.82 * s.fade), label: s.fade > 0.5 ? null : data.label, zIndex: 0 };
      },
      edgeReducer: (edge, data) => {
        const [a, b] = graph.extremities(edge);
        if (!s.visible.has(a) || !s.visible.has(b)) return { ...data, hidden: true };
        if (!s.shown || s.fade === 0) return data;
        if (s.around.has(a) && s.around.has(b))
          return { ...data, color: data.color === EDGE_STYLE.rhyme.color ? data.color : mix(data.color, EDGE_FOCUS, s.fade), zIndex: 2 };
        return { ...data, color: mix(data.color, PAPER, 0.85 * s.fade) };
      },
    });
    sigma.current = renderer;

    let raf = 0;
    const focusOn = (id: string | null) => {
      cancelAnimationFrame(raf);
      const from = s.fade;
      const to = id ? 1 : 0;
      if (id) {
        s.shown = id;
        s.around = neighbourhood(ix, id);
      }
      if (reduced() || from === to) {
        s.fade = to;
        if (!id) s.shown = null;
        renderer.refresh({ skipIndexation: true });
        return;
      }
      const start = performance.now();
      const duration = to ? FADE_IN : FADE_OUT;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        s.fade = from + (to - from) * easeOut(t);
        if (t === 1 && !id) s.shown = null;
        renderer.refresh({ skipIndexation: true });
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    (renderer as Sigma & { focusOn?: typeof focusOn }).focusOn = focusOn;

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
    renderer.getMouseCaptor().on('wheel', (c) => {
      c.preventSigmaDefault();
      const e = c.original as WheelEvent;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      zoomBy(Math.exp(Math.max(-WHEEL_CAP, Math.min(WHEEL_CAP, dy)) * (e.ctrlKey ? PINCH_K : WHEEL_K)), { x: c.x, y: c.y });
    });

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

    // Avec `sticky`, ce qui est hors du voisinage choisi ne répond pas au survol.
    const outside = (node: string) => sticky && !!s.selected && !s.kept.has(node);
    renderer.on('enterNode', ({ node }) => {
      if (outside(node)) return;
      container.style.cursor = 'pointer';
      s.hovered = node;
      focusOn(node);
    });
    renderer.on('leaveNode', () => {
      container.style.cursor = '';
      if (!s.hovered) return;
      s.hovered = null;
      focusOn(s.selected);
    });
    renderer.on('clickNode', ({ node }) => select.current(outside(node) ? null : node));
    renderer.on('clickStage', () => select.current(null));

    return () => {
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
    const r = sigma.current as (Sigma & { focusOn?: (id: string | null) => void }) | null;
    if (!r) return;
    if (!s.hovered) r.focusOn?.(s.selected);
    else r.refresh({ skipIndexation: true });
  }, [ix, visible, selected]);

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
