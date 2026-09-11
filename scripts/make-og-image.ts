/**
 * Génère public/og-default.jpg (1200 × 630) depuis la PREMIÈRE photo visible
 * de la curation de la home — l'image que les réseaux sociaux affichent quand
 * on partage n'importe quelle page du site. Elle 404 depuis la mise en ligne.
 *
 *   npm run make-og-image
 *
 * Servie par GitHub Pages sans transformation : c'est la SEULE image du site
 * dont la signature EXIF/XMP atteint réellement le visiteur (cf.
 * image-rights.ts). Recadrage : autour du hotspot posé dans le Studio quand il
 * existe, sinon au centre. Relancer quand la curation change de première photo.
 */
import { createClient } from '@sanity/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exifRights, xmpRights } from './image-rights';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';

if (!PROJECT_ID) {
  console.error('✗ NEXT_PUBLIC_SANITY_PROJECT_ID manquant (.env.local).');
  process.exit(1);
}

const OUT = path.resolve(process.cwd(), 'public/og-default.jpg');
const W = 1200;
const H = 630;

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  useCdn: false,
  perspective: 'published',
});

type Pick = {
  title: string;
  year: number | null;
  url: string;
  hotspot: { x: number; y: number } | null;
};

async function main(): Promise<void> {
  const pick = await client.fetch<Pick | null>(
    `(*[_type == "siteSettings"][0].curation[]->)[hidden != true && defined(image.asset)][0]{
      title, year, "url": image.asset->url, "hotspot": image.hotspot{ x, y }
    }`
  );
  if (!pick) {
    console.error('✗ Aucune photo visible dans la curation.');
    process.exit(1);
  }

  // `?w=2048` : jamais l'original — même discipline que le site.
  const res = await fetch(`${pick.url}?w=2048&q=90`);
  if (!res.ok) throw new Error(`Téléchargement : HTTP ${res.status}`);
  const source = Buffer.from(await res.arrayBuffer());

  const { default: sharp } = await import('sharp');
  const meta = await sharp(source).metadata();
  const sw = meta.width ?? 0;
  const sh = meta.height ?? 0;
  const scale = Math.max(W / sw, H / sh);
  const rw = Math.ceil(sw * scale);
  const rh = Math.ceil(sh * scale);
  const hx = pick.hotspot?.x ?? 0.5;
  const hy = pick.hotspot?.y ?? 0.5;
  const left = Math.round(Math.min(Math.max(hx * rw - W / 2, 0), rw - W));
  const top = Math.round(Math.min(Math.max(hy * rh - H / 2, 0), rh - H));

  const out = await sharp(source)
    .resize(rw, rh)
    .extract({ left, top, width: W, height: H })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .withIccProfile('srgb')
    .withExif(exifRights(pick.year ?? undefined))
    .withXmp(xmpRights(pick.year ?? undefined))
    .toBuffer();

  await fs.writeFile(OUT, out);
  console.log(
    `✓ ${path.relative(process.cwd(), OUT)} — « ${pick.title} », ${W}×${H}, ${Math.round(out.length / 1024)} Ko, signée.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
