import { fold, tokenize } from './normalize';
import type {
  IndexedRecord,
  Primitive,
  SearchConfig,
  SearchIndex,
} from './types';

function asArray(
  value: string | string[] | Primitive | Primitive[] | null | undefined
): Primitive[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((v) => v != null && v !== '');
  return value === '' ? [] : [value];
}

/**
 * Construit l'index en mémoire. Appelé UNE fois au chargement, jamais par frappe.
 *
 * C'est la seule optimisation qui compte à cette échelle : la normalisation et
 * la tokenisation sont le gros du coût, et elles sont payées ici une bonne fois.
 *
 * ⚠️ `buildIndex` reçoit un tableau déjà en mémoire et ne sait pas d'où il vient.
 * C'est LA couture de réutilisation (spec §8) : le jour où le corpus dépasse le
 * plafond de ~5 000 fiches, on remplace ce qui alimente cette fonction, ni le
 * classement ni l'interface ne bougent.
 */
export function buildIndex<T>(
  docs: T[],
  config: SearchConfig<T>
): SearchIndex<T> {
  const vocabulary = new Set<string>();
  const facetValues = new Map<string, Set<Primitive>>();
  for (const facet of config.facets) facetValues.set(facet.key, new Set());

  const records: IndexedRecord<T>[] = docs.map((doc) => {
    const fields = config.fields.map((spec) => {
      const parts = asArray(spec.get(doc)).map(String);
      const extras = spec.extra?.(doc) ?? [];
      const phrase = fold(parts.join(' '));
      const tokens = [...parts, ...extras].flatMap((part) => tokenize(part));
      for (const token of tokens) vocabulary.add(token);
      return { key: spec.key, weight: spec.weight, phrase, tokens };
    });

    const facets = new Map<string, Primitive[]>();
    for (const spec of config.facets) {
      const values = asArray(spec.get(doc));
      facets.set(spec.key, values);
      const bucket = facetValues.get(spec.key);
      if (bucket) for (const value of values) bucket.add(value);
    }

    return { id: config.id(doc), doc, fields, facets };
  });

  return {
    config,
    records,
    vocabulary: Array.from(vocabulary),
    facetValues,
  };
}
