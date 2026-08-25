# Recherche à facettes du Tableau de bord — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Doter le Tableau de bord du Studio d'une recherche tolérante aux fautes de frappe et filtrable par facettes, bâtie sur un noyau réutilisable qui ne sait rien des photos.

**Architecture:** Un noyau TypeScript pur dans `lib/search/` (normalisation, distance d'édition plafonnée, index en mémoire, classement en trois étages, comptage de facettes), piloté par un objet `SearchConfig<T>` que fournit l'appelant. Un habillage Studio dans `sanity/tools/search/` en `@sanity/ui` : omnibox à jetons, panneau de facettes repliable, planche-contact de vignettes. Aucune dépendance npm ajoutée.

**Tech Stack:** TypeScript strict, React 19, `@sanity/ui` v3, `@sanity/icons`, `@sanity/image-url`, GROQ. Scripts d'assertions via `tsx`, sans framework de test.

**Spec:** `docs/superpowers/specs/2026-08-25-dashboard-search-design.md` — à lire avant la tâche 1 et à garder ouverte. Le plan argumente depuis elle.

**Le noyau a été prototypé et exécuté avant l'écriture de ce plan** : les 64 assertions des tâches 1 à 6, y compris les 15 cas de la spec §7, passent sur le code donné ici. Les valeurs attendues sont donc mesurées, pas devinées. Si l'une échoue à l'implémentation, c'est une divergence de transcription : comparer avec le code du plan avant de toucher aux seuils.

## Global Constraints

- **Branche** : `feat/dashboard-search`. Ne jamais commiter sur `main` (CLAUDE.md §8.3).
- **Zéro dépendance npm ajoutée.** Pas de Fuse.js, pas d'uFuzzy, pas de bibliothèque de distance. Raison en spec §3.
- **`lib/search/` n'importe NI React, NI `sanity`, NI `next`, NI Tailwind** — sauf `useFacetedSearch.ts`, qui n'importe que `react`. C'est la contrainte de réutilisation ; une entorse la ruine.
- **TypeScript strict, aucun `any`** (CLAUDE.md §7.3). Alias `@/*`, jamais de chemin relatif remontant (`../../`).
- **Pas de framework de test** (CLAUDE.md §7.4). Le cycle TDD passe par `scripts/check-search.ts` + `npm run check-search`, sur le modèle exact de `scripts/check-filename-parser.ts` : tableau de cas, runner qui affiche `✓`/`✗` et `process.exit(1)` si un cas échoue.
- **`@sanity/ui` v3 : `ButtonProps` n'expose pas `children`.** Toute ligne cliquable composite est un `<Card as="button" __unstable_focusRing>`. Un `<Button>` avec enfants ne rend rien, sans erreur, typecheck vert (CLAUDE.md §11.13).
- **Toute modification du Studio passe par `sanity/studio.config.ts`**, jamais par un call site (skill `sanity-studio` §11.1). Ici, rien à y toucher : le Dashboard est déjà enregistré.
- **Langue** : commentaires, libellés et messages en français. Commits en Conventional Commits, sujet en français.
- **Budgets d'erreur** (spec §4.3), à copier tels quels : longueur ≤ 4 → **0** ; 5 à 7 → **1** ; ≥ 8 → **2**.
- **Poids des champs photo** (spec §4.4), à copier tels quels : `title` 3 · `series` 2 · `location` 2 · `styles` 1,5 · `camera` 1 · `lens` 1 · `caption` 1 · `slug` 0,5 · `image.alt` **exclue**.
- Après chaque tâche : `npm run typecheck` doit être vert avant le commit.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `lib/search/normalize.ts` | Pliage casse/accents, tokenisation, détection de début de mot | 1 |
| `scripts/check-search.ts` | Harnais d'assertions hors ligne | 1, étendu à chaque tâche |
| `lib/search/distance.ts` | Budget d'erreur, OSA plafonnée, sous-séquence, score des 3 étages | 2 |
| `lib/search/types.ts` | `SearchConfig`, `FieldSpec`, `FacetSpec`, `SearchIndex`, `SearchResult` | 3 |
| `lib/search/buildIndex.ts` | Index de tokens précalculé, vocabulaire, valeurs de facettes | 3 |
| `lib/search/search.ts` | Classement texte, filtrage et comptage de facettes, suggestions, « vouliez-vous dire » | 4, 5, 6 |
| `lib/search/index.ts` | Réexport public du noyau | 6 |
| `lib/search/useFacetedSearch.ts` | Hook React d'état, zéro pixel | 7 |
| `sanity/tools/search/photoIndexQuery.ts` | GROQ de l'index + rebasage des brouillons | 8 |
| `sanity/tools/search/photoSearchConfig.ts` | La configuration photo : champs, poids, facettes | 8 |
| `sanity/tools/search/SearchCard.tsx` | Omnibox, jetons, suggestions, clavier, panneau | 9, 10 |
| `sanity/tools/search/ResultGrid.tsx` | Planche-contact de vignettes | 10 |
| `sanity/tools/Dashboard.tsx` | Montage de la carte + clé `searchIndex` dans la GROQ | 8, 10 |
| `resources/learning/recherche-a-facettes-tolerante-aux-fautes.md` | Note d'apprentissage | 11 |

---

### Task 1: Normalisation, tokenisation, harnais d'assertions

**Files:**
- Create: `lib/search/normalize.ts`
- Create: `scripts/check-search.ts`
- Modify: `package.json` (ajouter le script `check-search`)

**Interfaces:**
- Consumes: rien.
- Produces:
  - `fold(input: string): string`
  - `tokenize(input: string): string[]`
  - `wordStarts(folded: string): boolean[]` — `true` à chaque index qui commence un mot dans la chaîne pliée.

- [ ] **Step 1: Écrire le harnais et les cas qui échouent**

Créer `scripts/check-search.ts`. Le runner est calqué sur `scripts/check-filename-parser.ts` (tableau de cas, `✓`/`✗`, `process.exit(1)`), mais généralisé en `check(nom, réel, attendu)` parce que les tâches suivantes y ajouteront des cas de natures très différentes.

```ts
/**
 * Vérification du moteur de recherche (`npm run check-search`).
 *
 * Pas de framework de test (cf. CLAUDE.md §7.4) : de simples assertions
 * exécutables, hors ligne, sur des données fabriquées ici. Le classement flou
 * est exactement le genre de logique qui se dégrade en silence — un seuil mal
 * réglé ne plante pas, il rend juste de moins bons résultats.
 *
 * Cas de référence dans la spec : docs/superpowers/specs/2026-08-25-dashboard-search-design.md §7
 */

import { fold, tokenize, wordStarts } from '../lib/search/normalize';

let failed = 0;
let total = 0;

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function check(name: string, actual: unknown, expected: unknown): void {
  total++;
  if (eq(actual, expected)) {
    console.log(`✓ ${name}`);
  } else {
    failed++;
    console.log(`✗ ${name}`);
    console.log(`    attendu : ${JSON.stringify(expected)}`);
    console.log(`    obtenu  : ${JSON.stringify(actual)}`);
  }
}

function checkTrue(name: string, actual: boolean): void {
  check(name, actual, true);
}

// ── Normalisation ────────────────────────────────────────────────────────────

check('fold : casse et accents latins', fold('Déjà Vu'), 'deja vu');
check('fold : cyrillique préservé', fold('Дума'), 'дума');
check('fold : cyrillique long préservé', fold('Переделкино'), 'переделкино');
check('tokenize : ponctuation et crochets', tokenize('Archi [2]'), ['archi', '2']);
check('tokenize : virgule de lieu', tokenize('Djerba, Tunisia'), ['djerba', 'tunisia']);
check('tokenize : chaîne vide', tokenize('   '), []);
check(
  'wordStarts : deux mots',
  wordStarts('djerba fishermen'),
  [true, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false]
);

// ── Bilan ────────────────────────────────────────────────────────────────────

console.log(`\n${total - failed}/${total} assertions OK.`);
if (failed > 0) process.exit(1);
```

Ajouter dans `package.json`, à côté de `check-parser` :

```json
"check-search": "node --import tsx scripts/check-search.ts",
```

- [ ] **Step 2: Lancer pour vérifier que ça échoue**

Run: `npm run check-search`
Expected: ÉCHEC — `Cannot find module '../lib/search/normalize'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/search/normalize.ts` :

```ts
/**
 * Pliage et découpe des chaînes, côté index comme côté requête.
 *
 * ⚠️ Le pliage NFD + retrait des diacritiques laisse le cyrillique INTACT
 * (aucune table de correspondance latine ici — elle le détruirait). Deux
 * effets de bord assumés et souhaitables en russe : « й » se replie sur
 * « и » et « ё » sur « е », exactement comme « é » se replie sur « e ».
 */

const DIACRITICS = /[̀-ͯ]/g;
const NON_WORD = /[^\p{L}\p{N}]+/u;

/** Minuscules, sans accents. La MÊME fonction sert à l'index et à la requête. */
export function fold(input: string): string {
  return input.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

/** Découpe sur tout ce qui n'est ni lettre ni chiffre. Jamais de token vide. */
export function tokenize(input: string): string[] {
  return fold(input).split(NON_WORD).filter(Boolean);
}

/**
 * Pour chaque index de `folded`, dit s'il commence un mot. Sert au bonus de
 * frontière du score de sous-séquence (cf. distance.ts) : « djfi » est une
 * bonne abréviation de « djerba fishermen » parce que d et f y ouvrent un mot,
 * là où « bus » n'est pas une bonne abréviation de « buoys ».
 */
export function wordStarts(folded: string): boolean[] {
  const flags = new Array<boolean>(folded.length);
  let previousWasSeparator = true;
  for (let i = 0; i < folded.length; i++) {
    const isSeparator = NON_WORD.test(folded[i]);
    flags[i] = !isSeparator && previousWasSeparator;
    previousWasSeparator = isSeparator;
  }
  return flags;
}
```

- [ ] **Step 4: Lancer pour vérifier que ça passe**

Run: `npm run check-search`
Expected: `7/7 assertions OK.`

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add lib/search/normalize.ts scripts/check-search.ts package.json
git commit -m "feat(search): pliage, tokenisation et harnais d'assertions"
```

---

### Task 2: Distances et score des trois étages

**Files:**
- Create: `lib/search/distance.ts`
- Modify: `scripts/check-search.ts`

**Interfaces:**
- Consumes: `wordStarts` (tâche 1).
- Produces:
  - `errorBudget(length: number): number`
  - `boundedOsa(a: string, b: string, max: number): number` — rend `max + 1` dès que la distance dépasse `max`.
  - `subsequenceScore(needle: string, hay: string): number` — `0` si absente ou trop bruitée.
  - `tokenScore(query: string, token: string): number` — étages 1 et 3, sur un token.
  - `phraseScore(query: string, phrase: string): number` — étage 2, sur la valeur entière du champ.

- [ ] **Step 1: Écrire les cas qui échouent**

Ajouter dans `scripts/check-search.ts`, avant le bilan :

```ts
import {
  boundedOsa,
  errorBudget,
  phraseScore,
  tokenScore,
} from '../lib/search/distance';

// ── Budget d'erreur (spec §4.3) ──────────────────────────────────────────────

check('budget : 3 lettres → 0', errorBudget(3), 0);
check('budget : 4 lettres → 0', errorBudget(4), 0);
check('budget : 5 lettres → 1', errorBudget(5), 1);
check('budget : 7 lettres → 1', errorBudget(7), 1);
check('budget : 8 lettres → 2', errorBudget(8), 2);

// ── OSA : l'inversion coûte UNE erreur, pas deux ─────────────────────────────

check('osa : inversion adjacente = 1', boundedOsa('djreba', 'djerba', 2), 1);
check('osa : inversion sur mot long = 1', boundedOsa('arhcitecture', 'architecture', 2), 1);
check('osa : identiques = 0', boundedOsa('paris', 'paris', 1), 0);
check('osa : au-delà du plafond, abandon', boundedOsa('bus', 'bowling', 1), 2);

// ── Étages du score (spec §4.3) ──────────────────────────────────────────────

check('étage 1 : égalité', tokenScore('archi', 'archi'), 1);
check('étage 1 : préfixe', tokenScore('archi', 'architecture'), 0.9);
check('étage 1 : sous-chaîne', tokenScore('hitec', 'architecture'), 0.7);
checkTrue('ordre : exact > préfixe', tokenScore('archi', 'archi') > tokenScore('archi', 'architecture'));
checkTrue('étage 3 : djreba trouve djerba', tokenScore('djreba', 'djerba') > 0);
checkTrue('étage 3 : arhcitecture trouve architecture', tokenScore('arhcitecture', 'architecture') > 0);
check('étage 3 : mot court, zéro tolérance', tokenScore('bus', 'bar'), 0);
checkTrue('ordre : flou passe DERRIÈRE la sous-chaîne', tokenScore('djreba', 'djerba') < 0.7);

// ── Étage 2 : sous-séquence sur la valeur entière ─────────────────────────────

checkTrue('sous-séquence : djfi trouve « djerba fishermen »', phraseScore('djfi', 'djerba fishermen') > 0);
check('sous-séquence : bus ne trouve PAS buoys (bruit)', phraseScore('bus', 'buoys'), 0);
check('sous-séquence : bus ne trouve PAS bowling', phraseScore('bus', 'bowling'), 0);
check('sous-séquence : moins de 3 lettres, refusé', phraseScore('bs', 'bus'), 0);
```

- [ ] **Step 2: Lancer pour vérifier que ça échoue**

Run: `npm run check-search`
Expected: ÉCHEC — `Cannot find module '../lib/search/distance'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/search/distance.ts` :

```ts
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
 * ⚠️ Deux gardes anti-bruit, chacune justifiée par un cas de la spec §7 :
 *  - moins de 3 lettres : refusé net. Trop court pour vouloir dire quoi que ce soit.
 *  - accepté seulement si COMPACT (≥ 0,7) OU ANCRÉ sur des débuts de mot (≥ 0,5).
 *    Sans cette seconde garde, « bus » trouverait « buoys » (b·u···s, compacité
 *    0,6, une seule lettre en frontière) — ce que la spec interdit explicitement.
 */
export function subsequenceScore(needle: string, hay: string): number {
  if (needle.length < 3) return 0;
  const match = findSubsequence(needle, hay);
  if (!match) return 0;
  if (match.compacity < 0.7 && match.boundaryRatio < 0.5) return 0;
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
```

- [ ] **Step 4: Lancer pour vérifier que ça passe**

Run: `npm run check-search`
Expected: `26/26 assertions OK.`

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add lib/search/distance.ts scripts/check-search.ts
git commit -m "feat(search): distance de Damerau plafonnée et score en trois étages"
```

---

### Task 3: Contrat de configuration et construction de l'index

**Files:**
- Create: `lib/search/types.ts`
- Create: `lib/search/buildIndex.ts`
- Modify: `scripts/check-search.ts`

**Interfaces:**
- Consumes: `fold`, `tokenize` (tâche 1).
- Produces:
  - Types `Primitive`, `FieldSpec<T>`, `FacetSpec<T>`, `SearchConfig<T>`, `IndexedRecord<T>`, `SearchIndex<T>`, `FacetValue`, `FacetGroup`, `FacetSuggestion`, `SearchQuery`, `SearchResult<T>`.
  - `buildIndex<T>(docs: T[], config: SearchConfig<T>): SearchIndex<T>`

- [ ] **Step 1: Écrire les cas qui échouent**

Ajouter dans `scripts/check-search.ts` — les fixtures servent aussi aux tâches 4 à 6, donc les poser dans un bloc à part :

```ts
import { buildIndex } from '../lib/search/buildIndex';
import type { SearchConfig } from '../lib/search/types';

// ── Fixtures partagées (tâches 3 à 6) ────────────────────────────────────────

type Fixture = {
  id: string;
  title: string;
  alt: string;
  location: string;
  year: number;
  camera: string;
  styles: string[];
};

const FIXTURES: Fixture[] = [
  { id: 'a', title: 'Djerba Fishermen', alt: 'ZZQQ introuvable ailleurs', location: 'Djerba, Tunisia', year: 2024, camera: 'Fujifilm X-PRO 2', styles: ['Street'] },
  { id: 'b', title: 'Djerba Beach',     alt: 'plage',  location: 'Djerba, Tunisia', year: 2023, camera: 'Fujifilm X-PRO 2', styles: ['Landscape'] },
  { id: 'c', title: 'Bus n tree',       alt: 'bus',    location: 'Paris, France',   year: 2024, camera: 'Ricoh GR III',     styles: ['Street'] },
  { id: 'd', title: 'Buoys',            alt: 'bouées', location: 'Biarritz, France',year: 2024, camera: 'Ricoh GR III',     styles: ['Landscape'] },
  { id: 'e', title: 'Bowling',          alt: 'bowling',location: 'Paris, France',   year: 2025, camera: 'Ricoh GR III',     styles: ['Street'] },
  { id: 'f', title: 'Дума',             alt: 'douma',  location: 'Moscow, Russia',  year: 2021, camera: 'Ricoh GR III',     styles: ['Architecture'] },
  { id: 'g', title: 'Archi',            alt: 'archi',  location: 'Paris, France',   year: 2026, camera: 'Ricoh GR III',     styles: ['Architecture'] },
];

// `alt` est volontairement ABSENTE de `fields` — spec §4.4.
const FIXTURE_CONFIG: SearchConfig<Fixture> = {
  id: (d) => d.id,
  fields: [
    { key: 'title', weight: 3, get: (d) => d.title },
    { key: 'location', weight: 2, get: (d) => d.location },
    { key: 'styles', weight: 1.5, get: (d) => d.styles },
    { key: 'camera', weight: 1, get: (d) => d.camera },
    { key: 'year', weight: 1, get: (d) => String(d.year) },
  ],
  facets: [
    { key: 'year', label: 'Année', kind: 'term', get: (d) => d.year, sort: 'value-desc' },
    { key: 'location', label: 'Lieu', kind: 'term', get: (d) => d.location, sort: 'count' },
    { key: 'camera', label: 'Boîtier', kind: 'term', get: (d) => d.camera, sort: 'count' },
    { key: 'styles', label: 'Style', kind: 'term', get: (d) => d.styles, sort: 'count' },
  ],
  tiebreak: (a, b) => a.id.localeCompare(b.id),
};

const INDEX = buildIndex(FIXTURES, FIXTURE_CONFIG);

// ── Index ────────────────────────────────────────────────────────────────────

check('index : tous les documents retenus', INDEX.records.length, 7);
checkTrue('index : le vocabulaire contient « djerba »', INDEX.vocabulary.includes('djerba'));
checkTrue('index : le vocabulaire contient « дума »', INDEX.vocabulary.includes('дума'));
check('index : « zzqq » (alt) ABSENT du vocabulaire', INDEX.vocabulary.includes('zzqq'), false);
check('index : valeurs de la facette année', INDEX.facetValues.get('year')?.size, 5);
check(
  'index : une facette multivaluée éclate ses valeurs',
  INDEX.facetValues.get('styles')?.size,
  3
);
check(
  'index : phrase du champ title pliée',
  INDEX.records.find((r) => r.id === 'a')?.fields[0].phrase,
  'djerba fishermen'
);
```

- [ ] **Step 2: Lancer pour vérifier que ça échoue**

Run: `npm run check-search`
Expected: ÉCHEC — `Cannot find module '../lib/search/buildIndex'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/search/types.ts` :

```ts
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
  /** valeurs de facette par clé, déjà éclatées et normalisées en chaînes. */
  facets: Map<string, Primitive[]>;
};

export type SearchIndex<T> = {
  config: SearchConfig<T>;
  records: IndexedRecord<T>[];
  /** Tous les tokens distincts du corpus — support du « vouliez-vous dire ». */
  vocabulary: string[];
  /** clé de facette → valeurs distinctes présentes dans le corpus. */
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
  /** clé de facette → valeurs cochées. Vide ou absent = facette inactive. */
  facets: Record<string, Primitive[]>;
};

export type SearchResult<T> = {
  hits: { doc: T; score: number }[];
  facets: FacetGroup[];
  suggestions: FacetSuggestion[];
  didYouMean?: string;
  total: number;
};
```

Créer `lib/search/buildIndex.ts` :

```ts
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
 * plafond, on remplace ce qui alimente cette fonction, ni le classement ni
 * l'interface ne bougent.
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
```

- [ ] **Step 4: Lancer pour vérifier que ça passe**

Run: `npm run check-search`
Expected: `33/33 assertions OK.`

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add lib/search/types.ts lib/search/buildIndex.ts scripts/check-search.ts
git commit -m "feat(search): contrat de configuration et index en mémoire"
```

---

### Task 4: Classement du texte

**Files:**
- Create: `lib/search/search.ts`
- Modify: `scripts/check-search.ts`

**Interfaces:**
- Consumes: `tokenize` (t.1), `tokenScore`/`phraseScore` (t.2), `SearchIndex`/`SearchQuery`/`SearchResult` (t.3).
- Produces: `search<T>(index: SearchIndex<T>, query: SearchQuery): SearchResult<T>` — dans cette tâche, `facets` rend `[]`, `suggestions` rend `[]` et `didYouMean` reste `undefined`. Les tâches 5 et 6 les remplissent.

- [ ] **Step 1: Écrire les cas qui échouent**

Ajouter dans `scripts/check-search.ts` :

```ts
import { search } from '../lib/search/search';

const NO_FACETS: Record<string, never[]> = {};
const ids = (text: string, facets: Record<string, (string | number)[]> = NO_FACETS) =>
  search(INDEX, { text, facets }).hits.map((h) => h.doc.id);

// ── Classement du texte (spec §7, cas 1 à 7 et 13 à 14) ──────────────────────

check('cas 1 — « djreba » trouve Djerba (inversion)', ids('djreba').sort(), ['a', 'b']);
check('cas 2 — « bus » ne ramène ni Buoys ni Bowling', ids('bus'), ['c']);
check('cas 3 — « arhcitecture » trouve Architecture', ids('arhcitecture'), ['f', 'g']);
check('cas 4 — « djfi » trouve Djerba Fishermen', ids('djfi'), ['a']);
check('cas 5 — « archi » classe Archi avant Architecture seule', ids('archi')[0], 'g');
check('cas 6 — « дум » trouve Дума', ids('дум'), ['f']);
check('cas 7 — ET entre mots : Djerba de 2023 exclu', ids('djerba 2024'), ['a']);
check('cas 13 — requête vide : tous les documents', ids('').length, 7);
check('cas 13 — requête vide : ordre stable par tiebreak', ids(''), ['a','b','c','d','e','f','g']);
check('cas 14 — un mot présent seulement dans alt ne trouve rien', ids('zzqq'), []);
check('total reflète le nombre de résultats', search(INDEX, { text: 'djerba', facets: {} }).total, 2);
```

- [ ] **Step 2: Lancer pour vérifier que ça échoue**

Run: `npm run check-search`
Expected: ÉCHEC — `Cannot find module '../lib/search/search'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `lib/search/search.ts` :

```ts
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
function documentScore<T>(words: string[], record: IndexedRecord<T>): number | null {
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
```

- [ ] **Step 4: Lancer pour vérifier que ça passe**

Run: `npm run check-search`
Expected: `44/44 assertions OK.`

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add lib/search/search.ts scripts/check-search.ts
git commit -m "feat(search): classement du texte, ET entre mots"
```

---

### Task 5: Filtrage et comptage des facettes

**Files:**
- Modify: `lib/search/search.ts`
- Modify: `scripts/check-search.ts`

**Interfaces:**
- Consumes: tout de la tâche 4.
- Produces: `search()` remplit désormais `facets: FacetGroup[]` et applique `query.facets` au filtrage. Signature inchangée.

- [ ] **Step 1: Écrire les cas qui échouent**

Ajouter dans `scripts/check-search.ts` :

```ts
// ── Facettes (spec §7, cas 8 à 11 et 13b) ────────────────────────────────────

const facetGroup = (result: ReturnType<typeof search<Fixture>>, key: string) =>
  result.facets.find((f) => f.key === key);

check(
  'cas 8 — OU dans une facette : union des deux années',
  ids('', { year: [2024, 2025] }).sort(),
  ['a', 'c', 'd', 'e']
);
check(
  'cas 9 — ET entre facettes : intersection',
  ids('', { year: [2024], location: ['Djerba, Tunisia'] }),
  ['a']
);
check(
  'cas 13b — recherche 100 % facettes, sans un caractère tapé',
  ids('', { camera: ['Fujifilm X-PRO 2'] }).sort(),
  ['a', 'b']
);
{
  const r = search(INDEX, { text: '', facets: { year: [2024] } });
  const years = facetGroup(r, 'year')?.values ?? [];
  const other = years.find((v) => v.value === 2025);
  checkTrue(
    'cas 10 — les compteurs d’une facette IGNORENT sa propre sélection',
    (other?.count ?? 0) > 0
  );
  check('cas 10 — la valeur cochée est marquée active', years.find((v) => v.value === 2024)?.active, true);
  const camera = facetGroup(r, 'camera')?.values ?? [];
  check(
    'cas 9bis — les AUTRES facettes, elles, tiennent compte de la sélection',
    camera.find((v) => v.value === 'Fujifilm X-PRO 2')?.count,
    1
  );
}
{
  const r = search(INDEX, { text: '', facets: { location: ['Biarritz, France'] } });
  const styles = facetGroup(r, 'styles')?.values ?? [];
  check(
    'cas 11 — une valeur menant à zéro est désactivée, pas cachée',
    styles.find((v) => v.value === 'Street')?.disabled,
    true
  );
  check(
    'cas 11 — et son compte est visible à 0',
    styles.find((v) => v.value === 'Street')?.count,
    0
  );
}
check(
  'ordre des valeurs : sort value-desc sur l’année',
  facetGroup(search(INDEX, { text: '', facets: {} }), 'year')?.values.map((v) => v.value),
  [2026, 2025, 2024, 2023, 2021]
);
```

- [ ] **Step 2: Lancer pour vérifier que ça échoue**

Run: `npm run check-search`
Expected: ÉCHEC — les cas 8 à 11 échouent (`facets` est vide, le filtrage n'est pas appliqué).

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `lib/search/search.ts`, ajouter les imports et les fonctions de facettes, puis remplacer le corps de `search` :

```ts
import type {
  FacetGroup,
  FacetSpec,
  FacetValue,
  IndexedRecord,
  Primitive,
  SearchIndex,
  SearchQuery,
  SearchResult,
} from './types';

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

function sortFacetValues(spec: FacetSpec<unknown>, values: FacetValue[]): FacetValue[] {
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
      values: sortFacetValues(spec as FacetSpec<unknown>, values),
    };
  });
}
```

Remplacer le corps de `search` par :

```ts
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

  return {
    hits: scored.map(({ record, score }) => ({ doc: record.doc, score })),
    facets: buildFacetGroups(
      index,
      textMatched.map((entry) => entry.record),
      selections
    ),
    suggestions: [],
    total: scored.length,
  };
}
```

- [ ] **Step 4: Lancer pour vérifier que ça passe**

Run: `npm run check-search`
Expected: `53/53 assertions OK.`

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add lib/search/search.ts scripts/check-search.ts
git commit -m "feat(search): facettes — OU dans, ET entre, comptes hors sélection propre"
```

---

### Task 6: Suggestions de facettes et « vouliez-vous dire »

**Files:**
- Modify: `lib/search/search.ts`
- Create: `lib/search/index.ts`
- Modify: `scripts/check-search.ts`

**Interfaces:**
- Consumes: tout des tâches 4 et 5.
- Produces: `search()` remplit `suggestions` et `didYouMean`. `lib/search/index.ts` réexporte `fold`, `tokenize`, `buildIndex`, `search`, `useFacetedSearch` (ajouté en t.7) et tous les types.

- [ ] **Step 1: Écrire les cas qui échouent**

Ajouter dans `scripts/check-search.ts` :

```ts
// ── Suggestions et zéro résultat (spec §7, cas 15 ; §4.6 ; §5.2) ─────────────

{
  const r = search(INDEX, { text: 'fuji', facets: {} });
  const s = r.suggestions.find((x) => x.facetKey === 'camera');
  check('suggestion : « fuji » propose le boîtier Fujifilm', s?.value, 'Fujifilm X-PRO 2');
  check('suggestion : elle porte son compte', s?.count, 2);
  check('suggestion : elle porte le libellé de son axe', s?.facetLabel, 'Boîtier');
}
{
  const r = search(INDEX, { text: 'fuji', facets: { camera: ['Fujifilm X-PRO 2'] } });
  check(
    'suggestion : une facette DÉJÀ active n’est plus proposée',
    r.suggestions.some((x) => x.value === 'Fujifilm X-PRO 2'),
    false
  );
}
{
  const r = search(INDEX, { text: 'djreeba', facets: {} });
  check('cas 15 — zéro résultat', r.total, 0);
  check('cas 15 — « vouliez-vous dire » propose djerba', r.didYouMean, 'djerba');
}
check(
  'pas de « vouliez-vous dire » quand il y a des résultats',
  search(INDEX, { text: 'djerba', facets: {} }).didYouMean,
  undefined
);
```

- [ ] **Step 2: Lancer pour vérifier que ça échoue**

Run: `npm run check-search`
Expected: ÉCHEC — `suggestions` est vide et `didYouMean` est `undefined` sur `djreeba`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Dans `lib/search/search.ts`, ajouter (import `boundedOsa` et `errorBudget` depuis `./distance`, et le type `FacetSuggestion`) :

```ts
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
      const folded = fold(value.label);
      let best = phraseScore(lastWord, folded);
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
function findDidYouMean(vocabulary: string[], words: string[]): string | undefined {
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
```

Dans le `return` de `search`, remplacer `suggestions: []` et ajouter `didYouMean` :

```ts
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
```

Créer `lib/search/index.ts` :

```ts
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
```

- [ ] **Step 4: Lancer pour vérifier que ça passe**

Run: `npm run check-search`
Expected: `60/60 assertions OK.`

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add lib/search/search.ts lib/search/index.ts scripts/check-search.ts
git commit -m "feat(search): suggestions de facettes et « vouliez-vous dire »"
```

---

### Task 7: Hook React d'état

**Files:**
- Create: `lib/search/useFacetedSearch.ts`
- Modify: `lib/search/index.ts`

**Interfaces:**
- Consumes: `buildIndex`, `search`, types (t.3 à t.6).
- Produces:
  ```ts
  useFacetedSearch<T>(docs: T[], config: SearchConfig<T>): {
    text: string
    setText: (value: string) => void
    chips: { facetKey: string; facetLabel: string; value: Primitive; label: string }[]
    toggleFacet: (facetKey: string, value: Primitive) => void
    clearAll: () => void
    isPristine: boolean
    result: SearchResult<T>
  }
  ```

- [ ] **Step 1: Écrire la vérification**

Ce hook n'a pas d'assertion hors ligne — il n'est que de l'état React au-dessus d'un noyau déjà couvert par 60 assertions ; le tester demanderait un moteur de rendu, donc un framework, donc exactement ce que CLAUDE.md §7.4 interdit d'ajouter ici. Sa vérification est **manuelle, en tâche 10**, une fois la carte montée.

Ce qu'il doit garantir, et qui sera vérifié à l'écran : `isPristine` vrai quand le texte est vide ET aucune facette active (c'est lui qui décide de ne rien afficher, spec §5.3) ; `toggleFacet` ajoute ou retire sans jamais dupliquer ; `clearAll` remet les deux à zéro ; l'index n'est reconstruit que quand `docs` change d'identité.

- [ ] **Step 2: Constater qu'il n'existe pas**

Run: `test -f lib/search/useFacetedSearch.ts && echo présent || echo absent`
Expected: `absent`.

- [ ] **Step 3: Écrire l'implémentation**

Créer `lib/search/useFacetedSearch.ts` :

```ts
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
```

Ajouter dans `lib/search/index.ts` :

```ts
export { useFacetedSearch } from './useFacetedSearch';
export type { Chip, FacetedSearch } from './useFacetedSearch';
```

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck`
Expected: aucune erreur.

Run: `npm run check-search`
Expected: `60/60 assertions OK.` (inchangé — le hook n'ajoute pas d'assertion.)

- [ ] **Step 5: Commit**

```bash
git add lib/search/useFacetedSearch.ts lib/search/index.ts
git commit -m "feat(search): hook d'état React, sérialisable et sans UI"
```

---

### Task 8: Index photo — GROQ, rebasage des brouillons, configuration

**Files:**
- Create: `sanity/tools/search/photoIndexQuery.ts`
- Create: `sanity/tools/search/photoSearchConfig.ts`
- Modify: `sanity/tools/Dashboard.tsx` (clé `searchIndex` dans `DASHBOARD_QUERY`, champ dans `DashboardData`)
- Modify: `scripts/check-search.ts`

**Interfaces:**
- Consumes: `SearchConfig` (t.3).
- Produces:
  - `SEARCH_INDEX_PROJECTION: string` — le fragment GROQ à insérer dans `DASHBOARD_QUERY`.
  - `type PhotoIndexRow` — la ligne brute renvoyée par GROQ (peut contenir `drafts.X`).
  - `type PhotoRecord = Omit<PhotoIndexRow, '_id'> & { id: string; hasDraft: boolean }`
  - `rebaseDrafts(rows: PhotoIndexRow[]): PhotoRecord[]`
  - `photoSearchConfig: SearchConfig<PhotoRecord>`

- [ ] **Step 1: Écrire les cas qui échouent**

Ajouter dans `scripts/check-search.ts` :

```ts
import { rebaseDrafts, type PhotoIndexRow } from '../sanity/tools/search/photoIndexQuery';

// ── Rebasage des brouillons (spec §6, piège 1 ; cas 12) ──────────────────────

const ROW = (over: Partial<PhotoIndexRow>): PhotoIndexRow => ({
  _id: 'photo-x',
  _updatedAt: '2026-08-01T00:00:00Z',
  title: 'Titre publié',
  slug: 'titre-publie',
  caption: null,
  year: 2024,
  location: 'Paris, France',
  camera: null,
  lens: null,
  styles: null,
  series: null,
  image: null,
  ...over,
});

{
  const rows = [
    ROW({ _id: 'photo-x', title: 'Titre publié' }),
    ROW({ _id: 'drafts.photo-x', title: 'Titre du brouillon', _updatedAt: '2026-08-02T00:00:00Z' }),
    ROW({ _id: 'photo-y', title: 'Autre' }),
  ];
  const out = rebaseDrafts(rows);
  check('cas 12 — un seul résultat pour X + drafts.X', out.length, 2);
  const x = out.find((r) => r.id === 'photo-x');
  check('cas 12 — l’id est celui du document PUBLIÉ', x?.id, 'photo-x');
  check('cas 12 — les valeurs viennent du BROUILLON (plus fraîches)', x?.title, 'Titre du brouillon');
  check('cas 12 — le drapeau hasDraft est levé', x?.hasDraft, true);
  check('cas 12 — un document sans brouillon ne le lève pas', out.find((r) => r.id === 'photo-y')?.hasDraft, false);
}
{
  const out = rebaseDrafts([ROW({ _id: 'drafts.photo-z', title: 'Jamais publié' })]);
  check('brouillon jamais publié : présent quand même', out.length, 1);
  check('brouillon jamais publié : id rebasé', out[0].id, 'photo-z');
  check('brouillon jamais publié : hasDraft levé', out[0].hasDraft, true);
}
```

- [ ] **Step 2: Lancer pour vérifier que ça échoue**

Run: `npm run check-search`
Expected: ÉCHEC — `Cannot find module '../sanity/tools/search/photoIndexQuery'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `sanity/tools/search/photoIndexQuery.ts` :

```ts
/**
 * L'index de recherche des photos : sa projection GROQ et le rebasage des
 * brouillons.
 *
 * Mesuré le 2026-08-24 sur le dataset de production : 200 photos, 81,5 Ko brut
 * / 13,8 Ko gzip, 36 ms. Le Tableau de bord charge DÉJÀ les 200 lignes d'axes
 * (`axisRows`) : cette projection grossit la requête existante, elle n'ajoute
 * pas d'aller-retour.
 *
 * ⚠️ `image.alt` n'est PAS projetée. Elle est auto-générée par l'import sous la
 * forme « Titre — Lieu » : l'indexer compterait le titre deux fois et fausserait
 * le classement (spec §4.4).
 */

export const SEARCH_INDEX_PROJECTION = /* groq */ `
  *[_type == "photo"] {
    _id, _updatedAt, title, "slug": slug.current, caption, year, location,
    "camera": camera->title,
    "lens": lens->title,
    "styles": styles[]->title,
    "series": series[]->title,
    image
  }
`;

export type PhotoIndexRow = {
  _id: string;
  _updatedAt: string;
  title: string | null;
  slug: string | null;
  caption: string | null;
  year: number | null;
  location: string | null;
  camera: string | null;
  lens: string | null;
  styles: string[] | null;
  series: string[] | null;
  image: { asset?: { _ref: string } } | null;
};

export type PhotoRecord = Omit<PhotoIndexRow, '_id'> & {
  id: string;
  hasDraft: boolean;
};

const DRAFT_PREFIX = 'drafts.';

/**
 * Fusionne `X` et `drafts.X` en UNE fiche.
 *
 * ⚠️ Le client du Tableau de bord (`useClient`) voit les brouillons : sans ce
 * rebasage, une photo publiée ET éditée remonterait DEUX FOIS dans les
 * résultats. C'est le bug déjà payé dans `orderedRefsInput` (skill
 * `sanity-studio` §11.15).
 *
 * On garde les valeurs du BROUILLON, pas du publié : c'est ce que l'éditeur
 * vient de taper, donc ce qu'il va chercher. L'id retenu est celui du publié,
 * parce que c'est lui que consomme l'intent `edit`.
 */
export function rebaseDrafts(rows: PhotoIndexRow[]): PhotoRecord[] {
  const byId = new Map<string, PhotoRecord>();

  for (const row of rows) {
    const isDraft = row._id.startsWith(DRAFT_PREFIX);
    const id = isDraft ? row._id.slice(DRAFT_PREFIX.length) : row._id;
    const existing = byId.get(id);

    if (!existing) {
      byId.set(id, { ...row, id, hasDraft: isDraft });
      continue;
    }
    // Le brouillon écrase le publié ; le publié n'écrase jamais le brouillon.
    if (isDraft) byId.set(id, { ...row, id, hasDraft: true });
    else byId.set(id, { ...existing, hasDraft: existing.hasDraft });
  }

  return Array.from(byId.values());
}
```

Créer `sanity/tools/search/photoSearchConfig.ts` :

```ts
import type { SearchConfig } from '@/lib/search';

import type { PhotoRecord } from './photoIndexQuery';

/**
 * TOUT ce que le moteur sait des photos tient dans ce fichier.
 *
 * Pour une autre affaire — une épicerie, une boutique — on écrit un fichier
 * frère (`shopSearchConfig.ts`) et le noyau ne change pas d'une ligne. C'est la
 * doctrine déjà en vigueur pour `orderedRefsInput` et `quickRefInput` : une
 * fabrique, des instances qui n'apportent que leur requête et leurs libellés.
 *
 * Poids : spec §4.4. `image.alt` est ABSENTE, et c'est délibéré.
 */
export const photoSearchConfig: SearchConfig<PhotoRecord> = {
  id: (photo) => photo.id,
  fields: [
    { key: 'title', weight: 3, get: (p) => p.title },
    { key: 'series', weight: 2, get: (p) => p.series },
    { key: 'location', weight: 2, get: (p) => p.location },
    { key: 'styles', weight: 1.5, get: (p) => p.styles },
    { key: 'camera', weight: 1, get: (p) => p.camera },
    { key: 'lens', weight: 1, get: (p) => p.lens },
    { key: 'caption', weight: 1, get: (p) => p.caption },
    { key: 'year', weight: 1, get: (p) => (p.year == null ? null : String(p.year)) },
    { key: 'slug', weight: 0.5, get: (p) => p.slug },
  ],
  facets: [
    { key: 'year', label: 'Année', kind: 'term', get: (p) => p.year, sort: 'value-desc' },
    { key: 'location', label: 'Lieu', kind: 'term', get: (p) => p.location, sort: 'count' },
    { key: 'series', label: 'Série', kind: 'term', get: (p) => p.series, sort: 'count' },
    { key: 'styles', label: 'Style', kind: 'term', get: (p) => p.styles, sort: 'count' },
    { key: 'camera', label: 'Boîtier', kind: 'term', get: (p) => p.camera, sort: 'count' },
    { key: 'lens', label: 'Objectif', kind: 'term', get: (p) => p.lens, sort: 'count' },
  ],
  // En back-office, ce qu'on vient d'éditer est ce qu'on cherche.
  tiebreak: (a, b) => b._updatedAt.localeCompare(a._updatedAt),
};
```

Dans `sanity/tools/Dashboard.tsx` : importer `SEARCH_INDEX_PROJECTION` et `PhotoIndexRow`, ajouter la clé dans `DASHBOARD_QUERY` juste après `"axisRows": …,` :

```ts
  "searchIndex": ${SEARCH_INDEX_PROJECTION},
```

(la constante devient donc un template literal — remplacer les backticks du commentaire `/* groq */` par une interpolation) et ajouter dans le type `DashboardData` :

```ts
  searchIndex: PhotoIndexRow[];
```

- [ ] **Step 4: Lancer pour vérifier que ça passe**

Run: `npm run check-search`
Expected: `68/68 assertions OK.`

Run: `npm run typecheck`
Expected: aucune erreur.

Vérification réelle de la projection, hors Studio :

```bash
curl -s -G "https://yh5i5diw.api.sanity.io/v2024-01-01/data/query/production" \
  --data-urlencode 'query=*[_type == "photo"][0...2]{_id,_updatedAt,title,"slug":slug.current,caption,year,location,"camera":camera->title,"lens":lens->title,"styles":styles[]->title,"series":series[]->title,image}'
```
Expected: deux objets complets, `styles` en tableau, `camera`/`lens` en chaîne ou `null`.

- [ ] **Step 5: Commit**

```bash
git add sanity/tools/search/photoIndexQuery.ts sanity/tools/search/photoSearchConfig.ts sanity/tools/Dashboard.tsx scripts/check-search.ts
git commit -m "feat(search): index photo, rebasage des brouillons et configuration"
```

---

### Task 9: L'omnibox — champ, jetons, suggestions, clavier

**Files:**
- Create: `sanity/tools/search/SearchCard.tsx`

**Interfaces:**
- Consumes: `useFacetedSearch`, `photoSearchConfig`, `rebaseDrafts`, `PhotoIndexRow` (t.7, t.8).
- Produces: `<SearchCard rows={PhotoIndexRow[]} thumbUrl={ThumbFn} />`. La planche-contact et le panneau arrivent en tâche 10 ; cette tâche livre le champ pleinement fonctionnel avec une liste de résultats textuelle.

- [ ] **Step 1: Écrire le composant**

Créer `sanity/tools/search/SearchCard.tsx` :

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Card, Flex, Stack, Text, TextInput } from '@sanity/ui';
import { CloseIcon, SearchIcon } from '@sanity/icons';

import { useFacetedSearch } from '@/lib/search';
import type { Primitive } from '@/lib/search';

import { photoSearchConfig } from './photoSearchConfig';
import { rebaseDrafts, type PhotoIndexRow, type PhotoRecord } from './photoIndexQuery';

const MAX_PHOTO_SUGGESTIONS = 6;

export type ThumbFn = (
  image: { asset?: { _ref: string } } | null | undefined,
  size: number
) => string | null;

export function SearchCard({
  rows,
  thumbUrl,
}: {
  rows: PhotoIndexRow[];
  thumbUrl: ThumbFn;
}) {
  const docs = useMemo(() => rebaseDrafts(rows), [rows]);
  const {
    text,
    setText,
    chips,
    toggleFacet,
    clearAll,
    isPristine,
    result,
  } = useFacetedSearch<PhotoRecord>(docs, photoSearchConfig);

  const inputRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(0);

  // Les deux natures de la liste déroulante, dans l'ordre où elles s'affichent.
  const photoRows = result.hits.slice(0, MAX_PHOTO_SUGGESTIONS);
  const options = useMemo(
    () => [
      ...photoRows.map((hit) => ({ kind: 'photo' as const, hit })),
      ...result.suggestions.map((s) => ({ kind: 'facet' as const, suggestion: s })),
    ],
    [photoRows, result.suggestions]
  );

  useEffect(() => setCursor(0), [text, chips.length]);

  /**
   * `/` met le focus dans le champ — SAUF si le focus est déjà dans une zone de
   * saisie, sinon on ne pourrait plus taper de slash nulle part dans le Studio.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Pose un jeton et vide le mot en cours de frappe. */
  const applySuggestion = useCallback(
    (facetKey: string, value: Primitive) => {
      toggleFacet(facetKey, value);
      setText('');
      inputRef.current?.focus();
    },
    [toggleFacet, setText]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => Math.min(c + 1, options.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        return;
      }
      if (event.key === 'Enter') {
        const option = options[cursor];
        if (!option) return;
        event.preventDefault();
        if (option.kind === 'facet') {
          applySuggestion(option.suggestion.facetKey, option.suggestion.value);
        } else {
          window.location.hash = `#/intent/edit/id=${option.hit.doc.id};type=photo`;
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (text !== '') setText('');
        else clearAll();
        return;
      }
      // Sur un champ VIDE, Backspace retire le dernier jeton — l'affordance que
      // tout le monde attend d'un champ à jetons, et dont l'absence se remarque.
      if (event.key === 'Backspace' && text === '' && chips.length > 0) {
        event.preventDefault();
        const last = chips[chips.length - 1];
        toggleFacet(last.facetKey, last.value);
      }
    },
    [options, cursor, text, chips, applySuggestion, setText, clearAll, toggleFacet]
  );

  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={3}>
        <Flex gap={2} align="center" wrap="wrap">
          <Box paddingRight={1}>
            <Text muted>
              <SearchIcon />
            </Text>
          </Box>
          {chips.map((chip) => (
            <Card
              key={`${chip.facetKey}:${chip.value}`}
              as="button"
              __unstable_focusRing
              padding={2}
              radius={2}
              tone="primary"
              onClick={() => toggleFacet(chip.facetKey, chip.value)}
            >
              <Flex gap={2} align="center">
                <Text size={1}>{chip.label}</Text>
                <Text size={1} muted>
                  <CloseIcon />
                </Text>
              </Flex>
            </Card>
          ))}
          <Box flex={1} style={{ minWidth: 200 }}>
            <TextInput
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              onKeyDown={onKeyDown}
              placeholder="Chercher une photo — titre, lieu, année, boîtier…   ( / )"
              border={false}
              fontSize={2}
            />
          </Box>
          {!isPristine && (
            <Button mode="bleed" fontSize={1} text="Tout effacer" onClick={clearAll} />
          )}
        </Flex>

        {options.length > 0 && (
          <Stack space={1}>
            {options.map((option, i) =>
              option.kind === 'photo' ? (
                <Card
                  key={`p:${option.hit.doc.id}`}
                  as="button"
                  __unstable_focusRing
                  padding={2}
                  radius={2}
                  tone={i === cursor ? 'primary' : 'default'}
                  onClick={() => {
                    window.location.hash = `#/intent/edit/id=${option.hit.doc.id};type=photo`;
                  }}
                >
                  <Flex justify="space-between" gap={3}>
                    <Text size={1}>{option.hit.doc.title ?? 'Sans titre'}</Text>
                    <Text size={1} muted>
                      {[option.hit.doc.year, option.hit.doc.location]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Flex>
                </Card>
              ) : (
                <Card
                  key={`f:${option.suggestion.facetKey}:${option.suggestion.value}`}
                  as="button"
                  __unstable_focusRing
                  padding={2}
                  radius={2}
                  tone={i === cursor ? 'primary' : 'transparent'}
                  onClick={() =>
                    applySuggestion(
                      option.suggestion.facetKey,
                      option.suggestion.value
                    )
                  }
                >
                  <Flex justify="space-between" gap={3}>
                    <Text size={1}>{option.suggestion.label}</Text>
                    <Text size={1} muted>
                      {option.suggestion.facetLabel.toLowerCase()} ·{' '}
                      {option.suggestion.count}
                    </Text>
                  </Flex>
                </Card>
              )
            )}
          </Stack>
        )}

        {!isPristine && (
          <Text size={1} muted>
            {result.total} résultat{result.total > 1 ? 's' : ''}
          </Text>
        )}

        {result.didYouMean && (
          <Card padding={3} radius={2} tone="caution">
            <Flex gap={2} align="center" wrap="wrap">
              <Text size={1}>Aucun résultat. Chercher</Text>
              <Button
                mode="bleed"
                fontSize={1}
                text={result.didYouMean}
                onClick={() => setText(result.didYouMean ?? '')}
              />
              <Text size={1}>?</Text>
            </Flex>
          </Card>
        )}
      </Stack>
    </Card>
  );
}
```

⚠️ Les lignes cliquables composites sont des `<Card as="button" __unstable_focusRing>` et **jamais** des `<Button>` : `ButtonProps` de `@sanity/ui` v3 n'expose pas `children`, une ligne passée en enfant ne s'afficherait pas, sans erreur ni avertissement (CLAUDE.md §11.13).

- [ ] **Step 2: Vérifier la compilation**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add sanity/tools/search/SearchCard.tsx
git commit -m "feat(search): omnibox à jetons, suggestions mêlées et clavier"
```

---

### Task 10: Panneau de facettes, planche-contact, montage

**Files:**
- Create: `sanity/tools/search/ResultGrid.tsx`
- Modify: `sanity/tools/search/SearchCard.tsx`
- Modify: `sanity/tools/Dashboard.tsx`

**Interfaces:**
- Consumes: tout de la tâche 9.
- Produces: la carte complète, montée en tête du Tableau de bord.

- [ ] **Step 1: Écrire la planche-contact**

Créer `sanity/tools/search/ResultGrid.tsx` :

```tsx
import { Badge, Box, Card, Flex, Grid, Stack, Text } from '@sanity/ui';
import { IntentLink } from 'sanity/router';

import type { PhotoRecord } from './photoIndexQuery';
import type { ThumbFn } from './SearchCard';

/**
 * Planche-contact : un photographe reconnaît une IMAGE, pas une ligne de texte.
 *
 * ⚠️ Ce composant est le SLOT de rendu d'un résultat. Pour une autre affaire on
 * le remplace par une carte produit ; le moteur ne s'en aperçoit pas (spec §9.3).
 */
export function ResultGrid({
  hits,
  thumbUrl,
}: {
  hits: { doc: PhotoRecord }[];
  thumbUrl: ThumbFn;
}) {
  return (
    <Grid columns={[3, 4, 6]} gap={2}>
      {hits.map(({ doc }) => {
        const url = thumbUrl(doc.image, 220);
        return (
          <IntentLink
            key={doc.id}
            intent="edit"
            params={{ id: doc.id, type: 'photo' }}
            style={{ textDecoration: 'none' }}
          >
            <Card radius={2} overflow="hidden" tone="transparent" border>
              <Stack space={2}>
                <Box
                  style={{
                    aspectRatio: '1 / 1',
                    background: url ? `center/cover url(${url})` : 'var(--card-muted-fg-color)',
                  }}
                />
                <Box padding={2}>
                  <Stack space={2}>
                    <Flex gap={2} align="center">
                      <Text size={1} weight="medium" textOverflow="ellipsis">
                        {doc.title ?? 'Sans titre'}
                      </Text>
                      {doc.hasDraft && <Badge tone="caution" fontSize={0}>brouillon</Badge>}
                    </Flex>
                    <Text size={0} muted textOverflow="ellipsis">
                      {[doc.year, doc.location].filter(Boolean).join(' · ')}
                    </Text>
                  </Stack>
                </Box>
              </Stack>
            </Card>
          </IntentLink>
        );
      })}
    </Grid>
  );
}
```

- [ ] **Step 2: Ajouter le panneau et la grille dans `SearchCard.tsx`**

Ajouter l'import `import { ResultGrid } from './ResultGrid';`, les icônes `ChevronDownIcon`/`ChevronUpIcon`, et l'état `const [panelOpen, setPanelOpen] = useState(false);`.

Ajouter le bouton dans la rangée du champ, après « Tout effacer » :

```tsx
          <Button
            mode="ghost"
            fontSize={1}
            text="Filtrer"
            iconRight={panelOpen ? ChevronUpIcon : ChevronDownIcon}
            onClick={() => setPanelOpen((open) => !open)}
          />
```

Ajouter le panneau, entre la liste de suggestions et le compte de résultats :

```tsx
        {panelOpen && (
          <Card padding={3} radius={2} tone="transparent" border>
            <Stack space={4}>
              {result.facets.map((group) => (
                <Stack key={group.key} space={2}>
                  <Text size={0} muted weight="semibold">
                    {group.label.toUpperCase()}
                  </Text>
                  <Flex gap={2} wrap="wrap">
                    {group.values.map((value) => (
                      <Card
                        key={String(value.value)}
                        as="button"
                        __unstable_focusRing
                        padding={2}
                        radius={2}
                        border
                        tone={value.active ? 'primary' : 'default'}
                        disabled={value.disabled && !value.active}
                        onClick={() => toggleFacet(group.key, value.value)}
                        style={{
                          cursor: value.disabled && !value.active ? 'not-allowed' : 'pointer',
                          opacity: value.disabled && !value.active ? 0.4 : 1,
                        }}
                      >
                        <Flex gap={2} align="center">
                          <Text size={1}>{value.label}</Text>
                          <Text size={1} muted>{value.count}</Text>
                        </Flex>
                      </Card>
                    ))}
                  </Flex>
                </Stack>
              ))}
            </Stack>
          </Card>
        )}
```

⚠️ Une valeur menant à zéro est **désactivée, jamais cachée** : son compte à 0 reste lisible, pour qu'on comprenne qu'elle existe mais ne s'applique pas ici (spec §4.5).

Ajouter la grille, après le compte de résultats :

```tsx
        {!isPristine && result.hits.length > 0 && (
          <ResultGrid hits={result.hits} thumbUrl={thumbUrl} />
        )}
```

⚠️ La garde `!isPristine` est le comportement de la spec §5.3 : champ vide et aucune facette → **aucune vignette**. Rendre 200 images au chargement doublerait le coût du Tableau de bord pour un contenu que personne n'a demandé.

- [ ] **Step 3: Monter la carte dans le Tableau de bord**

Dans `sanity/tools/Dashboard.tsx`, importer `SearchCard` et l'insérer **avant** `<StatsCard …>` :

```tsx
            <SearchCard rows={data.searchIndex} thumbUrl={thumbUrl} />
            <StatsCard data={data} siteUrl={siteUrl} />
```

- [ ] **Step 4: Vérifier**

Run: `npm run typecheck`
Expected: aucune erreur.

Run: `npm run check-search`
Expected: `68/68 assertions OK.`

Run: `npm run dev`, puis ouvrir `http://localhost:3010/studio` (Playwright — Chrome n'atteint pas localhost sur cette machine). Vérifier point par point :

1. La carte est en tête, au-dessus de « Vue d'ensemble ». Champ vide → **aucune vignette**.
2. Taper `djreba` → « Djerba … » remonte. La faute est absorbée.
3. Taper `bus` → « Bus n tree » seul. Ni « Buoys » ni « Bowling ».
4. Taper `fuji` → une suggestion « Fujifilm X-PRO 2 — boîtier · N ». Clic → un jeton apparaît, le champ se vide, la grille se filtre.
5. `Backspace` sur champ vide → le jeton disparaît.
6. `/` depuis n'importe où dans le Tableau de bord → le focus arrive dans le champ. `/` **dans** le champ → un slash est tapé.
7. `↓` `↓` `Entrée` → ouvre le formulaire de la photo visée.
8. « Filtrer » → les six axes, comptes non nuls. Cocher deux années : la grille grandit. Cocher aussi un lieu : elle rétrécit.
9. Cocher une année, rouvrir le panneau : **les autres années gardent des comptes non nuls**.
10. Taper `djreeba` → « Aucun résultat. Chercher **djerba** ? », le bouton corrige.
11. Éditer une photo sans publier, revenir : elle apparaît **une seule fois**, badge « brouillon », titre du brouillon.

- [ ] **Step 5: Commit**

```bash
git add sanity/tools/search/ResultGrid.tsx sanity/tools/search/SearchCard.tsx sanity/tools/Dashboard.tsx
git commit -m "feat(search): panneau de facettes, planche-contact et montage au Tableau de bord"
```

---

### Task 11: Capitalisation et documentation

**Files:**
- Create: `resources/learning/recherche-a-facettes-tolerante-aux-fautes.md`
- Create: `FREELANCE/RESOURCES/existing-components/faceted-fuzzy-search/` (hors dépôt — chemin absolu `/Users/baronmuster/Documents/FREELANCE/RESOURCES/existing-components/faceted-fuzzy-search/`)
- Modify: `.claude/skills/sanity-studio/SKILL.md` (§11.4, la description du Dashboard)

**Interfaces:**
- Consumes: le code livré aux tâches 1 à 10.
- Produces: la note d'apprentissage et l'archive réutilisable.

- [ ] **Step 1: Écrire la note d'apprentissage**

Créer `resources/learning/recherche-a-facettes-tolerante-aux-fautes.md`, **sans code** (protocole de `resources/learning/README.md`), couvrant :

- Pourquoi le flou ne pouvait pas être côté serveur : GROQ n'a aucune tolérance à la faute de frappe, et `score()` n'accepte ni sous-requête ni déréférencement.
- Les trois étages comme ordre de **confiance**, et pourquoi un flou doit toujours passer derrière une sous-chaîne.
- Damerau contre Levenshtein : l'inversion adjacente vaut une erreur et pas deux ; c'est la faute de frappe la plus courante.
- Le budget d'erreur **par longueur de mot**, et la mesure qui l'a imposé : 42 titres sur 200 font 8 caractères ou moins.
- Les deux gardes anti-bruit de la sous-séquence, et le cas exact qu'elles règlent (« bus » ne doit pas trouver « buoys », « djfi » doit trouver « djerba fishermen »).
- La règle du comptage de facette hors sélection propre, et ce qui casse sans elle.
- Le pliage NFD qui préserve le cyrillique, et ses deux effets de bord souhaitables en russe (й→и, ё→е).
- Le rebasage des brouillons, et pourquoi les valeurs du brouillon gagnent.
- Ce qui rend le noyau transposable : la configuration comme seule surface propre au domaine.

- [ ] **Step 2: Constituer l'archive réutilisable**

```bash
DEST=/Users/baronmuster/Documents/FREELANCE/RESOURCES/existing-components/faceted-fuzzy-search
mkdir -p "$DEST/lib" "$DEST/examples"
cp lib/search/*.ts "$DEST/lib/"
cp scripts/check-search.ts "$DEST/"
cp sanity/tools/search/photoSearchConfig.ts "$DEST/examples/"
```

Écrire `$DEST/README.md` : ce que c'est, comment le brancher (les trois appels : `buildIndex`, `search`, `useFacetedSearch`), le contrat de `SearchConfig`, le plafond de ~5 000 fiches et les deux leviers au-delà (spec §8), la configuration photo comme exemple, et une **configuration épicerie fictive** — reprendre celle de la spec §9.1 — pour montrer la transposition. Signaler explicitement que les facettes par tranches (`kind: 'range'`) sont **réservées et non implémentées**, avec la forme d'extension de la spec §9.2.

- [ ] **Step 3: Mettre à jour la doc du Studio**

Dans `.claude/skills/sanity-studio/SKILL.md` §11.4, la liste passe de « 6 cartes » à 7. Ajouter en tête :

> 0. **Recherche** — omnibox à jetons, tolérante aux fautes de frappe, doublée d'un panneau de facettes (année, lieu, série, style, boîtier, objectif) et d'une planche-contact. Moteur dans `lib/search/` — **domaine-agnostique, réutilisable** ; tout ce qu'il sait des photos tient dans `sanity/tools/search/photoSearchConfig.ts`. Index chargé avec la GROQ du Dashboard (clé `searchIndex`), brouillons rebasés sur l'id publié. Assertions : `npm run check-search`. Conception : `docs/superpowers/specs/2026-08-25-dashboard-search-design.md`.

Ajouter aussi les cinq nouveaux fichiers au tableau §11.9 (« Mapping des fichiers Sanity ») et `check-search` au tableau des scripts CLI §11.10 (colonne « Token requis » : —, « Idempotent » : ✓ read-only).

- [ ] **Step 4: Vérifier**

Run: `npm run check-search && npm run typecheck && npm run build`
Expected: assertions vertes, typecheck vert, build de production sans erreur (CLAUDE.md §8.2).

- [ ] **Step 5: Commit**

```bash
git add resources/learning/recherche-a-facettes-tolerante-aux-fautes.md .claude/skills/sanity-studio/SKILL.md
git commit -m "docs(search): note d'apprentissage et mise à jour de la doc Studio"
```

---

## Auto-relecture du plan

**Couverture de la spec.** §1 périmètre → tâches 1-10, les exclusions ne produisent aucune tâche (voulu). §2 mesures → citées dans les commentaires de `distance.ts` et `photoIndexQuery.ts`. §3 architecture → tableau des fichiers, tâches 1-10. §4.1 contrat → t.3. §4.2 normalisation → t.1. §4.3 trois étages et budgets → t.2. §4.4 poids → t.8. §4.5 facettes → t.5. §4.6 zéro résultat → t.6. §5.1 emplacement → t.10 step 3. §5.2 anatomie → t.9 et t.10. §5.3 état par défaut → t.10 (garde `!isPristine`). §5.4 clavier → t.9. §6 trois pièges → t.8 (brouillons), t.9 et t.10 (`Card as="button"`), t.5 (comptage). §7 les 15 assertions → réparties sur t.1 à t.8, chacune nommée par son numéro de cas. §8 plafond → documenté dans `buildIndex.ts` et le README d'archive (t.11). §9 réutilisation → `index.ts` (t.6), `photoSearchConfig.ts` (t.8), `ResultGrid` comme slot (t.10), archive (t.11). §10 capitalisation → t.11. §11 points ouverts → hors chantier, aucune tâche.

**Placeholders.** Aucun « TBD », « TODO », « similaire à la tâche N ». Chaque étape de code porte son code.

**Cohérence des types.** `PhotoIndexRow` (GROQ brut, `_id`) et `PhotoRecord` (rebasé, `id` + `hasDraft`) sont distincts et employés distinctement : `SearchCard` reçoit `rows: PhotoIndexRow[]`, `photoSearchConfig` et `ResultGrid` consomment `PhotoRecord`. `ThumbFn` est exporté depuis `SearchCard.tsx` et importé par `ResultGrid.tsx`. `phraseScore` est un alias exporté de `subsequenceScore` — les deux noms apparaissent, c'est délibéré et commenté. `toggleFacet(facetKey, value)` a la même signature partout.

**Écarts assumés au regard de la skill.** La tâche 7 (hook React) n'a pas de cycle test-rouge/test-vert : le vérifier exigerait un moteur de rendu, donc un framework de test, ce que CLAUDE.md §7.4 interdit d'introduire sans validation explicite. Sa vérification est manuelle et énumérée en t.10 step 4. Les tâches 9 à 11 sont dans le même cas pour la même raison.
