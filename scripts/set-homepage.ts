/**
 * Toggle `onHomepage` sur les N premières photos (triées par `order` croissant).
 *
 * Usage :
 *   npm run set-homepage          → met les 30 premières sur la home
 *   npm run set-homepage -- 50    → met les 50 premières
 *   npm run set-homepage -- 12    → met les 12 premières
 *
 * Le script lit l'ordre actuel dans Sanity, sélectionne les N premières,
 * et met `onHomepage: true` pour celles-ci, `false` pour toutes les autres.
 *
 * Pour réordonner : édite le champ `order` dans Studio (plus petit = plus tôt).
 */

import { createClient } from '@sanity/client';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;

if (!PROJECT_ID || !WRITE_TOKEN) {
  console.error(
    '✗ Variables manquantes (NEXT_PUBLIC_SANITY_PROJECT_ID + SANITY_API_WRITE_TOKEN dans .env.local).'
  );
  process.exit(1);
}

const N = parseInt(process.argv[2] ?? '30', 10);
if (Number.isNaN(N) || N < 0) {
  console.error('✗ Argument invalide. Utilise un entier positif (ex : 30).');
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN,
  useCdn: false,
});

type PhotoRow = { _id: string; title: string; order: number; onHomepage: boolean };

async function main(): Promise<void> {
  const photos = await client.fetch<PhotoRow[]>(
    `*[_type == "photo"] | order(order asc) { _id, title, order, onHomepage }`
  );

  if (photos.length === 0) {
    console.log('Aucune photo dans Sanity. Lance d\'abord `npm run upload-photos`.');
    return;
  }

  console.log(
    `Total photos : ${photos.length}. Cibles homepage : ${Math.min(N, photos.length)}.\n`
  );

  let updated = 0;
  let unchanged = 0;

  // Transaction unique pour atomicité
  let tx = client.transaction();

  for (const [index, photo] of photos.entries()) {
    const shouldBeOnHomepage = index < N;
    if (photo.onHomepage === shouldBeOnHomepage) {
      unchanged++;
      continue;
    }
    tx = tx.patch(photo._id, { set: { onHomepage: shouldBeOnHomepage } });
    updated++;
    console.log(
      `  ${shouldBeOnHomepage ? '✓ home' : '✗ off  '}  [${photo.order}] ${photo.title}`
    );
  }

  if (updated === 0) {
    console.log('\nRien à mettre à jour. Tout est déjà conforme.');
    return;
  }

  await tx.commit();
  console.log(`\n✓ ${updated} photo${updated > 1 ? 's' : ''} mise${updated > 1 ? 's' : ''} à jour. ${unchanged} déjà conforme${unchanged > 1 ? 's' : ''}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
