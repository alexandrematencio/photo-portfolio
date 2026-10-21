import { sanityClient } from '@/lib/sanity/client';
import { AUTHOR_JOURNAL_SIGNATURE } from '@/lib/site/author';
import type { Article, ArticleSummary, JournalSeries } from './types';
import { DEFAULT_LANG, LANGS, articlePath, isLang, seriesPath, type Lang } from './i18n';
import { seriesIn, summarize, toArticle, type RawPost, type RawSeries } from './convert';

export { summarize };

/**
 * Les articles du journal, lus dans Sanity au build (export statique,
 * perspective `published` — un brouillon du Studio n'arrive jamais ici).
 * Schéma : `sanity/schemas/journal.ts`. La traduction du Portable Text vers
 * le modèle que rend `ArticleBody` vit dans `convert.ts`, partagée avec
 * l'aperçu du Studio.
 *
 * Trois langues (lib/journal/i18n.ts) : une traduction est un `post` qui
 * pointe son original (`translationOf`) et lui emprunte date, série et
 * partie. Une traduction dont l'original n'est pas publié n'existe pas.
 */

export const postsQuery = /* groq */ `
  *[_type == "post" && defined(slug.current)] {
    "slug": slug.current,
    "lang": coalesce(language, "fr"),
    "group": coalesce(translationOf._ref, _id),
    title,
    dek,
    "date": select(defined(translationOf) => translationOf->date, date),
    // Départage du même jour. Sans première publication (articles d'avant le 2026-10-18), la création.
    "publishedAt": select(defined(translationOf) => coalesce(translationOf->publishedAt, translationOf->_createdAt), coalesce(publishedAt, _createdAt)),
    "seriesId": select(defined(translationOf) => translationOf->series._ref, series._ref),
    "part": select(defined(translationOf) => translationOf->part, part),
    // Une traduction porte les thématiques de son original.
    "tags": select(defined(translationOf) => translationOf->tags, tags)[]->{ "slug": slug.current, title, "color": color.hex, translations },
    referencesNote,
    seoTitle,
    seoDescription,
    // Une traduction montre la couverture de son original.
    "cover": select(defined(translationOf) => translationOf->cover, cover),
    "updatedAt": _updatedAt,
    body,
    references[]{ _key, citation }
  }
`;

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
    // Du plus récent au plus ancien ; le même jour, le dernier publié devant.
    .sort((a, b) => b.date.localeCompare(a.date) || b.publishedAt.localeCompare(a.publishedAt) || (b.part ?? 0) - (a.part ?? 0))
    .map((r) => ({ article: toArticle(r, r.seriesId ? seriesById.get(r.seriesId) : undefined), group: r.group }));
  // Chaque version connaît ses sœurs : c'est le sélecteur de langue et le hreflang.
  const groups = new Map<string, Article[]>();
  for (const { article, group } of articles) groups.set(group, [...(groups.get(group) ?? []), article]);
  for (const versions of groups.values()) {
    const alternates = Object.fromEntries(versions.map((v) => [v.lang, articlePath(v.slug, v.lang)]));
    for (const v of versions) v.alternates = alternates;
  }
  // Un lien vers un article pointe sa version dans la langue de l'article qui
  // le cite, à défaut l'original. Un article non publié : lien retiré.
  for (const { article } of articles) {
    for (const block of article.blocks) {
      if (block.type !== 'p') continue;
      for (const node of block.inline) {
        if (node.t !== 'text' || !node.link || !('article' in node.link)) continue;
        const versions = groups.get(node.link.article) ?? [];
        const target = versions.find((v) => v.lang === article.lang) ?? versions.find((v) => v.lang === DEFAULT_LANG);
        if (target) node.link = { href: articlePath(target.slug, target.lang) };
        else delete node.link;
      }
    }
  }
  return {
    articles: articles
      .map((a) => a.article),
    series,
  };
}

function getCorpus(): Promise<Corpus> {
  if (!sanityClient) return Promise.resolve({ articles: [], series: [] });
  if (process.env.NODE_ENV !== 'production') return fetchCorpus();
  cached ??= fetchCorpus();
  return cached;
}

/** Les articles d’une langue, du plus récent au plus ancien ; à date égale, le dernier publié devant. */
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
 * Le texte de la page « À propos de ce journal » (Portable Text, rendu par
 * `PortableBody`). Traduction vide : le français, comme pour la signature.
 * `null` quand rien n'est publié — la page prend alors son repli.
 */
export async function getJournalAbout(lang: Lang = DEFAULT_LANG): Promise<unknown[] | null> {
  if (!sanityClient) return null;
  const body = await sanityClient.fetch<unknown[] | null>(
    /* groq */ `*[_id == "journalAboutPage"][0]{ "b": select($lang != "fr" && count(translations[$lang].body) > 0 => translations[$lang].body, body) }.b`,
    { lang },
    { next: { revalidate: 60 } },
  );
  return body?.length ? body : null;
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
