import type { RawPost, RawSeries } from './convert';

/**
 * Le contrat entre l'onglet « Aperçu » du Studio
 * (sanity/preview/ArticlePreviewView.tsx) et la page d'aperçu du blog
 * (components/journal/ArticlePreview.tsx), qui se parlent par `postMessage`
 * d'un domaine à l'autre. Un seul fichier pour les deux côtés.
 */

/** Blog → Studio : la page est montée, envoyer le brouillon. */
export const PREVIEW_READY = 'journal-preview:ready';
/** Studio → blog : le brouillon a changé. */
export const PREVIEW_UPDATE = 'journal-preview:update';

/** L'adresse de la page d'aperçu, sur le blog. */
export const PREVIEW_PATH = '/apercu/';

export type PreviewPayload = {
  /** Le brouillon, déjà mis en forme comme `postsQuery` (date, série et partie héritées pour une traduction). */
  raw: Omit<RawPost, 'date'> & { date: string | null };
  series: RawSeries | null;
  /** Les autres articles de sa série, dans sa langue — la navigation de fin d'article. */
  siblings: { slug: string; title: string; part: number | null }[];
  signature: string;
};
