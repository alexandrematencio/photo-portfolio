/**
 * Supprime TOUS les documents `photo` de Sanity ET leurs assets image associés.
 *
 * DESTRUCTIF. Utilise uniquement pour repartir d'une page blanche
 * (ex : après avoir renommé tous les fichiers locaux).
 *
 * Usage :
 *   npm run wipe-photos             → mode dry-run (liste ce qui serait supprimé)
 *   npm run wipe-photos -- --yes    → exécute la suppression
 *   npm run wipe-photos -- --yes --keep-assets  → garde les assets (utile si réutilisés ailleurs)
 *
 * Après wipe, relance `npm run upload-photos` puis `npm run set-homepage`.
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

const args = process.argv.slice(2);
const confirmed = args.includes('--yes');
const keepAssets = args.includes('--keep-assets');

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN,
  useCdn: false,
});

type PhotoRow = {
  _id: string;
  title: string;
  image?: { asset?: { _ref?: string } };
};

async function main(): Promise<void> {
  const photos = await client.fetch<PhotoRow[]>(
    `*[_type == "photo"] | order(order asc) { _id, title, image }`
  );

  if (photos.length === 0) {
    console.log('Aucun document `photo` dans Sanity. Rien à faire.');
    return;
  }

  console.log(
    `Trouvé ${photos.length} photo${photos.length > 1 ? 's' : ''} dans Sanity :`
  );
  for (const p of photos) {
    console.log(`  - ${p._id}  ${p.title}`);
  }

  if (!confirmed) {
    console.log(
      '\nDry-run : aucune suppression effectuée.\n' +
        'Pour exécuter réellement la suppression :\n' +
        '  npm run wipe-photos -- --yes\n' +
        '  npm run wipe-photos -- --yes --keep-assets   (conserve les fichiers binaires)'
    );
    return;
  }

  console.log(
    `\nSuppression de ${photos.length} document${photos.length > 1 ? 's' : ''}…`
  );

  let tx = client.transaction();
  for (const p of photos) tx = tx.delete(p._id);
  await tx.commit();
  console.log(`✓ ${photos.length} documents supprimés.`);

  if (keepAssets) {
    console.log(
      'Assets binaires conservés (--keep-assets). Pour les nettoyer manuellement :\n' +
        '  /studio → Gestion fichiers (ou via API).'
    );
    return;
  }

  // Récupérer les assets uniques référencés et les supprimer
  const assetIds = Array.from(
    new Set(photos.map((p) => p.image?.asset?._ref).filter(Boolean) as string[])
  );

  if (assetIds.length === 0) {
    console.log('Aucun asset à supprimer.');
    return;
  }

  console.log(`Suppression de ${assetIds.length} asset${assetIds.length > 1 ? 's' : ''} image…`);
  let failed = 0;
  for (const id of assetIds) {
    try {
      await client.delete(id);
    } catch {
      failed++;
    }
  }
  console.log(
    `✓ ${assetIds.length - failed} asset${assetIds.length - failed > 1 ? 's' : ''} supprimé${assetIds.length - failed > 1 ? 's' : ''}.` +
      (failed > 0
        ? ` ${failed} ignoré${failed > 1 ? 's' : ''} (probablement déjà référencé ailleurs).`
        : '')
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
