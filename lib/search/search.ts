import { phraseScore, tokenScore } from './distance';
import { tokenize } from './normalize';
import type {
  IndexedRecord,
  SearchIndex,
  SearchQuery,
  SearchResult,
} from './types';

/**
 * Meilleur score d'UN mot tapé sur UN document, tous champs confondus.
 *
 * Étages 1 et 3 sur les tokens du champ, étage 2 sur sa valeur entière — c'est
 * ce qui permet à « djfi » d'enjamber « djerba fishermen », qu'une comparaison
 * token par token ne verrait jamais.
 */
function wordScore<T>(word: string, record: IndexedRecord<T>): number {
  let best = 0;
  for (const field of record.fields) {
    let fieldBest = 0;
    for (const token of field.tokens) {
      const score = tokenScore(word, token);
      if (score > fieldBest) fieldBest = score;
      if (fieldBest === 1) break;
    }
    if (fieldBest < 0.7) {
      const phrase = phraseScore(word, field.phrase);
      if (phrase > fieldBest) fieldBest = phrase;
    }
    const weighted = fieldBest * field.weight;
    if (weighted > best) best = weighted;
  }
  return best;
}

/**
 * Score d'une requête complète.
 *
 * ⚠️ ET entre mots : un mot qui ne matche NULLE PART exclut le document. Taper
 * plusieurs mots restreint, ça n'élargit jamais. C'est l'attente universelle,
 * et l'inverse rend la deuxième frappe contre-productive.
 */
function documentScore<T>(
  words: string[],
  record: IndexedRecord<T>
): number | null {
  let total = 0;
  for (const word of words) {
    const score = wordScore(word, record);
    if (score === 0) return null;
    total += score;
  }
  return total / words.length;
}

export function search<T>(
  index: SearchIndex<T>,
  query: SearchQuery
): SearchResult<T> {
  const words = tokenize(query.text);
  const { tiebreak } = index.config;

  const scored: { record: IndexedRecord<T>; score: number }[] = [];
  for (const record of index.records) {
    if (words.length === 0) {
      scored.push({ record, score: 0 });
      continue;
    }
    const score = documentScore(words, record);
    if (score !== null) scored.push({ record, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return tiebreak ? tiebreak(a.record.doc, b.record.doc) : 0;
  });

  return {
    hits: scored.map(({ record, score }) => ({ doc: record.doc, score })),
    facets: [],
    suggestions: [],
    total: scored.length,
  };
}
