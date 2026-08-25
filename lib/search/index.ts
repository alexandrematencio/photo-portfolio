/**
 * Noyau de recherche à facettes — réexport public.
 *
 * ⚠️ Ce dossier n'importe NI React, NI Sanity, NI Next, NI Tailwind (seul
 * `useFacetedSearch` importe `react`). C'est la contrainte qui le rend
 * transposable à une autre affaire : on remplace la configuration, pas le
 * moteur. Voir la spec §9.
 */
export { fold, tokenize, wordStarts } from './normalize';
export { errorBudget, boundedOsa, tokenScore, phraseScore } from './distance';
export { buildIndex } from './buildIndex';
export { search } from './search';
export type * from './types';
