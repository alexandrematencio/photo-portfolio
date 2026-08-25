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

// ── Bilan ────────────────────────────────────────────────────────────────────

console.log(`\n${total - failed}/${total} assertions OK.`);
if (failed > 0) process.exit(1);
