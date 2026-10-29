import { sanityClient } from '@/lib/sanity/client';
import { getArticles } from './articles';
import { checkConceptMap, JOURNAL_MAP_QUERY, MAP_POSTS_QUERY, type JournalMapDoc, type MapPosts } from './conceptMap';
import { mapUnits, rhymeId, textKey, type MapTextField, type StoredMapText } from './conceptMapI18n';
import { STATUS_LABEL } from './mapAnchors';
import { articleSections } from './sections';
import { articlePath, conceptMapPath, DEFAULT_LANG, LANGS, seriesPath, type Lang } from './i18n';
import type { Alternates, Article } from './types';

/**
 * La Concept Map telle que la page `/concept-map` la montre (phase 4,
 * docs/superpowers/plans/2026-10-28-journal-map.md). Lue au BUILD : la carte
 * publiée, recalée sur le texte publié du moment (`checkConceptMap`), chaque
 * nœud muni de son lien. La dérive part dans le log du build en
 * `console.warn` et n'arrête jamais rien : le lien mène alors au meilleur
 * endroit encore trouvé (intertitre, sinon article).
 *
 * Trois langues (phase 5). La carte s'écrit en français ; en EN/RU, les
 * articles, leurs titres, chapôs, séries et thématiques sont ceux des
 * traductions publiées, et les libellés des thèses, des mécanismes et des
 * rimes viennent de `journalMap.translations` (lib/journal/conceptMapI18n.ts).
 * Les identifiants des nœuds restent ceux du français dans toutes les
 * langues : un `#n=<id>` vaut partout. Un article pas encore traduit sort de
 * la carte de cette langue ; un libellé pas encore traduit garde son
 * français (signalé au build).
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
  lang: Lang;
  /** Dans un article (`articleMapView`) : l'id de son nœud. */
  article?: string;
  nodes: MapViewNode[];
  edges: MapViewEdge[];
  /** Dans l'ordre d'apparition des articles, avec leur couleur (Studio, sinon `THEME_FALLBACK`). */
  themes: { title: string; color: string }[];
  series: { title: string; href: string }[];
};

/**
 * Aucune thématique n'a de couleur dans le Studio au 2026-10-29. Repli par
 * nom, palette donnée par Alexandre le 2026-10-29 (capture, huit tons pour
 * huit thématiques, attribués au plus près des teintes d'avant) ; une couleur
 * choisie dans le Studio passe devant. Les tons clairs (vert, cyan, jaune)
 * sont sous 3:1 sur le papier : ils marquent, ils ne portent aucun texte.
 */
const THEME_FALLBACK: Record<string, string> = {
  Economie: '#ffb200',
  Société: '#0013ff',
  Esprit: '#501ba1',
  Corps: '#ff5100',
  Psychologie: '#ff9065',
  Design: '#54f76d',
  Science: '#00eeff',
  Philosophie: '#9d9fb3',
};
const OTHER = '#8d887c';

type Anchors = { sections: Map<string, string>; paragraphs: Set<string> };

const hrefOf = (article: Article | undefined, target: { kind: string; key: string | null }, anchors: Anchors | undefined) => {
  if (!article) return '';
  const base = articlePath(article.slug, article.lang);
  // Une traduction à qui manque la clé du paragraphe (map:check le signale) : l'intertitre, sinon l'article.
  if (target.kind === 'paragraph' && target.key && anchors?.paragraphs.has(target.key)) return `${base}#p-${target.key}`;
  const section = target.kind === 'paragraph' ? null : target.key;
  if (section && anchors?.sections.has(section)) return `${base}#${anchors.sections.get(section)}`;
  return base;
};

const cached = new Map<Lang, Promise<MapView | null>>();

/** Une lecture par build et par langue, comme `getCorpus` : chaque page d'article en a besoin. */
export function getConceptMapView(lang: Lang = DEFAULT_LANG): Promise<MapView | null> {
  if (process.env.NODE_ENV !== 'production') return fetchConceptMapView(lang);
  if (!cached.has(lang)) cached.set(lang, fetchConceptMapView(lang));
  return cached.get(lang)!;
}

/** Les langues où la carte existe (hreflang, sélecteur, sitemap) : le français, et celles dont les libellés sont traduits. */
export async function conceptMapAlternates(): Promise<Alternates> {
  const views = await Promise.all(LANGS.map(async (l) => [l, await getConceptMapView(l)] as const));
  return Object.fromEntries(views.filter(([, v]) => v).map(([l]) => [l, conceptMapPath(l)]));
}

/**
 * Essai local des traductions avant de les écrire dans Sanity :
 * `MAP_TRANSLATIONS=<fichier de map:translate --out> npm run dev:blog`.
 * Jamais au build de production.
 */
async function localTranslations(): Promise<StoredMapText[] | null> {
  const file = process.env.MAP_TRANSLATIONS;
  if (!file || process.env.NODE_ENV === 'production') return null;
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(file, 'utf8')) as StoredMapText[];
}

/** L'adresse française d'un article (`/slug/`) : c'est ainsi que la carte le nomme. */
const frSlugOf = (a: Article) => a.alternates.fr?.split('/').filter(Boolean)[0];

async function fetchConceptMapView(lang: Lang): Promise<MapView | null> {
  if (!sanityClient) return null;
  const [map, posts, articles, frArticles, local] = await Promise.all([
    sanityClient.fetch<JournalMapDoc | null>(JOURNAL_MAP_QUERY, {}, { next: { revalidate: 60 } }),
    sanityClient.fetch<MapPosts>(MAP_POSTS_QUERY, {}, { next: { revalidate: 60 } }),
    getArticles(lang),
    getArticles('fr'),
    localTranslations(),
  ]);
  if (!map?.nodes?.length) return null;

  const { nodes: checked, issues, moved } = checkConceptMap(map, posts);
  if (lang === 'fr' && (issues.length || moved))
    console.warn(
      `Concept Map : ${moved} ancre(s) recalée(s), ${issues.length} en dérive` +
        issues.map((i) => `\n  ⚠ ${i.slug} · ${i.label} — ${STATUS_LABEL[i.status]}`).join(''),
    );

  // Les textes traduits, et ceux qui manquent ou ont vieilli (signalés, jamais bloquants).
  const texts = new Map((local ?? map.translations ?? []).filter((t) => t.lang === lang).map((t) => [textKey(t), t]));
  if (lang !== 'fr' && !texts.size) return null;
  const stale = { missing: 0, old: 0 };
  if (lang !== 'fr')
    for (const u of mapUnits(map, posts, lang)) {
      const t = texts.get(textKey(u));
      if (!t) stale.missing++;
      else if (t.src !== u.src) stale.old++;
    }
  if (stale.missing || stale.old)
    console.warn(`Concept Map (${lang}) : ${stale.missing} libellé(s) à traduire, ${stale.old} à revoir — npm run map:translate`);
  const tr = (id: string, field: MapTextField, fr: string | undefined) => (lang === 'fr' || !fr ? fr : (texts.get(textKey({ lang, id, field }))?.text ?? fr));

  // Les articles de la langue, sous leur nom français (celui de la carte).
  const bySlug = new Map(articles.flatMap((a) => (lang === 'fr' ? [[a.slug, a] as const] : frSlugOf(a) ? [[frSlugOf(a)!, a] as const] : [])));
  // L'id du H2 vient de son texte (`articleSections`) : la clé Sanity ne se voit pas dans la page.
  const anchors = new Map<string, Anchors>();
  for (const [slug, a] of bySlug) {
    const { idByBlock } = articleSections(a);
    const sections = new Map<string, string>();
    const paragraphs = new Set<string>();
    a.blocks.forEach((b, i) => {
      if (b.type === 'h2' && b.key && idByBlock.has(i)) sections.set(b.key, idByBlock.get(i)!);
      if (b.type === 'p' && b.key) paragraphs.add(b.key);
    });
    anchors.set(slug, { sections, paragraphs });
  }
  // Une thématique s'appelle dans la carte par son nom français : les articles donnent sa traduction.
  const themeName = new Map<string, string>();
  for (const fa of frArticles) {
    const a = bySlug.get(fa.slug);
    fa.tags.forEach((t, i) => a?.tags[i] && !themeName.has(t.title) && themeName.set(t.title, a.tags[i].title));
  }
  const localTheme = (fr: string) => themeName.get(fr) ?? fr;

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
  const themesOf = (articleId: string) => articleNode.get(articleId)?.themes?.filter(Boolean).map(localTheme) ?? [];
  const seriesOf = (articleId: string) => {
    const n = articleNode.get(articleId);
    return (n?.slug && bySlug.get(n.slug)?.series) || null;
  };

  const nodes: MapViewNode[] = [];
  for (const n of raw) {
    const c = checked.get(n.nodeId);
    const base = { id: n.nodeId, kind: n.kind, label: tr(n.nodeId, 'label', n.label)!, x: n.x, y: n.y };
    if (n.kind === 'article') {
      const a = n.slug ? bySlug.get(n.slug) : undefined;
      if (!a) continue;
      nodes.push({
        ...base,
        // En français, le nom donné dans le vault ; ailleurs, le titre de la traduction.
        label: lang === 'fr' ? n.label : a.title,
        href: articlePath(a.slug, lang),
        themes: themesOf(n.nodeId),
        series: a.series,
        dek: a.dek,
        part: a.series ? a.part : null,
        articles: [],
      });
    } else if (n.kind === 'thesis') {
      const art = n.article ?? '';
      if (!articleNode.has(art) || !c) continue;
      const slug = art.replace(/^a:/, '');
      nodes.push({
        ...base,
        href: hrefOf(bySlug.get(slug), c.target, anchors.get(slug)),
        themes: themesOf(art),
        series: seriesOf(art),
        articles: [art],
        order: n.order,
        covers: c.covers,
        quote: tr(n.nodeId, 'quote', n.quote),
      });
    } else {
      const used = (mechArticles.get(n.nodeId) ?? []).filter((a) => articleNode.has(a));
      if (!used.length) continue;
      const count = new Map<string, number>();
      for (const a of used) for (const t of themesOf(a)) count.set(t, (count.get(t) ?? 0) + 1);
      const themes = [...count.keys()];
      const theme = themes.sort((p, q) => count.get(q)! - count.get(p)!)[0] ?? null;
      // La citation d'un mécanisme vient d'un article qui peut manquer dans cette langue : elle reste, sans lien.
      const quoted = bySlug.get(n.quoteArticle ?? '');
      nodes.push({
        ...base,
        href: quoted ? hrefOf(quoted, c?.target ?? { kind: 'article', key: null }, anchors.get(n.quoteArticle!)) : '',
        themes,
        series: null,
        articles: used,
        quote: tr(n.nodeId, 'quote', n.quote),
        definition: tr(n.nodeId, 'definition', n.definition),
        theme,
      });
    }
  }
  const kept = new Set(nodes.map((n) => n.id));

  // Couleurs : celle du Studio quand elle existe, le repli (nommé en français) sinon.
  const tagColor = new Map<string, string>();
  for (const a of frArticles) for (const t of a.tags) if (t.color && !tagColor.has(localTheme(t.title))) tagColor.set(localTheme(t.title), t.color);
  const fallback = new Map(Object.entries(THEME_FALLBACK).map(([fr, color]) => [localTheme(fr), color]));
  const themeTitles = [...new Set(nodes.filter((n) => n.kind === 'article').flatMap((n) => n.themes))];
  const seriesTitles = [...new Set(nodes.filter((n) => n.kind === 'article' && n.series).map((n) => n.series!))];

  return {
    lang,
    nodes,
    edges: edges
      .filter((e) => ids.has(e.source) && kept.has(e.source) && kept.has(e.target))
      .map((e) => (e.why ? { ...e, why: tr(rhymeId(e), 'why', e.why) } : e)),
    themes: themeTitles.map((title) => ({ title, color: tagColor.get(title) ?? fallback.get(title) ?? OTHER })),
    series: seriesTitles.map((title) => {
      const a = articles.find((x) => x.series === title)!;
      return { title, href: seriesPath(a.seriesSlug!, lang) };
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
  // `slug` : l'adresse FRANÇAISE de l'article, celle qui le nomme dans la carte.
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
    lang: view.lang,
    article: articleId,
    nodes,
    edges: view.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
    themes: view.themes.filter((t) => themes.has(t.title)),
    series: view.series,
  };
}
