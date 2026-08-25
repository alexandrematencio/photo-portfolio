/**
 * Vérification du moteur de recherche (`npm run check-search`).
 *
 * Pas de framework de test (cf. CLAUDE.md §7.4) : de simples assertions
 * exécutables, hors ligne, sur des données fabriquées ici. Le classement flou
 * est exactement le genre de logique qui se dégrade en silence — un seuil mal
 * réglé ne plante pas, il rend juste de moins bons résultats.
 *
 * Cas de référence dans la spec :
 * docs/superpowers/specs/2026-08-25-dashboard-search-design.md §7
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
  { id: 'b', title: 'Djerba Beach',     alt: 'plage',   location: 'Djerba, Tunisia',  year: 2023, camera: 'Fujifilm X-PRO 2', styles: ['Landscape'] },
  { id: 'c', title: 'Bus n tree',       alt: 'bus',     location: 'Paris, France',    year: 2024, camera: 'Ricoh GR III',     styles: ['Street'] },
  { id: 'd', title: 'Buoys',            alt: 'bouées',  location: 'Biarritz, France', year: 2024, camera: 'Ricoh GR III',     styles: ['Landscape'] },
  { id: 'e', title: 'Bowling',          alt: 'bowling', location: 'Paris, France',    year: 2025, camera: 'Ricoh GR III',     styles: ['Street'] },
  { id: 'f', title: 'Дума',             alt: 'douma',   location: 'Moscow, Russia',   year: 2021, camera: 'Ricoh GR III',     styles: ['Architecture'] },
  { id: 'g', title: 'Archi',            alt: 'archi',   location: 'Paris, France',    year: 2026, camera: 'Ricoh GR III',     styles: ['Architecture'] },
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

// ── Bilan ────────────────────────────────────────────────────────────────────

console.log(`\n${total - failed}/${total} assertions OK.`);
if (failed > 0) process.exit(1);
