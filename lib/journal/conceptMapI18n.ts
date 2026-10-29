/**
 * LES LIBELLÉS DE LA CONCEPT MAP EN ANGLAIS ET EN RUSSE (phase 5,
 * docs/superpowers/plans/2026-10-28-journal-map.md).
 *
 * La carte s'écrit en français, dans le vault. Ses traductions vivent dans
 * le même document Sanity (`journalMap.translations`), une entrée par texte :
 * libellé, définition et citation d'un nœud, « pourquoi » d'une rime. Chaque
 * entrée garde l'EMPREINTE (`src`) du français qu'elle traduit : une phrase
 * reprise dans le vault, ou un article retraduit, et l'entrée est périmée —
 * `map:translate` la redemande, sans toucher aux autres.
 *
 * Les titres, chapôs, séries et thématiques ne passent pas par ici : ils
 * viennent des articles traduits eux-mêmes.
 *
 * Une CITATION n'est pas retraduite : c'est la phrase de l'article traduit
 * qui dit la même chose, recopiée telle quelle. Le paragraphe d'ancre est le
 * même dans les trois langues (les clés sont partagées) ; quand il compte
 * autant de phrases qu'en français, la phrase de même rang est reprise
 * d'office (`alignQuote`), sinon elle se choisit à la main.
 *
 * Module pur : le build du site et `scripts/map-translate.ts` s'en servent.
 */
import { checkConceptMap, type JournalMapDoc, type MapPosts, type StoredMapEdge } from './conceptMap';
import { blockText, normalizeQuote, type MapBlock } from './mapAnchors';
import type { Lang } from './i18n';

export type MapLang = Exclude<Lang, 'fr'>;
export const MAP_LANGS: MapLang[] = ['en', 'ru'];

export type MapTextField = 'label' | 'definition' | 'quote' | 'why';

/** Une traduction stockée. `id` : celui du nœud, ou `rhymeId(edge)` pour une rime. */
export type StoredMapText = {
  lang: MapLang;
  id: string;
  field: MapTextField;
  /** Empreinte du français (et, pour une citation, du paragraphe traduit) au moment de la traduction. */
  src: string;
  text: string;
  /** Citation reprise d'office par `alignQuote`. */
  auto?: boolean;
};

/** Un texte à traduire, tel que le calcule `mapUnits`. */
export type MapUnit = {
  lang: MapLang;
  id: string;
  field: MapTextField;
  fr: string;
  src: string;
  /** Citation : le paragraphe d'ancre en français et dans la langue visée. */
  frParagraph?: string;
  paragraph?: string;
};

export const textKey = (t: { lang: string; id: string; field: string }) => `${t.lang}|${t.id}|${t.field}`;
export const rhymeId = (e: Pick<StoredMapEdge, 'source' | 'target'>) => `rhyme|${e.source}|${e.target}`;

/** FNV-1a 32 bits : de quoi voir qu'un texte a changé, sans dépendance à Node. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Les textes de la carte à traduire dans une langue : ceux des articles qui y existent. */
export function mapUnits(map: JournalMapDoc, posts: MapPosts, lang: MapLang): MapUnit[] {
  const { nodes: checked } = checkConceptMap(map, posts);
  const frBody = new Map(posts.fr.map((p) => [p.slug, p.body]));
  const trBody = new Map(posts.tr.filter((t) => t.language === lang && t.source).map((t) => [t.source!, t.body]));
  const textAt = (body: MapBlock[] | undefined, key: string | null) => {
    const b = key ? body?.find((x) => x._key === key) : undefined;
    return b && blockText(b).trim() ? blockText(b) : undefined;
  };

  const nodes = map.nodes ?? [];
  const translated = new Set(nodes.filter((n) => n.kind === 'thesis' && trBody.has(n.article?.replace(/^a:/, '') ?? '')).map((n) => n.nodeId));
  // Un mécanisme se traduit dès qu'un article traduit l'emploie.
  const mechs = new Set((map.edges ?? []).filter((e) => e.kind === 'uses' && translated.has(e.source)).map((e) => e.target));

  const units: MapUnit[] = [];
  const add = (id: string, field: MapTextField, fr: string | undefined, quoteIn?: { slug: string; key: string | null }) => {
    if (!fr?.trim()) return;
    if (!quoteIn) return units.push({ lang, id, field, fr, src: hashText(fr) });
    const paragraph = textAt(trBody.get(quoteIn.slug), quoteIn.key);
    units.push({
      lang,
      id,
      field,
      fr,
      src: hashText(`${fr}\u0000${paragraph ?? ''}`),
      frParagraph: textAt(frBody.get(quoteIn.slug), quoteIn.key),
      paragraph,
    });
  };
  for (const n of nodes) {
    if (n.kind === 'thesis' && translated.has(n.nodeId)) {
      const target = checked.get(n.nodeId)?.target;
      add(n.nodeId, 'label', n.label);
      add(n.nodeId, 'quote', n.quote, { slug: n.article!.replace(/^a:/, ''), key: target?.kind === 'paragraph' ? target.key : null });
    } else if (n.kind === 'mechanism' && mechs.has(n.nodeId)) {
      const target = checked.get(n.nodeId)?.target;
      add(n.nodeId, 'label', n.label);
      add(n.nodeId, 'definition', n.definition);
      // La citation d'un mécanisme vient d'un seul article : non traduit, elle se traduit librement.
      if (n.quoteArticle && trBody.has(n.quoteArticle))
        add(n.nodeId, 'quote', n.quote, { slug: n.quoteArticle, key: target?.kind === 'paragraph' ? target.key : null });
      else add(n.nodeId, 'quote', n.quote);
    }
  }
  for (const e of map.edges ?? []) if (e.kind === 'rhyme' && mechs.has(e.source) && mechs.has(e.target)) add(rhymeId(e), 'why', e.why);
  return units;
}

// Une fin de phrase : ponctuation forte, guillemet fermant éventuel, puis une majuscule (latine ou cyrillique).
const SENTENCE_END = /(?<=[.!?…])["»”)]?\s+(?=[«“"(–—A-ZÀ-ÖØ-ÞА-ЯЁ0-9])/;
const sentences = (text: string) => text.trim().split(SENTENCE_END).filter(Boolean);

/**
 * La phrase du paragraphe traduit qui porte la citation : celle de même rang,
 * quand les deux paragraphes ont autant de phrases et que la citation tient
 * dans une seule d'entre elles, pour l'essentiel (une citation qui n'en prend
 * qu'un bout se choisit à la main : la phrase entière en dirait plus).
 */
export function alignQuote(quote: string, frParagraph: string | undefined, paragraph: string | undefined): string | null {
  if (!frParagraph || !paragraph) return null;
  const fr = sentences(frParagraph);
  const tr = sentences(paragraph);
  if (fr.length !== tr.length) return null;
  const q = normalizeQuote(quote);
  const at = fr.findIndex((s) => normalizeQuote(s).includes(q));
  if (at < 0 || q.length < 0.6 * normalizeQuote(fr[at]).length) return null;
  return tr[at].trim();
}

/** Une citation choisie à la main doit être recopiée du paragraphe traduit, pas réécrite. */
export const quoteFits = (text: string, paragraph: string | undefined) => !paragraph || normalizeQuote(paragraph).includes(normalizeQuote(text));
