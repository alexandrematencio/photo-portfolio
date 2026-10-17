import { sanityClient } from '@/lib/sanity/client';
import type {
  Article,
  ArticleBlock,
  ArticleSummary,
  Inline,
  InlineMark,
  Verdict,
} from './types';

/**
 * Les articles du journal, lus dans Sanity au build (export statique,
 * perspective `published` — un brouillon du Studio n'arrive jamais ici).
 * Schéma : `sanity/schemas/journal.ts`. Ce module traduit le Portable Text
 * du Studio dans le modèle que rend `ArticleBody` (lib/journal/types.ts).
 */

/** Lecture silencieuse d'un texte argumentatif, en mots par minute. */
const WORDS_PER_MINUTE = 220;

const MARKS: InlineMark[] = ['strong', 'em', 'cite'];

export const postsQuery = /* groq */ `
  *[_type == "post" && defined(slug.current)] {
    "slug": slug.current,
    title,
    dek,
    date,
    "series": series->title,
    part,
    referencesNote,
    body,
    references[]{ _key, citation }
  }
`;

type PTChild =
  | { _type: 'span'; text: string; marks?: string[] }
  | { _type: 'journalNoteRef'; refKey?: string }
  | { _type: 'journalDraftNote'; text?: string };

type PTBlock =
  | { _type: 'block'; style?: string; children?: PTChild[] }
  | { _type: 'journalPullQuote'; text?: string }
  | { _type: 'journalFigure'; figure?: string }
  | { _type: 'journalTable'; head?: string[]; rows?: { cells?: string[] }[] }
  | { _type: 'journalVerdicts'; rows?: Verdict[] }
  | { _type: 'journalDraftBlock'; text?: string };

export type RawPost = {
  slug: string;
  title: string;
  dek: string;
  date: string;
  series: string | null;
  part: number | null;
  referencesNote: string | null;
  body: PTBlock[] | null;
  references: { _key: string; citation?: { children?: PTChild[] }[] }[] | null;
};

function inlineOf(children: PTChild[] = []): Inline[] {
  const out: Inline[] = [];
  for (const c of children) {
    if (c._type === 'span') {
      if (c.text) out.push({ t: 'text', text: c.text, marks: (c.marks ?? []).filter((m): m is InlineMark => MARKS.includes(m as InlineMark)) });
    } else if (c._type === 'journalNoteRef') {
      if (c.refKey) out.push({ t: 'ref', key: c.refKey });
    } else if (c._type === 'journalDraftNote') {
      if (c.text) out.push({ t: 'draft', text: c.text });
    }
  }
  return out;
}

function plainOf(children: PTChild[] = []) {
  return children.map((c) => (c._type === 'span' ? c.text : '')).join('');
}

function blocksOf(body: PTBlock[]): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const b of body) {
    switch (b._type) {
      case 'block': {
        if (b.style === 'h2') {
          const text = plainOf(b.children).trim();
          if (text) blocks.push({ type: 'h2', text });
        } else {
          const inline = inlineOf(b.children);
          if (inline.length) blocks.push({ type: 'p', inline });
        }
        break;
      }
      case 'journalPullQuote':
        if (b.text) blocks.push({ type: 'quote', text: b.text });
        break;
      case 'journalFigure':
        if (b.figure === 'loop') blocks.push({ type: 'figure', name: 'loop' });
        break;
      case 'journalTable':
        blocks.push({ type: 'table', head: b.head ?? [], rows: (b.rows ?? []).map((r) => r.cells ?? []) });
        break;
      case 'journalVerdicts':
        blocks.push({ type: 'verdicts', rows: b.rows ?? [] });
        break;
      case 'journalDraftBlock':
        if (b.text) blocks.push({ type: 'draft', text: b.text });
        break;
    }
  }
  return blocks;
}

function words(blocks: ArticleBlock[]) {
  let n = 0;
  for (const b of blocks) {
    const text =
      b.type === 'p' ? b.inline.map((i) => (i.t === 'text' ? i.text : '')).join('') : 'text' in b ? b.text : '';
    n += text.split(/\s+/).filter(Boolean).length;
  }
  return n;
}

export function toArticle(raw: RawPost): Article {
  const blocks = blocksOf(raw.body ?? []);
  const references = (raw.references ?? []).map((r) => ({
    key: r._key,
    citation: (r.citation ?? []).flatMap((b) => inlineOf(b.children)),
  }));
  return {
    slug: raw.slug,
    title: raw.title,
    dek: raw.dek,
    date: raw.date,
    series: raw.series ?? null,
    part: raw.part ?? 0,
    referencesNote: raw.referencesNote ?? undefined,
    minutes: Math.max(1, Math.round(words(blocks) / WORDS_PER_MINUTE)),
    referenceCount: references.length,
    blocks,
    references,
  };
}

/**
 * Une seule lecture par BUILD : chaque page du journal appelle `getArticles`.
 * Pas en dev — le module y survit d'une requête à l'autre, et une édition du
 * Studio n'apparaîtrait plus qu'au redémarrage du serveur.
 */
let cached: Promise<Article[]> | null = null;

function fetchArticles(): Promise<Article[]> {
  return sanityClient!
    .fetch<RawPost[]>(postsQuery, {}, { next: { revalidate: 60 } })
    .then((raws) => raws.map(toArticle).sort((a, b) => b.date.localeCompare(a.date) || b.part - a.part));
}

/** Du plus récent au plus ancien ; à date égale, la partie la plus avancée d'abord. */
export function getArticles(): Promise<Article[]> {
  if (!sanityClient) return Promise.resolve([]);
  if (process.env.NODE_ENV !== 'production') return fetchArticles();
  cached ??= fetchArticles();
  return cached;
}

export async function getArticle(slug: string): Promise<Article | undefined> {
  return (await getArticles()).find((a) => a.slug === slug);
}

export function summarize(article: Article): ArticleSummary {
  const { slug, title, dek, series, part, date, minutes, referenceCount } = article;
  return { slug, title, dek, series, part, date, minutes, referenceCount };
}

/** Les articles d'une série, dans l'ordre de lecture. Vide pour un article isolé. */
export async function getSeries(series: string | null): Promise<ArticleSummary[]> {
  if (!series) return [];
  return (await getArticles())
    .filter((a) => a.series === series)
    .sort((a, b) => a.part - b.part)
    .map(summarize);
}
