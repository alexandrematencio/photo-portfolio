import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { MapViewEdge as MapEdge } from '@/lib/journal/conceptMapData';

/**
 * LABO — la vue graphe d'Obsidian, À L'IDENTIQUE (2026-11-04, Alexandre : « un
 * copié-collé de l'effet Obsidian »). Réécrit de zéro d'après le code
 * d'Obsidian 1.15.0 lui-même (`sim.js`, le worker de la simulation, et
 * `app.js`, les curseurs), lu dans l'application installée — plus de valeurs
 * devinées sur des captures.
 *
 * Ce que fait Obsidian, et donc ce qui est fait ici :
 * - curseurs → forces :
 *   · centre (0–1)   → forceX/forceY, force = expo(c)  (0,52 ≈ 0,1) ;
 *   · répulsion (0–20) → forceManyBody, force = −r³     (10 → −1000), au moins −1 ;
 *                        distanceMin 30, theta 0,9 ;
 *   · liens (0–1)    → forceLink, force = expo(l) × 1/degré du moins relié ;
 *   · distance (30–500) → forceLink.distance, telle quelle ;
 *   · expo(v) = (0,01^(1−v) − 0,01) / 0,99 ;
 * - anti-chevauchement TOUJOURS : rayon 60 pour tous les nœuds, force 0,5 —
 *   d'où le maillage régulier ; la taille d'une bulle ne joue pas ;
 * - amortissement 0,4 (v ×= 0,6), refroidissement 1 − 0,001^(1/300), arrêt
 *   sous 0,001 ; un geste relance à 0,3 (max(α, 0,3)), en direct, d'où il en est ;
 * - la caméra ne bouge pas ; les bulles suivent le zoom (ConceptMapGraph).
 *
 * Unités : celles du monde d'Obsidian (distance 250, rayon 60). Le passage au
 * document est réglé une fois : l'équilibre des valeurs par défaut a la
 * taille de la carte publiée, pour que le premier geste réarrange la carte
 * sur place au lieu de l'exploser. Au chargement, la carte publiée
 * (ForceAtlas2) ; « Rétablir » la rend.
 */

export type LinkKind = 'rhyme' | 'part' | 'uses';
export type ForceMode = 'a' | 'b';
export type ForceSettings = {
  /** Taille des bulles, × (affichage seul, comme « Node size » d'Obsidian). */
  size: number;
  /** « Center force », curseur 0–1. */
  center: number;
  /** « Repel force », curseur 0–20. */
  repel: number;
  /** « Link force », curseur 0–1. */
  link: number;
  /** « Link distance », 30–500. */
  distance: number;
  /** B : « Link force » par type de lien, curseur 0–1. */
  byKind: Record<LinkKind, number>;
};

/** Les curseurs d'Obsidian → ses forces (app.js : Bhe, r*r*r ; sim.js : |r³| < 1 → 1). */
const expo = (v: number) => (Math.pow(0.01, 1 - v) - 0.01) / 0.99;
const unexpo = (f: number) => 1 - Math.log(f * 0.99 + 0.01) / Math.log(0.01);
const repelOf = (r: number) => -Math.max(1, r * r * r);

export const FORCE_DEFAULTS: ForceSettings = {
  size: 1,
  center: Math.round(unexpo(0.1) * 1000) / 1000, // 0,519 → 0,1
  repel: 10, // → −1000
  link: 1,
  distance: 250,
  byKind: { rhyme: 1, part: 1, uses: 1 },
};

const COLLIDE_R = 60;
const COLLIDE_K = 0.5;
const ALPHA_MIN = 0.001;
const ALPHA_DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 300);
const KICK = 0.3;

type N = SimulationNodeDatum & { id: string };
type L = SimulationLinkDatum<N> & { kind: LinkKind };

export type ForceRun = {
  /** Nouveaux réglages : la simulation repart d'où elle en est (α ≥ 0,3). */
  set: (mode: ForceMode, f: ForceSettings) => void;
  /** Retour aux positions de `map:build`. */
  reset: () => void;
  stop: () => void;
};

function build(nodes: N[], links: L[], mode: ForceMode, f: ForceSettings, sim?: Simulation<N, L>) {
  const s = sim ?? forceSimulation<N, L>(nodes).stop();
  const link = forceLink<N, L>(links).id((n) => n.id);
  const natural = link.strength() as (l: L, i: number, ls: L[]) => number;
  link.distance(f.distance).strength((l, i, ls) => natural(l, i, ls) * expo(mode === 'a' ? f.link : f.byKind[l.kind]));
  // L'ordre d'Obsidian : x, y, liens, répulsion, chevauchement.
  return s
    .velocityDecay(0.4)
    .alphaDecay(ALPHA_DECAY)
    .alphaMin(ALPHA_MIN)
    .alphaTarget(0)
    .force('x', forceX<N>(0).strength(expo(f.center)))
    .force('y', forceY<N>(0).strength(expo(f.center)))
    .force('link', link)
    .force('repel', forceManyBody<N>().strength(repelOf(f.repel)).distanceMin(30).theta(0.9))
    .force('collide', forceCollide<N>(COLLIDE_R).strength(COLLIDE_K));
}

/**
 * `write` reçoit les positions du document, une image à la fois ;
 * `extent` reçoit l'étendue du graphe rapportée à celle de la carte
 * publiée (1 = même taille), pour ouvrir le dézoom d'autant.
 */
export function runForces({
  nodes: origin,
  edges,
  write,
  extent,
  reduced,
}: {
  nodes: { id: string; x: number; y: number }[];
  edges: MapEdge[];
  write: (pos: Map<string, { x: number; y: number }>) => void;
  extent: (k: number) => void;
  reduced: boolean;
}): ForceRun {
  const ids = new Set(origin.map((n) => n.id));
  const kept = edges.filter((e): e is MapEdge & { kind: LinkKind } => e.kind !== 'next' && ids.has(e.source) && ids.has(e.target));
  const linksOf = (): L[] => kept.map((e) => ({ source: e.source, target: e.target, kind: e.kind }));

  const cx = origin.reduce((a, n) => a + n.x, 0) / origin.length;
  const cy = origin.reduce((a, n) => a + n.y, 0) / origin.length;
  const spanOf = (pts: { x?: number; y?: number }[]) => {
    const xs = pts.map((p) => p.x!), ys = pts.map((p) => p.y!);
    return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  };
  const homeSpan = spanOf(origin);

  // Monde d'Obsidian ↔ document : l'équilibre par défaut a la taille de la carte publiée.
  // Un premier passage à une échelle provisoire (la carte publiée = 3000 unités), une fois.
  let k = 3000 / homeSpan; // unités du monde par unité du document
  {
    const probe: N[] = origin.map((n) => ({ id: n.id, x: (n.x - cx) * k, y: (n.y - cy) * k }));
    const sim = build(probe, linksOf(), 'a', FORCE_DEFAULTS).alpha(1);
    while (sim.alpha() > ALPHA_MIN) sim.tick();
    k = spanOf(probe) / homeSpan;
  }

  const nodes: N[] = origin.map((n) => ({ id: n.id, x: (n.x - cx) * k, y: (n.y - cy) * k }));
  const links = linksOf();
  let sim: Simulation<N, L> | null = null;

  let widest = 1;
  const emit = () => {
    write(new Map(nodes.map((n) => [n.id, { x: cx + n.x! / k, y: cy + n.y! / k }])));
    const e = spanOf(nodes) / k / homeSpan;
    if (e > widest * 1.05) {
      widest = e;
      extent(e);
    }
  };

  // « Taille des bulles » ne touche que l'affichage : elle ne relance pas la simulation (comme Obsidian).
  let last = '';
  const set = (mode: ForceMode, f: ForceSettings) => {
    const key = JSON.stringify([mode, f.center, f.repel, f.link, f.distance, f.byKind]);
    if (key === last) return;
    last = key;
    sim = build(nodes, links, mode, f, sim ?? undefined);
    sim.on('tick', emit);
    if (reduced) {
      // Sans mouvement : la carte saute à son équilibre, en une image.
      sim.stop().alpha(1);
      while (sim.alpha() > ALPHA_MIN) sim.tick();
      emit();
    } else sim.alpha(Math.max(sim.alpha(), KICK)).restart();
  };

  const reset = () => {
    sim?.stop();
    const at = new Map(origin.map((n) => [n.id, n]));
    for (const n of nodes) {
      const o = at.get(n.id)!;
      Object.assign(n, { x: (o.x - cx) * k, y: (o.y - cy) * k, vx: 0, vy: 0 });
    }
    sim?.alpha(0);
    last = '';
    widest = 1;
    extent(1);
    write(new Map(origin.map((n) => [n.id, { x: n.x, y: n.y }])));
  };

  return { set, reset, stop: () => sim?.stop() };
}
