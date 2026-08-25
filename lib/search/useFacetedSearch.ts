import { useCallback, useMemo, useState } from 'react';

import { buildIndex } from './buildIndex';
import { search } from './search';
import type { Primitive, SearchConfig, SearchResult } from './types';

export type Chip = {
  facetKey: string;
  facetLabel: string;
  value: Primitive;
  label: string;
};

export type FacetedSearch<T> = {
  text: string;
  setText: (value: string) => void;
  chips: Chip[];
  toggleFacet: (facetKey: string, value: Primitive) => void;
  clearAll: () => void;
  /** Vrai tant que rien n'est tapé ni coché — l'habillage n'affiche alors rien. */
  isPristine: boolean;
  result: SearchResult<T>;
};

/**
 * État de recherche, sans un pixel.
 *
 * ⚠️ Seul fichier du noyau qui importe `react`, et il n'importe que ça — ni
 * Sanity, ni `@sanity/ui`. L'habillage est libre : la vitrine réutilisera ce
 * hook tel quel avec des composants Tailwind (spec §9.3).
 *
 * ⚠️ L'état est un objet PLAT (`text` + `Record<clé, valeurs>`) : c'est ce qui
 * le rend sérialisable vers une URL le jour où la vitrine en aura besoin.
 * Ne pas y ranger d'objet non sérialisable.
 */
export function useFacetedSearch<T>(
  docs: T[],
  config: SearchConfig<T>
): FacetedSearch<T> {
  const [text, setText] = useState('');
  const [facets, setFacets] = useState<Record<string, Primitive[]>>({});

  // L'index n'est reconstruit que si le corpus ou la config changent d'identité.
  const index = useMemo(() => buildIndex(docs, config), [docs, config]);
  const result = useMemo(
    () => search(index, { text, facets }),
    [index, text, facets]
  );

  const toggleFacet = useCallback((facetKey: string, value: Primitive) => {
    setFacets((previous) => {
      const current = previous[facetKey] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const copy = { ...previous };
      if (next.length === 0) delete copy[facetKey];
      else copy[facetKey] = next;
      return copy;
    });
  }, []);

  const clearAll = useCallback(() => {
    setText('');
    setFacets({});
  }, []);

  const chips = useMemo<Chip[]>(() => {
    const labels = new Map(config.facets.map((f) => [f.key, f.label] as const));
    return Object.entries(facets).flatMap(([facetKey, values]) =>
      values.map((value) => ({
        facetKey,
        facetLabel: labels.get(facetKey) ?? facetKey,
        value,
        label: String(value),
      }))
    );
  }, [facets, config.facets]);

  const isPristine = text.trim() === '' && chips.length === 0;

  return { text, setText, chips, toggleFacet, clearAll, isPristine, result };
}
