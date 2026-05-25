/**
 * Upload `portfolio/photo-profile.jpg` vers Sanity et le rattache à
 * `siteSettings.profileImage` (utilisé par le hero de la home).
 *
 * Usage : `npm run set-profile`
 *
 * Idempotent : si le doc siteSettings n'existe pas, il est créé. Si profileImage
 * existait déjà, il est remplacé.
 */

import { createClient } from '@sanity/client';
import fs from 'node:fs/promises';
import path from 'node:path';

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

const FILE_PATH = path.resolve(process.cwd(), 'portfolio/photo-profile.jpg');

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN,
  useCdn: false,
});

async function main(): Promise<void> {
  try {
    await fs.access(FILE_PATH);
  } catch {
    console.error(`✗ Fichier introuvable : ${FILE_PATH}`);
    process.exit(1);
  }

  console.log('Upload de portfolio/photo-profile.jpg vers Sanity…');
  const buffer = await fs.readFile(FILE_PATH);
  const asset = await client.assets.upload('image', buffer, {
    filename: 'photo-profile.jpg',
    contentType: 'image/jpeg',
  });

  console.log(`✓ Asset uploadé : ${asset._id}`);

  const profileImage = {
    _type: 'image' as const,
    asset: { _type: 'reference' as const, _ref: asset._id },
    alt: 'A. Matencio — portrait',
  };

  // S'assure que le doc existe (createIfNotExists conserve les fields existants),
  // puis patch uniquement profileImage — les autres champs (motion, textes…) restent intacts.
  await client.createIfNotExists({ _id: 'siteSettings', _type: 'siteSettings' });
  await client.patch('siteSettings').set({ profileImage }).commit();

  console.log('✓ siteSettings.profileImage mis à jour.');
  console.log('\nRecharge la home pour voir la photo (Cmd+Shift+R).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
