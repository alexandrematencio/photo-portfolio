import { sanityClient } from '@/lib/sanity/client';
import { AUTHOR_JOURNAL_SIGNATURE } from '@/lib/site/author';
import type {
  Article,
  JournalSeries,
  ArticleBlock,
  ArticleSummary,
  Inline,
  InlineMark,
  Verdict,
} from './types';
import { DEFAULT_LANG, LANGS, articlePath, isLang, seriesPath, type Lang } from './i18n';

/**
 * Les articles du journal, lus dans Sanity au build (export statique,
 * perspective `published` — un brouillon du Studio n'arrive jamais ici).
 * Schéma : `sanity/schemas/journal.ts`. Ce module traduit le Portable Text
 * du Studio dans le modèle que rend `ArticleBody` (lib/journal/types.ts).
 *
 * Trois langues (lib/journal/i18n.ts) : une traduction est un `post` qui
 * pointe son original (`translationOf`) et lui emprunte date, série et
 * partie. Une traduction dont l'original n'est pas publié n'existe pas.
 */

/** Lecture silencieuse d'un texte argumentatif, en mots par minute. */
const WORDS_PER_MINUTE = 220;

const MARKS: InlineMark[] = ['strong', 'em', 'cite'];

export const postsQuery = /* groq */ `
  *[_type == "post" && defined(slug.current)] {
    "slug": slug.current,
    "lang": coalesce(language, "fr"),
    "group": coalesce(translationOf._ref, _id),
    title,
    dek,
    "date": select(defined(translationOf) => translationOf->date, date),
    "seriesId": select(defined(translationOf) => translationOf->series._ref, series._ref),
    "part": select(defined(translationOf) => translationOf->part, part),
    referencesNote,
    seoTitle,
    seoDescription,
    "updatedAt": _updatedAt,
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
  lang: string;
  group: string;
  title: string;
  dek: string;
  date: string | null;
  seriesId: string | null;
  part: number | null;
  referencesNote: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  updatedAt?: string;
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

/** La série telle qu'une langue la nomme (champ `translations` du Studio). */
type RawSeries = {
  _id: string;
  slug: string;
  title: string;
  description?: string | null;
  translations?: Partial<Record<Lang, { title?: string; slug?: { current?: string }; description?: string }>>;
};

function seriesIn(doc: RawSeries, lang: Lang) {
  const t = lang === DEFAULT_LANG ? undefined : doc.translations?.[lang];
  return {
    title: t?.title?.trim() || doc.title,
    slug: t?.slug?.current?.trim() || doc.slug,
    description: (lang === DEFAULT_LANG ? doc.description : t?.description)?.trim() || undefined,
  };
}

export function toArticle(raw: RawPost & { date: string; lang: Lang }, series: RawSeries | undefined): Article {
  const blocks = blocksOf(raw.body ?? []);
  const references = (raw.references ?? []).map((r) => ({
    key: r._key,
    citation: (r.citation ?? []).flatMap((b) => inlineOf(b.children)),
  }));
  const wordCount = words(blocks);
  const named = series ? seriesIn(series, raw.lang) : null;
  return {
    slug: raw.slug,
    lang: raw.lang,
    alternates: {},
    title: raw.title,
    dek: raw.dek,
    date: raw.date,
    series: named?.title ?? null,
    seriesSlug: named?.slug ?? null,
    part: raw.part ?? 0,
    referencesNote: raw.referencesNote ?? undefined,
    minutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
    words: wordCount,
    updatedAt: raw.updatedAt,
    seoTitle: raw.seoTitle ?? undefined,
    seoDescription: raw.seoDescription ?? undefined,
    referenceCount: references.length,
    blocks,
    references,
  };
}

const seriesQuery = /* groq */ `
  *[_type == "journalSeries" && defined(slug.current)] { _id, "slug": slug.current, title, description, translations }
`;

type Corpus = { articles: Article[]; series: RawSeries[] };

/**
 * Une seule lecture par BUILD : chaque page du journal appelle `getArticles`.
 * Pas en dev — le module y survit d'une requête à l'autre, et une édition du
 * Studio n'apparaîtrait plus qu'au redémarrage du serveur.
 */
let cached: Promise<Corpus> | null = null;

async function fetchCorpus(): Promise<Corpus> {
  const [raws, series] = await Promise.all([
    sanityClient!.fetch<RawPost[]>(postsQuery, {}, { next: { revalidate: 60 } }),
    sanityClient!.fetch<RawSeries[]>(seriesQuery, {}, { next: { revalidate: 60 } }),
  ]);
  const seriesById = new Map(series.map((s) => [s._id, s]));
  const articles = raws
    // Sans date, c'est une traduction dont l'original n'est pas publié.
    .filter((r): r is RawPost & { date: string; lang: Lang } => Boolean(r.date) && isLang(r.lang))
    .map((r) => ({ article: toArticle(r, r.seriesId ? seriesById.get(r.seriesId) : undefined), group: r.group }));
  // Chaque version connaît ses sœurs : c'est le sélecteur de langue et le hreflang.
  const groups = new Map<string, Article[]>();
  for (const { article, group } of articles) groups.set(group, [...(groups.get(group) ?? []), article]);
  for (const versions of groups.values()) {
    const alternates = Object.fromEntries(versions.map((v) => [v.lang, articlePath(v.slug, v.lang)]));
    for (const v of versions) v.alternates = alternates;
  }
  return {
    articles: articles
      .map((a) => a.article)
      .sort((a, b) => b.date.localeCompare(a.date) || b.part - a.part),
    series,
  };
}

function getCorpus(): Promise<Corpus> {
  if (!sanityClient) return Promise.resolve({ articles: [], series: [] });
  if (process.env.NODE_ENV !== 'production') return fetchCorpus();
  cached ??= fetchCorpus();
  return cached;
}

/** Les articles d'une langue, du plus récent au plus ancien ; à date égale, la partie la plus avancée d'abord. */
export async function getArticles(lang: Lang = DEFAULT_LANG): Promise<Article[]> {
  return (await getCorpus()).articles.filter((a) => a.lang === lang);
}

/** Toutes les langues — sitemap. */
export async function getAllArticles(): Promise<Article[]> {
  return (await getCorpus()).articles;
}

export async function getArticle(slug: string, lang: Lang = DEFAULT_LANG): Promise<Article | undefined> {
  return (await getArticles(lang)).find((a) => a.slug === slug);
}

export function summarize(article: Article): ArticleSummary {
  const { slug, lang, title, dek, series, seriesSlug, part, date, minutes, referenceCount } = article;
  return { slug, lang, title, dek, series, seriesSlug, part, date, minutes, referenceCount };
}

/** Les articles d'une série, dans l'ordre de lecture. Vide pour un article isolé. */
export async function getSeries(seriesSlug: string | null, lang: Lang = DEFAULT_LANG): Promise<ArticleSummary[]> {
  if (!seriesSlug) return [];
  return (await getArticles(lang))
    .filter((a) => a.seriesSlug === seriesSlug)
    .sort((a, b) => a.part - b.part)
    .map(summarize);
}

/** La phrase sous le nom de l'auteur, au pied des articles. */
export async function getSignature(lang: Lang = DEFAULT_LANG): Promise<string> {
  const text = sanityClient
    ? await sanityClient.fetch<string | null>(
        /* groq */ `*[_id == "journalSettings"][0]{ "s": select($lang == "fr" => signature, translations[$lang].signature) }.s`,
        { lang },
        { next: { revalidate: 60 } },
      )
    : null;
  return text?.trim() || AUTHOR_JOURNAL_SIGNATURE[lang];
}

/**
 * Les séries d'une langue qui ont au moins un article publié dans cette
 * langue — une page de série vide n'existe pas. Ordre : la série dont le
 * dernier article est le plus récent d'abord.
 */
export async function getAllSeries(lang: Lang = DEFAULT_LANG): Promise<JournalSeries[]> {
  const { articles, series } = await getCorpus();
  const build = (doc: RawSeries, l: Lang): JournalSeries => {
    const named = seriesIn(doc, l);
    return {
      slug: named.slug,
      lang: l,
      alternates: {},
      title: named.title,
      description: named.description,
      articles: articles
        .filter((a) => a.lang === l && a.seriesSlug === named.slug)
        .sort((a, b) => a.part - b.part)
        .map(summarize),
    };
  };
  return series
    .map((doc) => {
      const versions = LANGS.map((l) => build(doc, l)).filter((v) => v.articles.length > 0);
      const alternates = Object.fromEntries(versions.map((v) => [v.lang, seriesPath(v.slug, v.lang)]));
      const self = versions.find((v) => v.lang === lang);
      return self ? { ...self, alternates } : null;
    })
    .filter((s): s is JournalSeries => s !== null)
    .sort((a, b) => latest(b).localeCompare(latest(a)));
}

function latest(s: JournalSeries) {
  return s.articles.map((a) => a.date).sort().at(-1) ?? '';
}

export async function getSeriesBySlug(slug: string, lang: Lang = DEFAULT_LANG): Promise<JournalSeries | undefined> {
  return (await getAllSeries(lang)).find((s) => s.slug === slug);
}
