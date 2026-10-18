/**
 * LA DEMANDE DE TRADUCTION — le seul lien entre le Studio et le traducteur
 * (2026-10-18).
 *
 * Le Studio est un bundle statique dans un dépôt public : la clé Anthropic ne
 * peut pas y vivre. Le bouton « Publish + generate EN & RU » écrit donc un
 * document `translationJob` (statut `requested`) ; un webhook Sanity signé le
 * porte au VPS, qui lance `scripts/translate-post.ts --job <id>` ; le script
 * écrit l'avancement dans le même document, que le Studio écoute.
 *
 * - Un document PAR ARTICLE (`translationJob.<id de l'article>`) : une
 *   nouvelle demande écrase la précédente, l'historique ne sert à rien.
 * - L'identifiant contient un point : le document n'est PAS lisible par
 *   l'API publique (le dataset l'est). Seuls le Studio connecté et le
 *   script, qui a un jeton, le voient.
 * - Le webhook ne réagit qu'au statut `requested` : les écritures du script
 *   (`running`, `done`, `error`) ne relancent rien.
 *
 * Aucune dépendance : importé par le Studio et par le script.
 */

export const TRANSLATION_LANGS = ['en', 'ru'] as const;
export type TranslationLang = (typeof TRANSLATION_LANGS)[number];

export type TranslationJobStatus = 'requested' | 'running' | 'done' | 'error';

export type TranslationJob = {
  _id: string;
  _type: 'translationJob';
  _rev?: string;
  /** Id PUBLIÉ de l'article français. */
  post: string;
  status: TranslationJobStatus;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** Par langue : où le brouillon a été écrit, ou pourquoi il ne l'a pas été. */
  results?: Partial<Record<TranslationLang, { draftId?: string; slug?: string; error?: string }>>;
  error?: string;
};

export const translationJobId = (postId: string) => `translationJob.${postId.replace(/^drafts\./, '')}`;

/** Un article est « français » quand il n'a pas de langue (articles d'avant le 2026-10-18) ou `fr`. */
export const isFrenchPost = (doc: object | null | undefined) => {
  const language = (doc as { language?: unknown } | null | undefined)?.language;
  return !language || language === 'fr';
};

/** Au-delà, une demande `requested` ou `running` est tenue pour morte (VPS redémarré, webhook perdu). */
export const STALE_JOB_MS = 15 * 60_000;
