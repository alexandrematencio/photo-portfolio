import { boundedOsa, errorBudget, phraseScore, tokenScore } from './distance';
import { fold, tokenize } from './normalize';
import type {
  FacetGroup,
  FacetSpec,
  FacetSuggestion,
  FacetValue,
  IndexedRecord,
  Primitive,
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

/** Sélections non vides seulement — une facette à tableau vide est inactive. */
function activeSelections(
  facets: Record<string, Primitive[]>
): [string, Primitive[]][] {
  return Object.entries(facets).filter(([, values]) => values.length > 0);
}

/**
 * Le document satisfait-il les facettes actives ?
 *
 * ⚠️ OU à l'intérieur d'une facette, ET entre facettes. Cocher 2024 ET 2025
 * élargit ; cocher 2024 ET Djerba restreint.
 *
 * `except` permet d'exclure UNE facette du filtrage — c'est le mécanisme du
 * comptage décrit plus bas, et il n'a pas d'autre usage.
 */
function matchesFacets<T>(
  record: IndexedRecord<T>,
  selections: [string, Primitive[]][],
  except?: string
): boolean {
  for (const [key, wanted] of selections) {
    if (key === except) continue;
    const owned = record.facets.get(key) ?? [];
    if (!owned.some((value) => wanted.includes(value))) return false;
  }
  return true;
}

function sortFacetValues<T>(
  spec: FacetSpec<T>,
  values: FacetValue[]
): FacetValue[] {
  const mode = spec.sort ?? 'count';
  return values.sort((a, b) => {
    if (mode === 'value-desc') return Number(b.value) - Number(a.value);
    if (mode === 'label') return a.label.localeCompare(b.label, 'fr');
    return b.count - a.count || a.label.localeCompare(b.label, 'fr');
  });
}

/**
 * Comptes d'une facette.
 *
 * ⚠️ Les compteurs d'une facette IGNORENT ses propres sélections : chaque
 * facette est comptée sur le résultat filtré par le texte et par TOUTES LES
 * AUTRES. Sans cette règle, cocher 2024 fait tomber toutes les autres années à
 * zéro et le multi-choix devient inutilisable — le défaut le plus répandu des
 * implémentations maison.
 */
function buildFacetGroups<T>(
  index: SearchIndex<T>,
  textMatched: IndexedRecord<T>[],
  selections: [string, Primitive[]][]
): FacetGroup[] {
  return index.config.facets.map((spec) => {
    const pool = textMatched.filter((record) =>
      matchesFacets(record, selections, spec.key)
    );
    const counts = new Map<Primitive, number>();
    for (const record of pool) {
      for (const value of record.facets.get(spec.key) ?? []) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    const selected = selections.find(([key]) => key === spec.key)?.[1] ?? [];
    const values: FacetValue[] = Array.from(
      index.facetValues.get(spec.key) ?? []
    ).map((value) => {
      const count = counts.get(value) ?? 0;
      return {
        value,
        label: String(value),
        count,
        active: selected.includes(value),
        disabled: count === 0,
      };
    });
    return {
      key: spec.key,
      label: spec.label,
      values: sortFacetValues(spec, values),
    };
  });
}

const MAX_SUGGESTIONS = 6;

/**
 * Valeurs de facette à proposer dans l'omnibox pour le mot en cours de frappe.
 *
 * C'est ce qui remplace une SYNTAXE : l'utilisateur n'apprend pas « camera: »,
 * on lui propose « Fujifilm X-PRO 2 — boîtier · 12 » et un clic pose le jeton.
 * Une valeur déjà cochée n'est jamais proposée, et une valeur à zéro non plus.
 */
function buildSuggestions(
  groups: FacetGroup[],
  facetLabels: Map<string, string>,
  lastWord: string
): FacetSuggestion[] {
  if (!lastWord) return [];
  const out: { suggestion: FacetSuggestion; score: number }[] = [];
  for (const group of groups) {
    for (const value of group.values) {
      if (value.active || value.count === 0) continue;
      let best = phraseScore(lastWord, fold(value.label));
      for (const token of tokenize(value.label)) {
        const score = tokenScore(lastWord, token);
        if (score > best) best = score;
      }
      if (best === 0) continue;
      out.push({
        score: best,
        suggestion: {
          facetKey: group.key,
          facetLabel: facetLabels.get(group.key) ?? group.key,
          value: value.value,
          label: value.label,
          count: value.count,
        },
      });
    }
  }
  return out
    .sort((a, b) => b.score - a.score || b.suggestion.count - a.suggestion.count)
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => entry.suggestion);
}

/**
 * Sur zéro résultat, le mot du vocabulaire le plus proche du mot tapé le plus
 * long, budget élargi d'UN cran. L'élargissement est le point : si le budget
 * normal avait suffi, il y aurait eu des résultats.
 */
function findDidYouMean(
  vocabulary: string[],
  words: string[]
): string | undefined {
  if (words.length === 0) return undefined;
  const target = words.reduce((a, b) => (b.length > a.length ? b : a));
  const budget = errorBudget(target.length) + 1;
  let best: string | undefined;
  let bestDistance = budget + 1;
  for (const candidate of vocabulary) {
    const distance = boundedOsa(target, candidate, budget);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= budget ? best : undefined;
}

export function search<T>(
  index: SearchIndex<T>,
  query: SearchQuery
): SearchResult<T> {
  const words = tokenize(query.text);
  const selections = activeSelections(query.facets);
  const { tiebreak } = index.config;

  // 1. Filtrage TEXTE seul — c'est le vivier sur lequel les facettes se comptent.
  const textMatched: { record: IndexedRecord<T>; score: number }[] = [];
  for (const record of index.records) {
    if (words.length === 0) {
      textMatched.push({ record, score: 0 });
      continue;
    }
    const score = documentScore(words, record);
    if (score !== null) textMatched.push({ record, score });
  }

  // 2. Filtrage par facettes, par-dessus.
  const scored = textMatched.filter(({ record }) =>
    matchesFacets(record, selections)
  );

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return tiebreak ? tiebreak(a.record.doc, b.record.doc) : 0;
  });

  const facetGroups = buildFacetGroups(
    index,
    textMatched.map((entry) => entry.record),
    selections
  );
  const facetLabels = new Map(
    index.config.facets.map((spec) => [spec.key, spec.label] as const)
  );
  const lastWord = words.length > 0 ? words[words.length - 1] : '';

  return {
    hits: scored.map(({ record, score }) => ({ doc: record.doc, score })),
    facets: facetGroups,
    suggestions: buildSuggestions(facetGroups, facetLabels, lastWord),
    didYouMean:
      scored.length === 0 ? findDidYouMean(index.vocabulary, words) : undefined,
    total: scored.length,
  };
}
