import { sanityClient } from '@/lib/sanity/client';
import { getArticles } from './articles';
import { checkConceptMap, JOURNAL_MAP_QUERY, MAP_POSTS_QUERY, type JournalMapDoc, type MapPosts } from './conceptMap';
import { STATUS_LABEL } from './mapAnchors';
import { articleSections } from './sections';
import { articlePath, seriesPath } from './i18n';
import type { Article } from './types';

/**
 * La Concept Map telle que la page `/concept-map` la montre (phase 4,
 * docs/superpowers/plans/2026-10-28-journal-map.md). Lue au BUILD : la carte
 * publiée, recalée sur le texte publié du moment (`checkConceptMap`), chaque
 * nœud muni de son lien. La dérive part dans le log du build en
 * `console.warn` et n'arrête jamais rien : le lien mène alors au meilleur
 * endroit encore trouvé (intertitre, sinon article).
 *
 * Français seulement : les libellés de la carte n'existent pas encore en
 * EN/RU (phase 5).
 */

export type MapViewNode = {
  id: string;
  kind: 'article' | 'thesis' | 'mechanism';
  label: string;
  x: number;
  y: number;
  /** Où mène « Lire le passage » : paragraphe, intertitre de repli ou article. */
  href: string;
  /** Thématiques : celles de l'article ; pour un mécanisme, celles des articles qui l'emploient. */
  themes: string[];
  /** Article : le sien. Thèse : celui de son article. Mécanisme : `null`. */
  series: string | null;
  // article
  dek?: string;
  part?: number | null;
  /** Thèse : son article (`a:<slug>`). Mécanisme : les articles qui l'emploient. */
  articles: string[];
  order?: number;
  /** Thèse : les paragraphes qu'elle couvre (clés), du sien jusqu'à celui de la thèse suivante. */
  covers?: string[];
  quote?: string;
  definition?: string;
  /** Mécanisme : sa thématique de couleur (la plus fréquente parmi ses articles). */
  theme?: string | null;
};

export type MapViewEdge = { source: string; target: string; kind: 'part' | 'next' | 'uses' | 'rhyme'; why?: string };

export type MapView = {
  nodes: MapViewNode[];
  edges: MapViewEdge[];
  /** Dans l'ordre d'apparition des articles, avec leur couleur (Studio, sinon `THEME_FALLBACK`). */
  themes: { title: string; color: string }[];
  series: { title: string; href: string }[];
};

/**
 * Aucune thématique n'a de couleur dans le Studio au 2026-10-29. Repli par
 * nom, des tons d'encre lisibles sur le papier ; une couleur choisie dans le
 * Studio passe devant. Jamais l'orange : c'est la couleur d'état (§4.3).
 */
const THEME_FALLBACK: Record<string, string> = {
  Economie: '#b07d12',
  Société: '#27408b',
  Esprit: '#7a4c9e',
  Corps: '#b23f66',
  Psychologie: '#1c8a80',
  Design: '#5d8f2c',
  Science: '#3fa6cf',
  Philosophie: '#6b645a',
};
const OTHER = '#8d887c';

const hrefOf = (article: Article | undefined, slug: string, target: { kind: string; key: string | null }, sectionId: Map<string, string>) => {
  const base = article ? articlePath(article.slug, 'fr') : `/${slug}/`;
  if (target.kind === 'paragraph') return `${base}#p-${target.key}`;
  if (target.kind === 'section' && target.key && sectionId.has(target.key)) return `${base}#${sectionId.get(target.key)}`;
  return base;
};

let cached: Promise<MapView | null> | undefined;

/** Une lecture par build, comme `getCorpus` : chaque page d'article en a besoin. */
export function getConceptMapView(): Promise<MapView | null> {
  if (process.env.NODE_ENV !== 'production') return fetchConceptMapView();
  cached ??= fetchConceptMapView();
  return cached;
}

async function fetchConceptMapView(): Promise<MapView | null> {
  if (!sanityClient) return null;
  const [map, posts, articles] = await Promise.all([
    sanityClient.fetch<JournalMapDoc | null>(JOURNAL_MAP_QUERY, {}, { next: { revalidate: 60 } }),
    sanityClient.fetch<MapPosts>(MAP_POSTS_QUERY, {}, { next: { revalidate: 60 } }),
    getArticles('fr'),
  ]);
  if (!map?.nodes?.length) return null;

  const { nodes: checked, issues, moved } = checkConceptMap(map, posts);
  if (issues.length || moved)
    console.warn(
      `Concept Map : ${moved} ancre(s) recalée(s), ${issues.length} en dérive` +
        issues.map((i) => `\n  ⚠ ${i.slug} · ${i.label} — ${STATUS_LABEL[i.status]}`).join(''),
    );

  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  // L'id du H2 vient de son texte (`articleSections`) : la clé Sanity ne se voit pas dans la page.
  const sectionIds = new Map<string, Map<string, string>>();
  for (const a of articles) {
    const { idByBlock } = articleSections(a);
    const ids = new Map<string, string>();
    a.blocks.forEach((b, i) => b.type === 'h2' && b.key && idByBlock.has(i) && ids.set(b.key, idByBlock.get(i)!));
    sectionIds.set(a.slug, ids);
  }

  const edges = (map.edges ?? []).map(({ source, target, kind, why }) => ({ source, target, kind, ...(why ? { why } : {}) }));
  const raw = map.nodes;
  const ids = new Set(raw.map((n) => n.nodeId));
  const articleOfThesis = new Map(raw.filter((n) => n.kind === 'thesis').map((n) => [n.nodeId, n.article ?? '']));
  const mechArticles = new Map<string, string[]>();
  for (const e of edges) {
    if (e.kind !== 'uses') continue;
    const a = articleOfThesis.get(e.source);
    if (a && !(mechArticles.get(e.target) ?? []).includes(a)) mechArticles.set(e.target, [...(mechArticles.get(e.target) ?? []), a]);
  }

  // Un article retiré du site garde ses nœuds dans la carte jusqu'au prochain export : on les écarte.
  const articleNode = new Map(raw.filter((n) => n.kind === 'article' && n.slug && bySlug.has(n.slug)).map((n) => [n.nodeId, n]));
  const themesOf = (articleId: string) => articleNode.get(articleId)?.themes?.filter(Boolean) ?? [];
  const seriesOf = (articleId: string) => {
    const n = articleNode.get(articleId);
    return (n?.slug && bySlug.get(n.slug)?.series) || null;
  };

  const nodes: MapViewNode[] = [];
  for (const n of raw) {
    const c = checked.get(n.nodeId);
    const base = { id: n.nodeId, kind: n.kind, label: n.label, x: n.x, y: n.y };
    if (n.kind === 'article') {
      const a = n.slug ? bySlug.get(n.slug) : undefined;
      if (!a) continue;
      nodes.push({ ...base, href: articlePath(a.slug, 'fr'), themes: themesOf(n.nodeId), series: a.series, dek: a.dek, part: a.series ? a.part : null, articles: [] });
    } else if (n.kind === 'thesis') {
      const art = n.article ?? '';
      if (!articleNode.has(art) || !c) continue;
      const slug = art.replace(/^a:/, '');
      nodes.push({
        ...base,
        href: hrefOf(bySlug.get(slug), slug, c.target, sectionIds.get(slug) ?? new Map()),
        themes: themesOf(art),
        series: seriesOf(art),
        articles: [art],
        order: n.order,
        covers: c.covers,
        quote: n.quote,
      });
    } else {
      const used = (mechArticles.get(n.nodeId) ?? []).filter((a) => articleNode.has(a));
      if (!used.length) continue;
      const count = new Map<string, number>();
      for (const a of used) for (const t of themesOf(a)) count.set(t, (count.get(t) ?? 0) + 1);
      const themes = [...count.keys()];
      const theme = themes.sort((p, q) => count.get(q)! - count.get(p)!)[0] ?? null;
      const slug = n.quoteArticle ?? '';
      nodes.push({
        ...base,
        href: c ? hrefOf(bySlug.get(slug), slug, c.target, sectionIds.get(slug) ?? new Map()) : `/${slug}/`,
        themes,
        series: null,
        articles: used,
        quote: n.quote,
        definition: n.definition,
        theme,
      });
    }
  }
  const kept = new Set(nodes.map((n) => n.id));

  // Couleurs : celle du Studio quand elle existe, le repli sinon.
  const tagColor = new Map<string, string>();
  for (const a of articles) for (const t of a.tags) if (t.color && !tagColor.has(t.title)) tagColor.set(t.title, t.color);
  const themeTitles = [...new Set(nodes.filter((n) => n.kind === 'article').flatMap((n) => n.themes))];
  const seriesTitles = [...new Set(nodes.filter((n) => n.kind === 'article' && n.series).map((n) => n.series!))];

  return {
    nodes,
    edges: edges.filter((e) => ids.has(e.source) && kept.has(e.source) && kept.has(e.target)),
    themes: themeTitles.map((title) => ({ title, color: tagColor.get(title) ?? THEME_FALLBACK[title] ?? OTHER })),
    series: seriesTitles.map((title) => {
      const a = articles.find((x) => x.series === title)!;
      return { title, href: seriesPath(a.seriesSlug!, 'fr') };
    }),
  };
}

/**
 * La part de la carte qu'un article emporte (phase 4 bis) : l'article, ses
 * thèses, les mécanismes qu'elles emploient, les autres thèses (et leurs
 * articles) qui emploient ces mêmes mécanismes, et les rimes de ces
 * mécanismes. Le reste du journal reste sur `/concept-map`.
 */
export function articleMapView(view: MapView, slug: string): MapView | null {
  const articleId = `a:${slug}`;
  const byId = new Map(view.nodes.map((n) => [n.id, n]));
  if (!byId.has(articleId)) return null;
  const keep = new Set([articleId]);
  const theses = view.nodes.filter((n) => n.kind === 'thesis' && n.articles[0] === articleId).map((n) => n.id);
  theses.forEach((t) => keep.add(t));
  const mechs = new Set(view.edges.filter((e) => e.kind === 'uses' && keep.has(e.source)).map((e) => e.target));
  mechs.forEach((m) => keep.add(m));
  for (const e of view.edges) {
    if (e.kind === 'uses' && mechs.has(e.target)) {
      keep.add(e.source);
      byId.get(e.source)?.articles.forEach((a) => keep.add(a));
    }
    if (e.kind === 'rhyme' && (mechs.has(e.source) || mechs.has(e.target))) keep.add(e.source).add(e.target);
  }
  if (!theses.length) return null;
  const nodes = view.nodes.filter((n) => keep.has(n.id));
  const themes = new Set(nodes.flatMap((n) => n.themes));
  return {
    nodes,
    edges: view.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    themes: view.themes.filter((t) => themes.has(t.title)),
    series: view.series,
  };
}
