/**
 * Supprime DÉFINITIVEMENT les assets image que plus AUCUN document ne
 * référence — les originaux pleine résolution laissés par downsize-assets.ts,
 * plus les orphelins antérieurs (69 au 2026-09-11).
 *
 *   npm run purge-orphan-assets            → DRY-RUN : liste, n'écrit rien
 *   npm run purge-orphan-assets -- --yes   → supprime
 *
 * IRRÉVERSIBLE. Décidé par Alexandre le 2026-09-11, qui détient les masters
 * (Lightroom). Garde-fou : la requête cherche les références dans TOUS les
 * types de documents, publiés et brouillons (`perspective: 'raw'`), et Sanity
 * refuse de toute façon de supprimer un asset encore référencé — une erreur
 * ici signifie qu'un document le pointe encore, pas qu'il faut forcer.
 */
import { createClient } from '@sanity/client';

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
  perspective: 'raw',
});

type Orphan = { _id: string; originalFilename: string | null; size: number; width: number; height: number };

const ORPHANS_QUERY = `
*[_type == "sanity.imageAsset" && count(*[references(^._id)]) == 0]{
  _id, originalFilename, size, "width": metadata.dimensions.width, "height": metadata.dimensions.height
} | order(size desc)`;

const mo = (b: number) => `${(b / 1024 / 1024).toFixed(1)} Mo`;

async function main(): Promise<void> {
  const orphans = await client.fetch<Orphan[]>(ORPHANS_QUERY);
  const total = orphans.reduce((s, o) => s + o.size, 0);
  console.log(`${orphans.length} asset(s) orphelin(s), ${mo(total)}.\n`);
  for (const o of orphans) {
    console.log(`  ${(o.originalFilename ?? o._id).padEnd(44)} ${`${o.width}×${o.height}`.padEnd(10)} ${mo(o.size).padStart(8)}`);
  }
  if (!APPLY) {
    console.log('\nDry-run terminé. Relance avec --yes pour SUPPRIMER (irréversible).');
    return;
  }
  let done = 0;
  for (const o of orphans) {
    await client.delete(o._id);
    done++;
    if (done % 20 === 0) console.log(`  … ${done}/${orphans.length}`);
  }
  console.log(`\n✓ ${done} asset(s) supprimé(s), ${mo(total)} libérés.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
