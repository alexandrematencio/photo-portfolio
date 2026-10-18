/**
 * Types du journal, sans dépendance au client Sanity : la page d'accueil du
 * journal (composant client) les importe.
 */

import type { Lang } from './i18n';

/** Chemin de la même page dans chaque langue où elle existe (hreflang, sélecteur). */
export type Alternates = Partial<Record<Lang, string>>;

export type VerdictKind = 'converge' | 'nuance' | 'open' | 'fails';

export type Verdict = { idea: string; prior: string; verdict: string; kind: VerdictKind };

export type InlineMark = 'strong' | 'em' | 'cite';

/** Le contenu d'une phrase : du texte marqué, un appel de référence, une note à trancher. */
export type Inline =
  | { t: 'text'; text: string; marks: InlineMark[] }
  | { t: 'ref'; key: string }
  | { t: 'draft'; text: string };

export type ArticleBlock =
  | { type: 'p'; inline: Inline[] }
  | { type: 'h2'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'figure'; name: 'loop' }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'verdicts'; rows: Verdict[] }
  /** Paragraphe entier « à trancher » : une question laissée ouverte par l'auteur. */
  | { type: 'draft'; text: string };

/** Ce que la page d'accueil du journal sait d'un article — pas son corps. */
export type ArticleSummary = {
  slug: string;
  /** Langue de cette version (lib/journal/i18n.ts). */
  lang: Lang;
  title: string;
  dek: string;
  /** Titre de la série, `null` pour un article isolé. */
  series: string | null;
  /** Identifiant de la série (son adresse, `seriesPath`), `null` hors série. */
  seriesSlug: string | null;
  part: number;
  /** AAAA-MM-JJ */
  date: string;
  minutes: number;
  referenceCount: number;
};

export type Article = ArticleSummary & {
  /** L'article dans les autres langues — l'original et ses traductions publiées. */
  alternates: Alternates;
  referencesNote?: string;
  /** Dernière modification dans Sanity (ISO) — `dateModified`, sitemap. */
  updatedAt?: string;
  words: number;
  /** Champs « Référencement » du Studio, facultatifs. */
  seoTitle?: string;
  seoDescription?: string;
  blocks: ArticleBlock[];
  /** Clé de référence → citation, dans l'ordre d'affichage de la bibliographie. */
  references: { key: string; citation: Inline[] }[];
};

/** Une série d'articles et sa page (`blog.amatencio.com/serie/<slug>/`). */
export type JournalSeries = {
  slug: string;
  lang: Lang;
  /** La page de la série dans chaque langue où elle a au moins un article. */
  alternates: Alternates;
  title: string;
  /** Champ « Présentation » du Studio, facultatif. */
  description?: string;
  /** Dans l'ordre de lecture. */
  articles: ArticleSummary[];
};
