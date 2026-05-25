/**
 * Upload bulk des photos du dossier ./portfolio vers Sanity.
 *
 * Usage :
 *   1. Créer un token "Editor" sur https://www.sanity.io/manage/project/<projectId>/api → Tokens
 *   2. Coller dans .env.local → SANITY_API_WRITE_TOKEN=skXXXX
 *   3. `npm run upload-photos`
 *
 * Le script est idempotent : chaque photo a un _id déterministe basé sur le nom
 * de fichier. Re-lancer skip les photos déjà importées.
 *
 * Métadonnées appliquées par défaut (modifiables dans Studio après import) :
 *   - title : « Paris 12 » (depuis nom de fichier)
 *   - category : streetphotography
 *   - location : Paris, France
 *   - year + dateTaken : depuis EXIF si dispo, sinon année courante
 *   - onHomepage : true pour les 6 premières, false sinon
 *   - order : index dans la liste (tri alpha-numérique)
 *   - parallaxSpeed : alterne 0.05 / 0.1 / 0.15 / -0.05 / -0.1 pour varier le mouvement
 */

import { createClient } from '@sanity/client';
import exifr from 'exifr';
import fs from 'node:fs/promises';
import path from 'node:path';

// Les variables d'environnement sont chargées via le flag tsx --env-file=.env.local
// (cf. script "upload-photos" dans package.json).

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;

if (!PROJECT_ID) {
  console.error('✗ NEXT_PUBLIC_SANITY_PROJECT_ID manquant dans .env.local');
  process.exit(1);
}
if (!WRITE_TOKEN) {
  console.error(
    '✗ SANITY_API_WRITE_TOKEN manquant. Génère un token "Editor" sur :\n' +
      `  https://www.sanity.io/manage/project/${PROJECT_ID}/api`
  );
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN,
  useCdn: false,
});

const PORTFOLIO_DIR = path.resolve(process.cwd(), 'portfolio');
const PARALLAX_PATTERN = [0.1, -0.05, 0.15, -0.1, 0.05, 0.12];

function titleFromFilename(base: string): string {
  return base
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function readDateTaken(
  filepath: string
): Promise<{ dateTaken?: string; year: number }> {
  const fallbackYear = new Date().getFullYear();
  try {
    const exif = await exifr.parse(filepath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateCreated'],
    });
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateCreated;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      // Filtre les dates aberrantes (1970, futur)
      const year = raw.getFullYear();
      if (year >= 1990 && year <= fallbackYear + 1) {
        return {
          dateTaken: raw.toISOString().slice(0, 10),
          year,
        };
      }
    }
  } catch {
    // EXIF illisible → fallback
  }
  return { year: fallbackYear };
}

async function uploadOne(
  filename: string,
  index: number,
  total: number
): Promise<void> {
  const filepath = path.join(PORTFOLIO_DIR, filename);
  const base = path.basename(filename, path.extname(filename));
  const slug = base.toLowerCase();
  const docId = `photo-${slug}`;

  const existing = await client.getDocument(docId).catch(() => null);
  if (existing) {
    console.log(`[${index + 1}/${total}] skip ${filename} (déjà importé)`);
    return;
  }

  const { dateTaken, year } = await readDateTaken(filepath);
  const title = titleFromFilename(base);

  console.log(`[${index + 1}/${total}] upload ${filename}…`);
  const buffer = await fs.readFile(filepath);
  const ext = path.extname(filename).slice(1).toLowerCase();
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const asset = await client.assets.upload('image', buffer, {
    filename,
    contentType,
  });

  await client.createOrReplace({
    _id: docId,
    _type: 'photo',
    title,
    slug: { _type: 'slug', current: slug },
    image: {
      _type: 'image',
      asset: { _type: 'reference', _ref: asset._id },
      alt: title,
    },
    category: 'streetphotography',
    year,
    location: 'Paris, France',
    ...(dateTaken ? { dateTaken } : {}),
    onHomepage: index < 6,
    order: index + 1,
    parallaxSpeed: PARALLAX_PATTERN[index % PARALLAX_PATTERN.length],
  });

  console.log(`        → ${docId} (${title}, ${year})`);
}

async function main(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(PORTFOLIO_DIR);
  } catch {
    console.error(`✗ Dossier introuvable : ${PORTFOLIO_DIR}`);
    process.exit(1);
  }

  // Fichiers exclus de l'upload bulk (utilisés par d'autres scripts ou rôles dédiés)
  const RESERVED_FILES = new Set(['photo-profile.jpg', 'photo-profile.jpeg', 'photo-profile.png']);

  const files = entries
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !RESERVED_FILES.has(f.toLowerCase()))
    .sort((a, b) => {
      // Tri "naturel" : paris-2.jpg avant paris-10.jpg
      const numA = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
      if (numA && numB) return numA - numB;
      return a.localeCompare(b);
    });

  if (files.length === 0) {
    console.log('Aucune photo trouvée dans portfolio/.');
    return;
  }

  console.log(`Démarrage upload ${files.length} photo${files.length > 1 ? 's' : ''} vers Sanity (projet ${PROJECT_ID}, dataset ${DATASET}).\n`);

  for (const [index, filename] of files.entries()) {
    try {
      await uploadOne(filename, index, files.length);
    } catch (err) {
      console.error(
        `✗ Échec ${filename} :`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log('\n✓ Terminé.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
