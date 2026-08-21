/**
 * Seed les deux images du hero de la home dans Sanity :
 *   public/img/alex-profile-pic-default.jpg       → siteSettings.hero.defaultImage
 *   public/img/alex-profile-pic-hover-reveal.jpg  → siteSettings.hero.revealImage
 *
 * Sert de migration ponctuelle : depuis que les images du hero sont pilotées
 * par le CMS (et obligatoires, sans fallback bundlé), il faut peupler
 * `siteSettings.hero` AVANT le prochain build de production — sinon le hero
 * s'exporte vide. Lancer une fois après le déploiement du nouveau schéma :
 *
 *   npm run set-hero
 *
 * Idempotent : crée le doc siteSettings s'il n'existe pas, puis remplace
 * uniquement `hero` (les autres champs — motion, textes… — restent intacts).
 * Ré-uploadable à volonté (ré-upload des assets + repatch).
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

const HERO_IMAGES = [
  {
    field: 'defaultImage' as const,
    file: 'public/img/alex-profile-pic-default.jpg',
    filename: 'alex-profile-pic-default.jpg',
    alt: 'Portrait of A. Matencio',
  },
  {
    field: 'revealImage' as const,
    file: 'public/img/alex-profile-pic-hover-reveal.jpg',
    filename: 'alex-profile-pic-hover-reveal.jpg',
    // Image décorative (rendue aria-hidden côté site) → pas d'alt requis.
  },
] satisfies ReadonlyArray<{
  field: 'defaultImage' | 'revealImage';
  file: string;
  filename: string;
  alt?: string;
}>;

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN,
  useCdn: false,
});

async function main(): Promise<void> {
  const hero: Record<string, unknown> = {};

  for (const img of HERO_IMAGES) {
    const filePath = path.resolve(process.cwd(), img.file);
    try {
      await fs.access(filePath);
    } catch {
      console.error(`✗ Fichier introuvable : ${filePath}`);
      process.exit(1);
    }

    console.log(`Upload de ${img.file} vers Sanity…`);
    const buffer = await fs.readFile(filePath);
    const asset = await client.assets.upload('image', buffer, {
      filename: img.filename,
      contentType: 'image/jpeg',
    });
    console.log(`✓ Asset uploadé : ${asset._id}`);

    hero[img.field] = {
      _type: 'image' as const,
      asset: { _type: 'reference' as const, _ref: asset._id },
      ...(img.alt ? { alt: img.alt } : {}),
    };
  }

  await client.createIfNotExists({ _id: 'siteSettings', _type: 'siteSettings' });
  await client.patch('siteSettings').set({ hero }).commit();

  console.log('✓ siteSettings.hero mis à jour (defaultImage + revealImage).');
  console.log('\nRecharge la home pour voir le hero (Cmd+Shift+R).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
