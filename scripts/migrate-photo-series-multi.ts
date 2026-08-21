/**
 * Migration one-shot : `photo.series` passe d'une référence UNIQUE à un
 * TABLEAU de références — une photo peut appartenir à plusieurs séries.
 *
 * Usage :
 *   npm run migrate-series-multi              → DRY-RUN (n'écrit rien)
 *   npm run migrate-series-multi -- --yes     → applique
 *
 * Idempotent : une photo dont `series` est déjà un tableau est ignorée. On
 * peut donc relancer sans risque, y compris après un échec partiel.
 *
 * ⚠️ Fenêtre d'incohérence : entre le déploiement du schéma (tableau) et
 * l'exécution de ce script, les photos encore en référence unique s'ouvrent
 * dans le Studio avec un conflit de type. Ne pas éditer de photo dans cet
 * intervalle — le plus simple est d'enchaîner les deux.
 *
 * Le SITE, lui, n'est pas affecté avant redéploiement : aucun composant ne lit
 * `photo.series` directement, et les requêtes passent par `references()`, qui
 * traite indifféremment une référence unique et un tableau.
 *
 * Les brouillons sont migrés comme les documents publiés : un draft laissé en
 * référence unique ressortirait en conflit de type dès sa réouverture.
 */

import { createClient } from '@sanity/client';
import { createInterface } from 'node:readline/promises';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;

const APPLY = process.argv.includes('--yes');

if (!PROJECT_ID) {
  console.error('✗ NEXT_PUBLIC_SANITY_PROJECT_ID manquant dans .env.local.');
  process.exit(1);
}
if (APPLY && !WRITE_TOKEN) {
  console.error('✗ SANITY_API_WRITE_TOKEN manquant dans .env.local.');
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN ?? process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
  // `raw` : on doit voir les brouillons ET les documents publiés, chacun
  // portant sa propre valeur de `series`.
  perspective: 'raw',
});

type Row = {
  _id: string;
  title: string | null;
  series: unknown;
};

/** Clé d'item de tableau. Sanity l'exige sur chaque membre d'un array. */
function itemKey(): string {
  return Math.random().toString(36).slice(2, 12);
}

function isSingleRef(value: unknown): value is { _ref: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { _ref?: unknown })._ref === 'string'
  );
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} (oui/non) `);
  rl.close();
  return ['oui', 'o', 'yes', 'y'].includes(answer.trim().toLowerCase());
}

async function main(): Promise<void> {
  const rows = await client.fetch<Row[]>(
    `*[_type == "photo"] | order(_id asc) { _id, title, series }`
  );

  const toMigrate: { row: Row; ref: string }[] = [];
  const alreadyArray: Row[] = [];
  const empty: Row[] = [];
  const weird: Row[] = [];

  for (const row of rows) {
    if (Array.isArray(row.series)) {
      alreadyArray.push(row);
    } else if (isSingleRef(row.series)) {
      toMigrate.push({ row, ref: row.series._ref });
    } else if (row.series === null || row.series === undefined) {
      empty.push(row);
    } else {
      // Ni tableau, ni référence, ni vide : on ne devine pas, on signale.
      weird.push(row);
    }
  }

  // Titres de séries, pour un rapport lisible plutôt qu'une liste d'ids.
  const seriesTitles = new Map<string, string>();
  if (toMigrate.length > 0) {
    const ids = Array.from(new Set(toMigrate.map((t) => t.ref)));
    const series = await client.fetch<{ _id: string; title: string }[]>(
      `*[_type == "series" && _id in $ids]{ _id, title }`,
      { ids }
    );
    for (const s of series) seriesTitles.set(s._id, s.title);
  }

  console.log(
    `\n${APPLY ? 'MIGRATION' : 'DRY-RUN — aucune écriture'} · ${DATASET}\n`
  );
  console.log(`Documents photo analysés : ${rows.length}`);
  console.log(`  · à migrer (référence unique → tableau) : ${toMigrate.length}`);
  console.log(`  · déjà en tableau, ignorées             : ${alreadyArray.length}`);
  console.log(`  · sans série, rien à faire              : ${empty.length}`);
  if (weird.length > 0) {
    console.log(`  · ⚠️ valeur inattendue, NON touchées    : ${weird.length}`);
  }

  if (toMigrate.length > 0) {
    // Répartition par série : c'est ce qui permet de vérifier d'un coup d'œil
    // qu'aucun rattachement ne se perd en route.
    const perSeries = new Map<string, number>();
    for (const { ref } of toMigrate) {
      perSeries.set(ref, (perSeries.get(ref) ?? 0) + 1);
    }
    console.log('\nRattachements préservés, par série :');
    for (const [ref, count] of Array.from(perSeries.entries()).sort(
      (a, b) => b[1] - a[1]
    )) {
      const label = seriesTitles.get(ref);
      console.log(
        `  • ${label ?? `(série introuvable : ${ref})`} — ${count} photo${count > 1 ? 's' : ''}`
      );
    }

    const orphans = Array.from(perSeries.keys()).filter(
      (ref) => !seriesTitles.has(ref)
    );
    if (orphans.length > 0) {
      console.log(
        `\n⚠️ ${orphans.length} référence(s) pointent une série inexistante. Elles sont migrées telles quelles (le tableau conserve la référence cassée, exactement comme le champ actuel) — à nettoyer dans le Studio.`
      );
    }
  }

  if (weird.length > 0) {
    console.log('\nValeurs inattendues (à regarder à la main) :');
    for (const row of weird.slice(0, 20)) {
      console.log(
        `  • ${row._id} — ${row.title ?? '(sans titre)'} → ${JSON.stringify(row.series)}`
      );
    }
  }

  if (toMigrate.length === 0) {
    console.log('\n✓ Rien à migrer.');
    return;
  }

  if (!APPLY) {
    console.log(
      '\nDry-run terminé. Relance avec `-- --yes` pour appliquer.\n'
    );
    return;
  }

  if (!(await confirm(`\nMigrer ${toMigrate.length} photo(s) ?`))) {
    console.log('Annulé.');
    return;
  }

  // Une seule transaction : soit tout passe, soit rien. Évite un dataset
  // à moitié migré, où le Studio afficherait des conflits de type épars.
  let tx = client.transaction();
  for (const { row, ref } of toMigrate) {
    tx = tx.patch(row._id, (p) =>
      p.set({
        series: [{ _key: itemKey(), _type: 'reference', _ref: ref }],
      })
    );
  }
  await tx.commit({ visibility: 'async' });

  console.log(`\n✓ ${toMigrate.length} photo(s) migrée(s).`);
  console.log(
    'Pense à publier les brouillons concernés puis à lancer `npm run deploy` pour que le site reflète l’état du CMS.\n'
  );
}

main().catch((error) => {
  console.error('✗ Échec de la migration :', error);
  process.exit(1);
});
