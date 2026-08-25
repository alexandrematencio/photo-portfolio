export type Primitive = string | number;

export type FieldSpec<T> = {
  /** Identifiant technique du champ. Sert au débogage et aux surlignages. */
  key: string;
  /** Poids multiplicatif du champ dans le score. */
  weight: number;
  get: (doc: T) => string | string[] | null | undefined;
  /** Termes indexés mais jamais affichés : alias, translittérations, ancien nom. */
  extra?: (doc: T) => string[];
};

export type FacetSpec<T> = {
  key: string;
  label: string;
  /** 'range' est RÉSERVÉ (facettes par tranches, spec §9.2) et non implémenté. */
  kind: 'term';
  get: (doc: T) => Primitive | Primitive[] | null | undefined;
  /** Ordre d'affichage des valeurs. Défaut : 'count'. */
  sort?: 'count' | 'label' | 'value-desc';
};

export type SearchConfig<T> = {
  id: (doc: T) => string;
  fields: FieldSpec<T>[];
  facets: FacetSpec<T>[];
  /** Départage à score égal — récence en back-office, popularité en vitrine. */
  tiebreak?: (a: T, b: T) => number;
};

export type IndexedField = {
  key: string;
  weight: number;
  /** La valeur entière, pliée. Support de l'étage 2 (sous-séquence). */
  phrase: string;
  /** Les tokens pliés. Support des étages 1 et 3. */
  tokens: string[];
};

export type IndexedRecord<T> = {
  id: string;
  doc: T;
  fields: IndexedField[];
  /** Valeurs de facette par clé, déjà éclatées. */
  facets: Map<string, Primitive[]>;
};

export type SearchIndex<T> = {
  config: SearchConfig<T>;
  records: IndexedRecord<T>[];
  /** Tous les tokens distincts du corpus — support du « vouliez-vous dire ». */
  vocabulary: string[];
  /** Clé de facette → valeurs distinctes présentes dans le corpus. */
  facetValues: Map<string, Set<Primitive>>;
};

export type FacetValue = {
  value: Primitive;
  label: string;
  count: number;
  active: boolean;
  /** Vrai quand la sélectionner ne donnerait aucun résultat. */
  disabled: boolean;
};

export type FacetGroup = {
  key: string;
  label: string;
  values: FacetValue[];
};

export type FacetSuggestion = {
  facetKey: string;
  facetLabel: string;
  value: Primitive;
  label: string;
  count: number;
};

export type SearchQuery = {
  text: string;
  /** Clé de facette → valeurs cochées. Vide ou absent = facette inactive. */
  facets: Record<string, Primitive[]>;
};

export type SearchResult<T> = {
  hits: { doc: T; score: number }[];
  facets: FacetGroup[];
  suggestions: FacetSuggestion[];
  didYouMean?: string;
  total: number;
};
