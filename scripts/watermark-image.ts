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

/** Le papier du site (`--color-bg`), sur lequel une image transparente est vue. */
const PAPER = '#fafaf8';

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Signatures au plus, réparties sur l'axe vertical central. */
const MAX_COPIES = 3;
/** Hauteur réservée à chaque signature, en corps de texte : un schéma bas
 *  (une frise de 223 px) n'en porte qu'une, au lieu de trois serrées. */
const COPY_SPACING = 10;

/**
 * Le calque du filigrane, en SVG, aux dimensions de l'image : trois fois le
 * nom, centré, très espacé, presque transparent. Un premier essai en motif
 * diagonal sur toute la surface rendait le schéma illisible (2026-10-21) —
 * Alexandre veut un filigrane qu'on voit quand on le cherche, pas avant.
 */
export function watermarkSvg(width: number, height: number, ink: '#000' | '#fff' = '#000'): string {
  const text = xmlEscape(WATERMARK_TEXT);
  const font = Math.round(Math.max(14, width * 0.016));
  const copies = Math.max(1, Math.min(MAX_COPIES, Math.floor(height / (font * COPY_SPACING))));
  const lines = Array.from({ length: copies }, (_, i) => {
    const y = Math.round((height * (i + 1)) / (copies + 1));
    return `<text x="${width / 2}" y="${y}">${text}</text>`;
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<g font-family="Helvetica, Arial, sans-serif" font-size="${font}"` +
    ` text-anchor="middle" fill="${ink}" fill-opacity="${ink === '#000' ? 0.09 : 0.08}">${lines.join('')}</g>` +
    `</svg>`
  );
}

export async function watermark(input: string, output: string): Promise<void> {
  const image = sharp(input);
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error(`Dimensions illisibles : ${input}`);
  // Encre selon le fond : noir sur un schéma clair, blanc sur une maquette
  // sombre — le noir y disparaîtrait tout à fait. Mesuré sur le papier du
  // site : un PNG transparent sans alpha se lirait noir. `stats()` lit
  // l'image d'ENTRÉE, pas le pipeline : on aplatit d'abord dans un buffer.
  const flat = await sharp(input).flatten({ background: PAPER }).toBuffer();
  const { channels } = await sharp(flat).stats();
  const mean = channels.slice(0, 3).reduce((sum, c) => sum + c.mean, 0) / 3;
  const ink = mean < 128 ? '#fff' : '#000';
  await image
    .composite([{ input: Buffer.from(watermarkSvg(width, height, ink)), top: 0, left: 0 }])
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
