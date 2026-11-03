import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force';
import type { MapViewEdge as MapEdge } from '@/lib/journal/conceptMapData';

/**
 * LABO (2026-11-03, Alexandre) — les « forces » d'Obsidian sur la Concept Map,
 * pour juger sur pièces avant de rien publier. Deux façons, côte à côte :
 *
 * - A « Uniforme » (Obsidian) : les quatre réglages d'Obsidian, les mêmes pour tous les
 *   liens — force du centre, répulsion, force des liens, distance des liens ;
 * - B « Par lien » : centre et répulsion pareils, mais chaque TYPE de lien
 *   a sa propre force (rime, thèse ↔ article, thèse → mécanisme).
 *
 * La simulation (d3-force, celle dont Obsidian s'inspire) part TOUJOURS des
 * positions de `map:build`, et ne tourne que quand un réglage bouge. Elle
 * calcule dans une échelle à elle (la longueur médiane d'un lien = 40), pour
 * que les réglages gardent le même sens quelle que soit la carte, puis rend
 * ses positions dans l'échelle du document.
 */

export type LinkKind = 'rhyme' | 'part' | 'uses';
export type ForceMode = 'a' | 'b';
export type ForceSettings = {
  /** Taille des bulles, ×. */
  size: number;
  /** Attraction vers le milieu (forceX/forceY). */
  center: number;
  /** Répulsion entre nœuds (forceManyBody, signe inversé). */
  repel: number;
  /** Les bulles ne se chevauchent pas (forceCollide), à leur taille à l'écran. */
  collide: boolean;
  /** Le cadre reste celui de la carte d'origine : écarter agrandit la carte, comme dans Obsidian. */
  fixedFrame: boolean;
  /** Longueur au repos d'un lien. */
  distance: number;
  /** A : la même raideur pour tous les liens. */
  link: number;
  /** B : la raideur par type de lien. */
  byKind: Record<LinkKind, number>;
};

export const FORCE_DEFAULTS: ForceSettings = {
  size: 1,
  center: 0.05,
  repel: 60,
  collide: false,
  fixedFrame: false,
  distance: 40,
  link: 0.5,
  byKind: { rhyme: 0.8, part: 0.5, uses: 0.3 },
};

type N = SimulationNodeDatum & { id: string; r: number };
type L = SimulationLinkDatum<N> & { kind: LinkKind };

export type ForceRun = {
  /** Applique de nouveaux réglages et relance la simulation, d'où elle en est. */
  set: (mode: ForceMode, f: ForceSettings) => void;
  /** Retour aux positions de `map:build`. */
  reset: () => void;
  stop: () => void;
};

/**
 * `write` reçoit toutes les positions d'un coup (une image) ; `radius` donne
 * le rayon d'une bulle à l'écran converti dans l'échelle du document.
 */
export function runForces({
  nodes: origin,
  edges,
  write,
  radius,
  reduced,
}: {
  nodes: { id: string; x: number; y: number; size: number }[];
  edges: MapEdge[];
  write: (pos: Map<string, { x: number; y: number }>) => void;
  radius: (id: string, size: number) => number;
  reduced: boolean;
}): ForceRun {
  const ids = new Set(origin.map((n) => n.id));
  const kept = edges.filter((e): e is MapEdge & { kind: LinkKind } => e.kind !== 'next' && ids.has(e.source) && ids.has(e.target));

  // L'échelle de la simulation : centre au barycentre, lien médian = 40.
  const cx = origin.reduce((a, n) => a + n.x, 0) / origin.length;
  const cy = origin.reduce((a, n) => a + n.y, 0) / origin.length;
  const at = new Map(origin.map((n) => [n.id, n]));
  const lengths = kept.map((e) => Math.hypot(at.get(e.source)!.x - at.get(e.target)!.x, at.get(e.source)!.y - at.get(e.target)!.y)).sort((a, b) => a - b);
  const k = 40 / (lengths[lengths.length >> 1] || 1);

  const nodes: N[] = origin.map((n) => ({ id: n.id, x: (n.x - cx) * k, y: (n.y - cy) * k, r: 0 }));
  const sizes = new Map(origin.map((n) => [n.id, n.size]));
  const links: L[] = kept.map((e) => ({ source: e.source, target: e.target, kind: e.kind }));

  const emit = () => write(new Map(nodes.map((n) => [n.id, { x: cx + n.x! / k, y: cy + n.y! / k }])));

  const sim = forceSimulation<N>(nodes).stop().velocityDecay(0.45).alphaDecay(0.03);
  sim.on('tick', emit);

  const set = (mode: ForceMode, f: ForceSettings) => {
    sim
      .force('x', forceX<N>(0).strength(f.center))
      .force('y', forceY<N>(0).strength(f.center))
      .force('repel', forceManyBody<N>().strength(-f.repel).distanceMax(600))
      .force(
        'link',
        forceLink<N, L>(links)
          .id((n) => n.id)
          .distance(f.distance)
          .strength((l) => (mode === 'a' ? f.link : f.byKind[l.kind])),
      );
    if (f.collide) {
      for (const n of nodes) n.r = radius(n.id, sizes.get(n.id)! * f.size) * k + 1.5;
      sim.force('collide', forceCollide<N>((n) => n.r).iterations(2));
    } else sim.force('collide', null);
    if (reduced) {
      // Sans mouvement : la carte saute à son équilibre, en une image.
      sim.alpha(1);
      for (let i = 0; i < 300; i++) sim.tick();
      emit();
    } else sim.alpha(Math.max(sim.alpha(), 0.5)).restart();
  };

  const reset = () => {
    sim.stop();
    for (const n of nodes) {
      const o = at.get(n.id)!;
      Object.assign(n, { x: (o.x - cx) * k, y: (o.y - cy) * k, vx: 0, vy: 0 });
    }
    emit();
  };

  return { set, reset, stop: () => sim.stop() };
}
