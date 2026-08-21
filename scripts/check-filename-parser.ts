/**
 * Vérification du parser de noms de fichiers (`npm run check-parser`).
 *
 * Pas de framework de test (cf. CLAUDE.md §7.4) : de simples assertions
 * exécutables. Le parser mêle champs explicites et déduction par contenu,
 * c'est-à-dire exactement le genre de logique qui casse en silence — d'où ce
 * garde-fou lançable en une commande après toute modification des règles.
 */

import { parsePhotoFilename, type ParseContext } from './parse-photo-filename';
import { normalizeForMatch } from './taxonomy-helpers';

const ctx: ParseContext = {
  styleAliases: new Set(
    [
      'sp', 'street', 'rue', 'streetphotography',
      'paysage', 'ls', 'landscape',
      'pt', 'portrait',
      'archi', 'ar', 'architecture',
      'topo', // « topo » est à la fois style et série : teste la priorité
    ].map(normalizeForMatch)
  ),
  cameraAliases: new Set(['Fuji X-PRO2', 'X-Pro2'].map(normalizeForMatch)),
  lensAliases: new Set(['MF 35MM f1.4 Meike'].map(normalizeForMatch)),
  knownLocations: new Set(
    ['Paris, France', 'Djerba, Tunisia', 'Villejuif, France'].map(normalizeForMatch)
  ),
  seriesKeys: new Set(
    ['Global Street', 'Topo', 'Djerba', 'Paris'].map(normalizeForMatch)
  ),
  currentYear: 2026,
};

type Expect = {
  title?: string;
  location?: string | null;
  styleTokens?: string[];
  seriesTokens?: string[];
  cameraToken?: string | null;
  lensToken?: string | null;
  year?: number | null;
  dateTaken?: string | null;
  unresolved?: string[];
  legacy?: boolean;
};

const CASES: { name: string; input: string; expect: Expect }[] = [
  {
    name: 'Forme complète implicite (convention historique)',
    input: 'Pas de vin à la fête -paris, france -sp,paysage -Fuji X-PRO2 -MF 35MM f1.4 Meike',
    expect: {
      title: 'Pas de vin à la fête',
      location: 'paris, france',
      styleTokens: ['sp', 'paysage'],
      cameraToken: 'Fuji X-PRO2',
      lensToken: 'MF 35MM f1.4 Meike',
      unresolved: [],
    },
  },
  {
    name: 'Champs explicites, ordre A : lieu puis date',
    input: 'Ma photo -lieu:Paris, France -date:2024-06-12',
    expect: { title: 'Ma photo', location: 'Paris, France', dateTaken: '2024-06-12', year: 2024 },
  },
  {
    name: 'Champs explicites, ordre B : date puis lieu (doit être identique)',
    input: 'Ma photo -date:2024-06-12 -lieu:Paris, France',
    expect: { title: 'Ma photo', location: 'Paris, France', dateTaken: '2024-06-12', year: 2024 },
  },
  {
    name: 'Ordre totalement inversé, tous champs explicites',
    input: 'Nuit blanche -objectif:MF 35MM f1.4 Meike -style:sp -annee:2023 -boitier:Fuji X-PRO2 -lieu:Djerba, Tunisia',
    expect: {
      title: 'Nuit blanche',
      location: 'Djerba, Tunisia',
      styleTokens: ['sp'],
      cameraToken: 'Fuji X-PRO2',
      lensToken: 'MF 35MM f1.4 Meike',
      year: 2023,
    },
  },
  {
    name: 'Minimum demandé : nom + année + lieu',
    input: 'Toits gris -2024 -Paris, France',
    expect: {
      title: 'Toits gris',
      location: 'Paris, France',
      year: 2024,
      styleTokens: [],
      cameraToken: null,
      lensToken: null,
      unresolved: [],
    },
  },
  {
    name: 'Minimum, ordre inverse (lieu avant année)',
    input: 'Toits gris -Paris, France -2024',
    expect: { title: 'Toits gris', location: 'Paris, France', year: 2024 },
  },
  {
    name: 'Nom seul : rien ne plante',
    input: 'Une photo sans rien',
    expect: {
      title: 'Une Photo Sans Rien',
      location: null,
      styleTokens: [],
      year: null,
      legacy: true,
    },
  },
  {
    name: 'Nom + style uniquement',
    input: 'Silhouette -portrait',
    expect: { title: 'Silhouette', styleTokens: ['portrait'], location: null, year: null },
  },
  {
    name: 'Préfixe double tiret toléré (réflexe ligne de commande)',
    input: 'Test --lieu:Paris, France --annee:2025',
    expect: { title: 'Test', location: 'Paris, France', year: 2025 },
  },
  {
    name: 'Mélange explicite + implicite',
    input: 'Mix -sp,portrait -lieu:Villejuif, France -2022',
    expect: {
      title: 'Mix',
      location: 'Villejuif, France',
      styleTokens: ['sp', 'portrait'],
      year: 2022,
    },
  },
  {
    name: 'Titre contenant un tiret collé (ne doit PAS être coupé)',
    input: 'Rendez-vous à l’aube -paris, france -sp',
    expect: { title: 'Rendez-vous à l’aube', location: 'paris, france', styleTokens: ['sp'] },
  },
  {
    name: 'Jeton incompréhensible : signalé, non bloquant',
    input: 'Bizarre -paris, france -zzzblah',
    expect: { title: 'Bizarre', location: 'paris, france', unresolved: ['zzzblah'] },
  },
  {
    name: 'Clé inconnue : signalée, non bloquante',
    input: 'Bizarre -truc:machin -lieu:Paris, France',
    expect: { title: 'Bizarre', location: 'Paris, France', unresolved: ['truc:machin'] },
  },
  {
    name: 'Espace après la virgule des styles',
    input: 'Espaces -paris, france -sp, paysage',
    expect: { location: 'paris, france', styleTokens: ['sp', 'paysage'] },
  },
  {
    name: 'Année hors bornes ignorée, pas de crash',
    input: 'Vieux -lieu:Paris, France -annee:1789',
    expect: { location: 'Paris, France', year: null },
  },
  {
    name: 'Lieu inconnu mais forme « Ville, Pays » reconnue',
    input: 'Ailleurs -Lisbonne, Portugal -sp',
    expect: { location: 'Lisbonne, Portugal', styleTokens: ['sp'] },
  },
  {
    name: 'Multi-styles + multi-séries implicites (exemple Alexandre)',
    input: 'Scène -street, topo -global street, topo',
    expect: {
      title: 'Scène',
      styleTokens: ['street', 'topo'],
      seriesTokens: ['global street', 'topo'],
      location: null,
      unresolved: [],
    },
  },
  {
    name: 'Série explicite, une seule',
    input: 'Solo -serie:Global Street -paris, france',
    expect: {
      seriesTokens: ['Global Street'],
      location: 'paris, france',
      unresolved: [],
    },
  },
  {
    name: 'Séries explicites multiples, clé accentuée',
    input: 'Duo -séries:Global Street, Topo',
    expect: { seriesTokens: ['Global Street', 'Topo'], unresolved: [] },
  },
  {
    name: 'Série implicite sans virgule (existante)',
    input: 'Plage -Djerba -sp',
    expect: { seriesTokens: ['Djerba'], styleTokens: ['sp'], location: null },
  },
  {
    name: 'Le lieu n’est pas volé par les séries (« france » n’en est pas une)',
    input: 'Toits -paris, france',
    expect: { location: 'paris, france', seriesTokens: [] },
  },
  {
    name: 'Jeton à la fois style et série : le style gagne',
    input: 'Ambigu -topo',
    expect: { styleTokens: ['topo'], seriesTokens: [] },
  },
];

function eq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

let failed = 0;
let checks = 0;

for (const c of CASES) {
  const got = parsePhotoFilename(c.input, ctx);
  const problems: string[] = [];
  for (const [key, want] of Object.entries(c.expect)) {
    checks++;
    const actual = (got as unknown as Record<string, unknown>)[key];
    if (!eq(actual, want)) {
      problems.push(
        `    ${key} : attendu ${JSON.stringify(want)}, obtenu ${JSON.stringify(actual)}`
      );
    }
  }
  if (problems.length > 0) {
    failed++;
    console.log(`✗ ${c.name}`);
    console.log(`    entrée : ${c.input}`);
    problems.forEach((p) => console.log(p));
  } else {
    console.log(`✓ ${c.name}`);
  }
}

console.log(
  `\n${CASES.length - failed}/${CASES.length} cas OK (${checks} assertions).`
);
if (failed > 0) process.exit(1);
