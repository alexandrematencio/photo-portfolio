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
 * Le système d'une thématique, pour l'aperçu du menu (2026-10-30, Alexandre :
 * « une isolation du système visé, au sein du système global ») : ses
 * mécanismes, les thèses qui les emploient et les articles de ces thèses.
 * Un article qui n'y touche par aucune thèse reste voilé, même s'il porte la
 * thématique ; un mécanisme d'une autre couleur aussi.
 */
export function themeSystem(ix: MapIndex, theme: string, within: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const m of ix.view.nodes) {
    if (m.kind !== 'mechanism' || m.theme !== theme || !within.has(m.id)) continue;
    out.add(m.id);
    for (const t of ix.thesesOfMech.get(m.id) ?? []) {
      if (!within.has(t)) continue;
      out.add(t);
      ix.byId.get(t)?.articles.forEach((a) => within.has(a) && out.add(a));
    }
  }
  return out;
}

/**
 * Les séries et thématiques d'un nœud choisi, que le menu signale d'une
 * pastille (2026-10-31, Alexandre). La thématique d'un mécanisme est sa
 * couleur ; celles d'une thèse, les couleurs de ses mécanismes ; celles d'un
 * article, ses étiquettes. Un mécanisme est des séries de ses articles.
 */
export function linkedTo(ix: MapIndex, id: string | null): { series: Set<string>; themes: Set<string> } {
  const series = new Set<string>();
  const themes = new Set<string>();
  const n = id ? ix.byId.get(id) : undefined;
  if (!n) return { series, themes };
  if (n.kind === 'mechanism') {
    if (n.theme) themes.add(n.theme);
    n.articles.forEach((a) => ix.byId.get(a)?.series && series.add(ix.byId.get(a)!.series!));
  } else {
    if (n.series) series.add(n.series);
    if (n.kind === 'article') n.themes.forEach((t) => themes.add(t));
    else for (const m of ix.mechsOfThesis.get(n.id) ?? []) ix.byId.get(m)?.theme && themes.add(ix.byId.get(m)!.theme!);
  }
  return { series, themes };
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

/**
 * Jusqu'où les noms se lisent, par rang (2026-10-30, Alexandre, à la manière
 * d'Obsidian) : de 0 (jamais, sauf autour du nœud survolé ou choisi) à
 * `LABEL_STEPS` (toujours). Entre les deux, un cran recule le zoom à partir
 * duquel le nom paraît.
 */
export type LabelKind = 'article' | 'mechanism' | 'thesis';
export type LabelReach = Record<LabelKind, number>;
export const LABEL_STEPS = 10;
/** Les crans qui reproduisent l'ancien seuil de taille : articles toujours, mécanismes de près, thèses tout près. */
export const LABEL_DEFAULT: LabelReach = { article: 10, mechanism: 4, thesis: 1 };

/** Ce que les commandes hors du dessin (clavier, faux clavier) demandent à la caméra. */
export type MapNav = {
  /** La direction tenue, en écran (−1 à 1 par axe) ; 0, 0 freine jusqu'à l'arrêt. */
  drive: (x: number, y: number) => void;
  /** Un cran de zoom au centre : positif rapproche. */
  zoom: (step: number) => void;
  /** Toute la carte dans le cadre. */
  reset: () => void;
};
