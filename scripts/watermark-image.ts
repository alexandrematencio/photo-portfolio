/**
 * Filigrane visible sur une image du journal (schéma, graphique) : la
 * signature « © Alexandre Xavier Matencio » répétée en diagonale sur TOUTE
 * l'image, plus une signature nette dans le coin bas gauche.
 *
 * Pourquoi en diagonale sur toute la surface (2026-10-21, demande
 * d'Alexandre) : une signature dans un coin se recadre en une seconde. Le
 * motif répété traverse les cases, les flèches et le texte du schéma — on ne
 * peut pas l'enlever sans redessiner le schéma. Il reste assez léger pour que
 * le schéma se lise.
 *
 * Les métadonnées de droits (scripts/image-rights.ts) sont écrites aussi,
 * mais le CDN de Sanity les efface à la livraison : le filigrane est la seule
 * signature qui atteint le lecteur.
 *
 * Usage :
 *   npx tsx scripts/watermark-image.ts <entrée.png> <sortie.png>
 */

import sharp from 'sharp';
import { exifRights, xmpRights } from './image-rights';

/** Le nom complet, voulu par Alexandre sur le filigrane (AUTHOR_NAME reste
 *  « Alexandre Matencio » pour les données structurées). */
export const WATERMARK_TEXT = '© Alexandre Xavier Matencio';

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Le calque du filigrane, en SVG, aux dimensions de l'image. */
export function watermarkSvg(width: number, height: number): string {
  const text = xmlEscape(WATERMARK_TEXT);
  const font = Math.round(Math.max(18, width * 0.022));
  // Pas du motif : une ligne de texte et un blanc, en quinconce.
  const stepX = Math.round(font * 17);
  const stepY = Math.round(font * 5.5);
  const diag = Math.ceil(Math.hypot(width, height));
  const rows: string[] = [];
  for (let y = -diag, row = 0; y < diag; y += stepY, row++) {
    const offset = row % 2 ? stepX / 2 : 0;
    for (let x = -diag + offset; x < diag; x += stepX) {
      rows.push(`<text x="${x}" y="${y}">${text}</text>`);
    }
  }
  const corner = Math.round(font * 1.05);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<g transform="translate(${width / 2} ${height / 2}) rotate(-30)"` +
    ` font-family="Helvetica, Arial, sans-serif" font-size="${font}" font-weight="600"` +
    ` fill="#5a2a82" fill-opacity="0.13">${rows.join('')}</g>` +
    `<text x="${corner}" y="${height - corner}" font-family="Helvetica, Arial, sans-serif"` +
    ` font-size="${corner}" font-weight="600" fill="#000" fill-opacity="0.6">${text}</text>` +
    `</svg>`
  );
}

export async function watermark(input: string, output: string): Promise<void> {
  const image = sharp(input);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error(`Dimensions illisibles : ${input}`);
  await image
    .composite([{ input: Buffer.from(watermarkSvg(width, height)), top: 0, left: 0 }])
    .withExif(exifRights())
    .withXmp(xmpRights())
    .png({ compressionLevel: 9 })
    .toFile(output);
}

if (process.argv[1]?.endsWith('watermark-image.ts')) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage : npx tsx scripts/watermark-image.ts <entrée> <sortie>');
    process.exit(1);
  }
  watermark(input, output).then(
    () => console.log(`✓ ${output}`),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
