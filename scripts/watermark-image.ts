/**
 * Filigrane discret sur une image du journal (schéma, graphique) : la
 * signature « © Alexandre Xavier Matencio » trois fois sur l'axe vertical
 * central, très espacée. Au centre plutôt qu'en coin : un coin se recadre en
 * une seconde, le centre d'un schéma non.
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

/** Nombre de signatures, réparties sur l'axe vertical central. */
const COPIES = 3;

/**
 * Le calque du filigrane, en SVG, aux dimensions de l'image : trois fois le
 * nom, centré, très espacé, presque transparent. Un premier essai en motif
 * diagonal sur toute la surface rendait le schéma illisible (2026-10-21) —
 * Alexandre veut un filigrane qu'on voit quand on le cherche, pas avant.
 */
export function watermarkSvg(width: number, height: number): string {
  const text = xmlEscape(WATERMARK_TEXT);
  const font = Math.round(Math.max(14, width * 0.016));
  const lines = Array.from({ length: COPIES }, (_, i) => {
    const y = Math.round((height * (i + 1)) / (COPIES + 1));
    return `<text x="${width / 2}" y="${y}">${text}</text>`;
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<g font-family="Helvetica, Arial, sans-serif" font-size="${font}"` +
    ` text-anchor="middle" fill="#000" fill-opacity="0.09">${lines.join('')}</g>` +
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
