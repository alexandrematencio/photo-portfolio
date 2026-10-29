import { urlFor } from '@/lib/sanity/image';
import type {
  Article,
  ArticleBlock,
  ArticleSummary,
  Inline,
  InlineLink,
  InlineMark,
  FigureName,
  JournalImage,
  JournalTag,
  Verdict,
} from './types';
import { FIGURE_NAMES } from './types';
import { DEFAULT_LANG, type Lang } from './i18n';

/**
 * Du Portable Text du Studio au modèle que rend `ArticleBody`
 * (lib/journal/types.ts). Sans client Sanity : l'aperçu du Studio
 * (`ArticlePreview`, composant client) convertit le brouillon avec les mêmes
 * fonctions que le build — un article prévisualisé est l'article publié.
 */

/** Lecture silencieuse d'un texte argumentatif, en mots par minute. */
const WORDS_PER_MINUTE = 220;

const MARKS: InlineMark[] = ['strong', 'em', 'cite', 'highlight'];

/** Une image telle que le Studio la stocke : un asset, un recadrage facultatif, un texte alternatif. */
export type RawImage = {
  asset?: { _ref?: string };
  hotspot?: { x?: number; y?: number };
  crop?: { top?: number; bottom?: number; left?: number; right?: number };
  alt?: string;
} | null;

/** Largeurs servies (`srcset`) : la vignette de l'accueil, la mesure de lecture, la colonne, en 1x et 2x. */
const IMAGE_WIDTHS = [440, 800, 1200, 1600];

/** `image-<hash>-1600x1067-jpg` → 1600 × 1067. */
function dimensionsOf(ref: string): { width: number; height: number } | null {
  const m = /-(\d+)x(\d+)-[a-z0-9]+$/i.exec(ref);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

export function imageOf(raw: RawImage | undefined): JournalImage | null {
  const ref = raw?.asset?._ref;
  const dims = ref ? dimensionsOf(ref) : null;
  const base = raw && dims ? urlFor(raw) : null;
  if (!raw || !dims || !base) return null;
  const at = (w: number) => base.width(w).fit('max').auto('format').quality(82).url();
  const { x = 0.5, y = 0.5 } = raw.hotspot ?? {};
  // Un recadrage du Studio change les proportions servies par le CDN.
  const { top = 0, bottom = 0, left = 0, right = 0 } = raw.crop ?? {};
  return {
    src: at(1600),
    srcSet: IMAGE_WIDTHS.map((w) => `${at(w)} ${w}w`).join(', '),
    width: Math.round(dims.width * (1 - left - right)),
    height: Math.round(dims.height * (1 - top - bottom)),
    alt: raw.alt?.trim() ?? '',
    position: `${Math.round(x * 100)}% ${Math.round(y * 100)}%`,
    // JPEG imposé : `auto('format')` négocie sur l'en-tête Accept, et les
    // robots de partage n'en envoient pas toujours un qui serve du WebP.
    share: base.width(1200).height(630).fit('crop').format('jpg').quality(82).url(),
  };
}

export type PTChild =
  | { _type: 'span'; text: string; marks?: string[] }
  | { _type: 'journalNoteRef'; refKey?: string }
  | { _type: 'journalDraftNote'; text?: string };

/** Annotation du Studio : `journalLink` (sanity/schemas/journal.ts). */
export type PTMarkDef = { _key: string; _type: string; article?: { _ref?: string }; href?: string };

export type PTBlock =
  | { _type: 'block'; _key?: string; style?: string; children?: PTChild[]; markDefs?: PTMarkDef[] }
  | { _type: 'journalPullQuote'; text?: string }
  | { _type: 'journalFigure'; figure?: string }
  | { _type: 'journalImage'; image?: RawImage; caption?: string; wide?: boolean }
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
  publishedAt: string;
  seriesId: string | null;
  part: number | null;
  referencesNote: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  updatedAt?: string;
  cover?: RawImage;
  /** `null` dans la liste : une thématique référencée mais pas encore publiée. */
  tags?: (RawTag | null)[] | null;
  body: PTBlock[] | null;
  references: { _key: string; citation?: { children?: PTChild[] }[] }[] | null;
};

function linkOf(def: PTMarkDef | undefined): InlineLink | undefined {
  if (def?._type !== 'journalLink') return undefined;
  if (def.article?._ref) return { article: def.article._ref };
  if (def.href) return { href: def.href };
  return undefined;
}

function inlineOf(children: PTChild[] = [], markDefs: PTMarkDef[] = []): Inline[] {
  const out: Inline[] = [];
  const defs = new Map(markDefs.map((d) => [d._key, d]));
  for (const c of children) {
    if (c._type === 'span') {
      if (!c.text) continue;
      const marks = (c.marks ?? []).filter((m): m is InlineMark => MARKS.includes(m as InlineMark));
      const link = (c.marks ?? []).map((m) => linkOf(defs.get(m))).find(Boolean);
      out.push(link ? { t: 'text', text: c.text, marks, link } : { t: 'text', text: c.text, marks });
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
          if (text) blocks.push({ type: 'h2', text, key: b._key });
        } else {
          const inline = inlineOf(b.children, b.markDefs);
          if (inline.length) blocks.push({ type: 'p', inline, key: b._key });
        }
        break;
      }
      case 'journalPullQuote':
        if (b.text) blocks.push({ type: 'quote', text: b.text });
        break;
      case 'journalFigure':
        if ((FIGURE_NAMES as readonly string[]).includes(b.figure ?? '')) blocks.push({ type: 'figure', name: b.figure as FigureName });
        break;
      case 'journalImage': {
        const image = imageOf(b.image);
        if (image) blocks.push({ type: 'image', image, caption: b.caption?.trim() || undefined, wide: Boolean(b.wide) });
        break;
      }
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
export type RawSeries = {
  _id: string;
  slug: string;
  title: string;
  description?: string | null;
  translations?: Partial<Record<Lang, { title?: string; slug?: { current?: string }; description?: string }>>;
};

export function seriesIn(doc: RawSeries, lang: Lang) {
  const t = lang === DEFAULT_LANG ? undefined : doc.translations?.[lang];
  return {
    title: t?.title?.trim() || doc.title,
    slug: t?.slug?.current?.trim() || doc.slug,
    description: (lang === DEFAULT_LANG ? doc.description : t?.description)?.trim() || undefined,
  };
}

/** Une thématique telle que le Studio la stocke : le nom français, ses traductions. */
export type RawTag = {
  slug?: string | null;
  title?: string | null;
  color?: string | null;
  translations?: Partial<Record<Lang, { title?: string }>>;
};

export function tagsIn(raws: RawPost['tags'], lang: Lang): JournalTag[] {
  return (raws ?? [])
    .filter((t): t is RawTag & { slug: string; title: string } => Boolean(t?.slug && t.title))
    .map((t) => ({
      slug: t.slug,
      title: (lang === DEFAULT_LANG ? undefined : t.translations?.[lang]?.title?.trim()) || t.title,
      color: t.color ?? null,
    }));
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
    tags: tagsIn(raw.tags, raw.lang),
    referencesNote: raw.referencesNote ?? undefined,
    minutes: Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)),
    words: wordCount,
    updatedAt: raw.updatedAt,
    seoTitle: raw.seoTitle ?? undefined,
    seoDescription: raw.seoDescription ?? undefined,
    referenceCount: references.length,
    cover: imageOf(raw.cover),
    blocks,
    references,
  };
}


export function summarize(article: Article): ArticleSummary {
  const { slug, lang, title, dek, series, seriesSlug, part, tags, date, minutes, referenceCount, cover } = article;
  return { slug, lang, title, dek, series, seriesSlug, part, tags, date, minutes, referenceCount, cover };
}
