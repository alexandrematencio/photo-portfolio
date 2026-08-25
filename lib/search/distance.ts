import { wordStarts } from './normalize';

/**
 * Budget d'erreurs toléré, en fonction de la LONGUEUR DU MOT TAPÉ.
 *
 * ⚠️ Le plafond par longueur n'est pas cosmétique : sur ce catalogue, 42 titres
 * sur 200 font 8 caractères ou moins. Sans lui, « Bus » ramène « Buoys » et
 * « Bowling » et les titres courts deviennent interchangeables (spec §2).
 * C'est le PREMIER réglage à toucher si le flou paraît trop lâche ou trop serré.
 */
export function errorBudget(length: number): number {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

/**
 * Distance de Damerau-Levenshtein RESTREINTE (« optimal string alignment »),
 * plafonnée : rend `max + 1` dès qu'on sait que la distance dépasse `max`.
 *
 * ⚠️ Damerau et pas Levenshtein : l'inversion de deux lettres adjacentes coûte
 * UNE erreur (« Djreba » → « Djerba ») là où Levenshtein en compte deux. C'est
 * la faute de frappe la plus courante au clavier. C'est aussi la variante
 * qu'emploient Lucene et Elasticsearch pour leur recherche floue.
 *
 * Le calcul est BANDÉ : seules les cellules à moins de `max` de la diagonale
 * sont remplies, et on abandonne dès qu'une ligne entière dépasse le plafond.
 */
export function boundedOsa(a: string, b: string, max: number): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (max === 0) return a === b ? 0 : 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const OUT = max + 1;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j);

  for (let i = 1; i <= la; i++) {
    const curr = new Array<number>(lb + 1).fill(OUT);
    curr[0] = i;
    let rowMin = i;
    const from = Math.max(1, i - max);
    const to = Math.min(lb, i + max);

    for (let j = from; j <= to; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prev2[j - 2] + 1);
      }
      curr[j] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > max) return OUT;
    prev2 = prev;
    prev = curr;
  }

  return prev[lb] > max ? OUT : prev[lb];
}

type SubsequenceMatch = { compacity: number; boundaryRatio: number };

/**
 * Cherche `needle` comme sous-séquence de `hay` (glouton, le plus à gauche) et
 * rend deux mesures de qualité :
 *  - compacité : longueur du besoin / étendue parcourue. 1 = contigu.
 *  - part de frontière : proportion des lettres retenues qui ouvrent un mot.
 */
function findSubsequence(needle: string, hay: string): SubsequenceMatch | null {
  const starts = wordStarts(hay);
  let n = 0;
  let first = -1;
  let last = -1;
  let onBoundary = 0;

  for (let h = 0; h < hay.length && n < needle.length; h++) {
    if (hay[h] !== needle[n]) continue;
    if (first < 0) first = h;
    last = h;
    if (starts[h]) onBoundary++;
    n++;
  }

  if (n < needle.length) return null;
  const span = last - first + 1;
  return {
    compacity: needle.length / span,
    boundaryRatio: onBoundary / needle.length,
  };
}

/**
 * Étage 2 : sous-séquence façon `fzf`, évaluée sur la valeur ENTIÈRE du champ
 * (pas token par token) — « djfi » doit pouvoir enjamber « djerba fishermen ».
 *
 * ⚠️ Deux gardes anti-bruit :
 *  - moins de 3 lettres : refusé net. Trop court pour vouloir dire quoi que ce soit.
 *  - accepté seulement si COMPACT (≥ 0,8) OU ANCRÉ sur des débuts de mot (≥ 0,5).
 *    Sans la seconde, « bus » trouverait « buoys » (b·u···s, compacité 0,6, une
 *    seule lettre en frontière) — ce que la spec §7 interdit explicitement.
 *
 * ⚠️ Le seuil de compacité est à 0,8 et NON à 0,7, et ce n'est pas un réglage
 * au doigt mouillé : mesuré sur le dataset réel le 2026-08-25, à 0,7 la requête
 * « bus » ramenait les 4 photos de « Brussels, Belgium » — b·u·s tient dans le
 * SEUL mot « brussels », compacité 0,75. Une sous-séquence enfermée dans un mot
 * n'est pas une abréviation, c'est une coïncidence ; une vraie abréviation
 * enjambe les mots et passe par la part de frontière (« djfi » → « djerba
 * fishermen », compacité 0,44 mais frontière 0,5). Les deux gardes se
 * répartissent donc le travail, elles ne font pas doublon.
 */
export function subsequenceScore(needle: string, hay: string): number {
  if (needle.length < 3) return 0;
  const match = findSubsequence(needle, hay);
  if (!match) return 0;
  if (match.compacity < 0.8 && match.boundaryRatio < 0.5) return 0;
  return 0.55 * (0.5 * match.compacity + 0.5 * match.boundaryRatio);
}

/** Alias explicite : l'étage 2 s'applique à une phrase, pas à un token. */
export const phraseScore = subsequenceScore;

/**
 * Étages 1 et 3, sur UN token indexé.
 *
 * L'ordre des étages est un ordre de CONFIANCE : un mot flou passe toujours
 * derrière une sous-chaîne, qui passe derrière un préfixe, qui passe derrière
 * une égalité. Le score de l'étage 3 est borné à 0,45 × 2/3 ≈ 0,30, donc
 * strictement sous le 0,7 de la sous-chaîne — jamais d'ex æquo entre étages.
 */
export function tokenScore(query: string, token: string): number {
  if (query === token) return 1;
  if (token.startsWith(query)) return 0.9;
  if (token.includes(query)) return 0.7;

  const budget = errorBudget(query.length);
  if (budget === 0) return 0;
  const distance = boundedOsa(query, token, budget);
  if (distance > budget) return 0;
  return 0.45 * ((budget + 1 - distance) / (budget + 1));
}
