/**
 * Le document `journalMap` (la Concept Map publiée) et sa vérification contre
 * les articles du moment. Pur : les appelants (build du site, `map:check`,
 * Studio) font leurs propres requêtes avec les GROQ ci-dessous.
 */
import { DRIFT, MAP_BODY_GROQ, missingKeys, resolveAnchor, resolveArticleTheses, type AnchorStatus, type MapBlock, type Resolved } from './mapAnchors';
import type { StoredMapText } from './conceptMapI18n';

export const JOURNAL_MAP_ID = 'journalMap';

/** Un nœud tel qu'écrit par `map:build` (le `_key` Sanity en plus). */
export type StoredMapNode = {
  nodeId: string;
  kind: 'article' | 'thesis' | 'mechanism';
  label: string;
  x: number;
  y: number;
  // article
  slug?: string;
  series?: string | null;
  part?: number | null;
  themes?: string[];
  // thèse
  article?: string;
  order?: number;
  covers?: string[];
  print?: string | null;
  section?: string | null;
  // thèse et mécanisme
  quote?: string;
  anchor?: string | null;
  // mécanisme
  definition?: string;
  quoteArticle?: string;
};

export type StoredMapEdge = { source: string; target: string; kind: 'part' | 'next' | 'uses' | 'rhyme'; why?: string };

/** `translations` : les libellés EN/RU, écrits par `map:translate` (conceptMapI18n.ts). */
export type JournalMapDoc = { exportedAt?: string; nodes?: StoredMapNode[]; edges?: StoredMapEdge[]; translations?: StoredMapText[] };

export const JOURNAL_MAP_QUERY = `*[_id == "${JOURNAL_MAP_ID}"][0]{ exportedAt, nodes, edges, translations }`;

/**
 * Articles français publiés et leurs traductions publiées, avec l'adresse de
 * l'original. Le « corps » de la carte est le texte suivi de la note sur l'IA
 * (`aiNote`, 2026-10-30) : ses paragraphes portent aussi une ancre `#p-<clé>`.
 */
export const MAP_POSTS_QUERY = `{
  "fr": *[_type == "post" && !defined(translationOf) && !(_id in path("drafts.**"))]{ _id, title, "slug": slug.current, "body": ${MAP_BODY_GROQ} },
  "tr": *[_type == "post" && defined(translationOf) && !(_id in path("drafts.**"))]{ _id, language, "source": translationOf->slug.current, "body": ${MAP_BODY_GROQ} }
}`;

export type MapPosts = {
  fr: { _id: string; title?: string; slug: string; body?: MapBlock[] }[];
  tr: { _id: string; language?: string; source?: string; body?: MapBlock[] }[];
};

export const articleSlugOf = (n: StoredMapNode) =>
  n.kind === 'thesis' ? n.article?.replace(/^a:/, '') : n.kind === 'mechanism' ? n.quoteArticle : n.slug;

export type CheckedNode = StoredMapNode & Resolved & { covers: string[] };
export type MapIssue = { slug: string; nodeId: string; label: string; status: AnchorStatus };

/**
 * Recale chaque nœud ancré sur le texte des articles publiés, recalcule les
 * `covers`, et liste la dérive et les clés manquantes en EN/RU.
 */
export function checkConceptMap(map: JournalMapDoc, posts: MapPosts) {
  const bodyOf = new Map(posts.fr.map((p) => [p.slug, p.body]));
  const nodes = map.nodes ?? [];
  const checked = new Map<string, CheckedNode>();

  const theses = new Map<string, StoredMapNode[]>();
  for (const n of nodes) {
    if (n.kind !== 'thesis') continue;
    const slug = articleSlugOf(n)!;
    theses.set(slug, [...(theses.get(slug) ?? []), n]);
  }
  for (const [slug, list] of theses) {
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const r of resolveArticleTheses(list.map((n) => ({ ...n, quote: n.quote ?? '', anchor: n.anchor ?? null })), bodyOf.get(slug)))
      checked.set(r.node.nodeId, { ...r.node, status: r.status, target: r.target, covers: r.covers });
  }
  for (const n of nodes) {
    if (n.kind !== 'mechanism' || !n.quote) continue;
    const r = resolveAnchor({ quote: n.quote, anchor: n.anchor ?? null }, bodyOf.get(n.quoteArticle ?? ''));
    checked.set(n.nodeId, { ...n, ...r, covers: [] });
  }

  const issues: MapIssue[] = [...checked.values()]
    .filter((n) => DRIFT.has(n.status))
    .map((n) => ({ slug: articleSlugOf(n) ?? '', nodeId: n.nodeId, label: n.label, status: n.status }));
  const moved = [...checked.values()].filter((n) => n.status === 'moved').length;

  // Les ancres recalées valent aussi pour EN/RU : les clés y sont recopiées du français.
  const keysBySlug = new Map<string, string[]>();
  for (const n of checked.values()) {
    if (n.target.kind === 'article') continue;
    const slug = articleSlugOf(n)!;
    keysBySlug.set(slug, [...(keysBySlug.get(slug) ?? []), n.target.key]);
  }
  const translationGaps = posts.tr
    .filter((t) => t.source && keysBySlug.has(t.source))
    .map((t) => ({ _id: t._id, slug: t.source!, language: t.language ?? '?', missing: missingKeys(keysBySlug.get(t.source!)!, t.body) }))
    .filter((g) => g.missing.length > 0);

  return { nodes: checked, issues, moved, translationGaps };
}
