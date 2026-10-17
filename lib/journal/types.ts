/**
 * Types du journal, sans dépendance au client Sanity : la page d'accueil du
 * journal (composant client) les importe.
 */

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
  title: string;
  dek: string;
  /** Titre de la série, `null` pour un article isolé. */
  series: string | null;
  part: number;
  /** AAAA-MM-JJ */
  date: string;
  minutes: number;
  referenceCount: number;
};

export type Article = ArticleSummary & {
  referencesNote?: string;
  blocks: ArticleBlock[];
  /** Clé de référence → citation, dans l'ordre d'affichage de la bibliographie. */
  references: { key: string; citation: Inline[] }[];
};
