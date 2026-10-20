/**
 * Génère public/og-journal.png (1200 × 630) : la vignette de partage du
 * journal quand une page n'a pas d'image à elle (article sans couverture,
 * accueil, à propos, séries). Le glyphe bleu sur le fond du site.
 *
 *   npm run make-og-journal
 *
 * Marge d'au moins 30 % de chaque côté (demande Alexandre, 2026-10-20), y
 * compris dans le carré central que certaines messageries recadrent : c'est
 * le côté de 630 px qui borne la largeur du glyphe.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const W = 1200;
const H = 630;
const MARGIN = 0.3;
const BG = '#fafaf8'; // --surface-0 (app/globals.css)

const SRC = path.resolve(process.cwd(), 'public/img/logos/glyph-alxmtnc.svg');
const OUT = path.resolve(process.cwd(), 'public/og-journal.png');

async function main(): Promise<void> {
  const { default: sharp } = await import('sharp');
  const svg = await fs.readFile(SRC);
  const box = Math.floor(H * (1 - 2 * MARGIN));
  const glyph = await sharp(svg, { density: 300 })
    .resize(box, box, { fit: 'inside' })
    .png()
    .toBuffer();

  const out = await sharp({ create: { width: W, height: H, channels: 3, background: BG } })
    .composite([{ input: glyph, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.writeFile(OUT, out);
  const { width, height } = await sharp(glyph).metadata();
  console.log(`✓ ${path.relative(process.cwd(), OUT)} — glyphe ${width}×${height} dans ${W}×${H}, ${Math.round(out.length / 1024)} Ko.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
