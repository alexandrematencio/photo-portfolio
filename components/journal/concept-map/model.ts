import type { MapView, MapViewNode } from '@/lib/journal/conceptMapData';

/**
 * Ce que la page sait de la carte une fois chargée : les nœuds par id, qui
 * emploie quoi, ce qu'un filtre laisse voir, et ce qui reste net quand on
 * survole un nœud. Pur : partagé par le graphe, le panneau et la liste.
 */

export type Filters = { series: string | null; theme: string | null; common: boolean };
export const NO_FILTER: Filters = { series: null, theme: null, common: false };

export type MapIndex = ReturnType<typeof indexMap>;

export function indexMap(view: MapView) {
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  const push = (m: Map<string, string[]>, k: string, v: string) => m.set(k, [...(m.get(k) ?? []), v]);
  const mechsOfThesis = new Map<string, string[]>();
  const thesesOfMech = new Map<string, string[]>();
  const thesesOfArticle = new Map<string, string[]>();
  const rhymes = new Map<string, { id: string; why?: string }[]>();
  for (const e of view.edges) {
    if (e.kind === 'uses') {
      push(mechsOfThesis, e.source, e.target);
      push(thesesOfMech, e.target, e.source);
    } else if (e.kind === 'part') push(thesesOfArticle, e.source, e.target);
    else if (e.kind === 'rhyme') {
      rhymes.set(e.source, [...(rhymes.get(e.source) ?? []), { id: e.target, why: e.why }]);
      rhymes.set(e.target, [...(rhymes.get(e.target) ?? []), { id: e.source, why: e.why }]);
    }
  }
  const order = (id: string) => byId.get(id)?.order ?? 0;
  for (const list of thesesOfArticle.values()) list.sort((a, b) => order(a) - order(b));
  const themeColor = new Map(view.themes.map((t) => [t.title, t.color]));
  return { view, byId, mechsOfThesis, thesesOfMech, thesesOfArticle, rhymes, themeColor };
}

export const colorOf = (ix: MapIndex, n: MapViewNode) =>
  n.kind === 'mechanism' ? ((n.theme && ix.themeColor.get(n.theme)) ?? '#8d887c') : n.kind === 'article' ? '#0a0a0a' : '#b4afa5';

/** Un mécanisme « commun » : employé par au moins deux articles. */
export const isCommon = (n: MapViewNode) => n.kind === 'mechanism' && n.articles.length >= 2;

/** Les nœuds qu'un jeu de filtres laisse voir. */
export function visibleIds(ix: MapIndex, f: Filters): Set<string> {
  const out = new Set<string>();
  const articles = ix.view.nodes.filter(
    (n) => n.kind === 'article' && (!f.series || n.series === f.series) && (!f.theme || n.themes.includes(f.theme)),
  );
  for (const a of articles) {
    out.add(a.id);
    for (const t of ix.thesesOfArticle.get(a.id) ?? []) {
      const mechs = (ix.mechsOfThesis.get(t) ?? []).filter((m) => !f.common || isCommon(ix.byId.get(m)!));
      if (f.common && !mechs.length) continue;
      out.add(t);
      for (const m of mechs) out.add(m);
    }
  }
  return out;
}

/**
 * Ce qui reste net autour d'un nœud survolé ou choisi. Un article garde ses
 * thèses ET les mécanismes qu'elles emploient ; un mécanisme, les thèses qui
 * l'emploient, leurs articles et ses rimes ; une thèse, son article et ses
 * mécanismes.
 */
export function neighbourhood(ix: MapIndex, id: string): Set<string> {
  const n = ix.byId.get(id);
  const out = new Set([id]);
  if (!n) return out;
  if (n.kind === 'article')
    for (const t of ix.thesesOfArticle.get(id) ?? []) {
      out.add(t);
      for (const m of ix.mechsOfThesis.get(t) ?? []) out.add(m);
    }
  else if (n.kind === 'thesis') {
    n.articles.forEach((a) => out.add(a));
    for (const m of ix.mechsOfThesis.get(id) ?? []) out.add(m);
  } else {
    for (const t of ix.thesesOfMech.get(id) ?? []) {
      out.add(t);
      ix.byId.get(t)?.articles.forEach((a) => out.add(a));
    }
    for (const r of ix.rhymes.get(id) ?? []) out.add(r.id);
  }
  return out;
}

/** Les mécanismes de la liste, les plus partagés d'abord. */
export function listedMechanisms(ix: MapIndex, visible: Set<string>): MapViewNode[] {
  return ix.view.nodes
    .filter((n) => n.kind === 'mechanism' && visible.has(n.id))
    .sort((a, b) => b.articles.length - a.articles.length || a.label.localeCompare(b.label, 'fr'));
}

/** `#n=<id>` : la sélection se partage et survit au retour arrière. */
export const HASH_KEY = 'n';
