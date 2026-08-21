/**
 * Audit read-only : liste les photos qui n'ont pas de série rattachée.
 *
 * Usage :
 *   npm run audit-series
 *
 * Affiche un tableau groupé par style principal puis par année. Utilise SANITY_API_READ_TOKEN
 * (ou pas de token du tout si le dataset est public en lecture).
 */

import { createClient } from '@sanity/client';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const READ_TOKEN = process.env.SANITY_API_READ_TOKEN;

if (!PROJECT_ID) {
  console.error(
    '✗ NEXT_PUBLIC_SANITY_PROJECT_ID manquant dans .env.local.'
  );
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: READ_TOKEN,
  useCdn: false,
});

type PhotoRow = {
  _id: string;
  title: string;
  slug: { current: string };
  styles: string[] | null;
  year: number;
  location: string;
};

async function main(): Promise<void> {
  const photos = await client.fetch<PhotoRow[]>(
    `*[_type == "photo" && (!defined(series) || count(series) == 0)] | order(year desc, _updatedAt desc) {
      _id, title, slug, "styles": styles[]->title, year, location
    }`
  );
  // Groupé par style principal (le premier de la liste), trié côté client.
  photos.sort((a, b) =>
    (a.styles?.[0] ?? '—').localeCompare(b.styles?.[0] ?? '—', 'fr')
  );

  const total = await client.fetch<number>(`count(*[_type == "photo"])`);

  if (photos.length === 0) {
    console.log(`✓ Toutes les photos (${total}) sont rattachées à une série.`);
    return;
  }

  console.log(
    `${photos.length} / ${total} photos sans série :\n`
  );

  let currentStyle = '';
  for (const photo of photos) {
    const mainStyle = photo.styles?.[0] ?? 'sans style';
    if (mainStyle !== currentStyle) {
      currentStyle = mainStyle;
      console.log(`\n— ${currentStyle.toUpperCase()} —`);
    }
    const styleList = photo.styles?.join(', ') ?? '—';
    console.log(
      `  [${photo.year}] ${photo.title} (${photo.location}) [${styleList}] — ${photo.slug.current}`
    );
  }

  console.log(
    `\nPour les rattacher : ouvre /studio → Photos → Sans série, puis édite le champ « Série » sur chaque photo.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
