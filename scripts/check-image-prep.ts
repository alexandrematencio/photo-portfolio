/**
 * Assertions sur `prepare-image.ts` — sondage HDR / gamut, décodage, plafonds.
 *
 *   npm run check-image-prep
 *
 * Hors ligne et auto-suffisant : les cas de test sont FABRIQUÉS ici (aucune
 * dépendance à `portfolio/`, qui est gitignoré). À relancer après toute
 * modification des règles de détection ou des plafonds.
 *
 * Pourquoi un check permanent alors que §7.4 dit « pas de tests sans signal de
 * besoin » : la détection HDR lit des octets à la main (namespaces XMP, boîte
 * `colr`/`nclx` d'un conteneur ISOBMFF). Une erreur d'offset d'un octet ne
 * casse rien de visible — elle rend juste la détection muette, et on aplatit du
 * HDR sans le dire. C'est exactement le genre de panne qu'aucun rendu ne
 * signale. Même justification que `check-parser`.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { MAX_BYTES, MAX_EDGE, prepareForWeb, probeImage } from './prepare-image';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'check-image-prep-'));
const P3_PROFILE = '/System/Library/ColorSync/Profiles/Display P3.icc';

let failures = 0;
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '✓' : '✗'} ${label.padEnd(46)} ${detail}`);
  if (!ok) failures++;
}

/** PRNG déterministe : un banc qui varie d'un run à l'autre ne prouve rien. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bruit fin : incompressible, sert à forcer la descente de l'échelle de qualité. */
function noise(w: number, h: number): Buffer {
  const rand = mulberry32(42);
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (rand() * 256) | 0;
  return raw;
}

/** Dégradé lisse : très compressible, doit rester au palier de qualité haut. */
function gradient(w: number, h: number): Buffer {
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      raw[i] = (x / w) * 255;
      raw[i + 1] = (y / h) * 255;
      raw[i + 2] = 128;
    }
  }
  return raw;
}

/** Boîte `colr`/`nclx` d'un conteneur ISOBMFF, avec la fonction de transfert voulue. */
function nclxBox(transfer: number): Buffer {
  const b = Buffer.alloc(15);
  b.write('colrnclx', 0, 'latin1');
  b.writeUInt16BE(9, 8); // primaries Rec.2020
  b.writeUInt16BE(transfer, 10);
  b.writeUInt16BE(9, 12); // matrix
  return b;
}

const file = (name: string) => path.join(DIR, name);
const write = (name: string, buf: Buffer) => (fs.writeFileSync(file(name), buf), file(name));
const prep = (name: string) => prepareForWeb(file(name), fs.readFileSync(file(name)));
const probe = async (name: string) => {
  const buf = fs.readFileSync(file(name));
  return probeImage(buf, await sharp(buf).metadata());
};

async function main(): Promise<void> {
  const big = { raw: { width: 3000, height: 2000, channels: 3 as const } };

  const smooth = await sharp(gradient(3000, 2000), big).jpeg({ quality: 95 }).toBuffer();
  const rough = await sharp(noise(3000, 2000), big).jpeg({ quality: 98 }).toBuffer();
  write('smooth.jpg', smooth);
  write('rough.jpg', rough);

  // Les marqueurs HDR sont cherchés dans les octets bruts : les coller en queue
  // de fichier suffit à éprouver le détecteur, et l'image reste décodable.
  write('gainmap-adobe.jpg', Buffer.concat([smooth, Buffer.from('hdrgm:Version="1.0"', 'latin1')]));
  write('gainmap-iso.jpg', Buffer.concat([smooth, Buffer.from('urn:iso:std:iso:ts:21496:-1', 'latin1')]));
  write('pq.jpg', Buffer.concat([smooth, nclxBox(16)]));
  write('hlg.jpg', Buffer.concat([smooth, nclxBox(18)]));
  write('bt709.jpg', Buffer.concat([smooth, nclxBox(1)]));

  await sharp(smooth).withIccProfile(P3_PROFILE).jpeg({ quality: 95 }).toFile(file('p3.jpg'));
  await sharp(smooth).avif({ quality: 60 }).toFile(file('shot.avif'));
  await sharp(smooth).png().toFile(file('flat.png'));
  await sharp(smooth).ensureAlpha(0.5).png().toFile(file('alpha.png'));
  await sharp(smooth).webp({ quality: 90 }).toFile(file('shot.webp'));

  console.log('── Sondage ──');
  check('SDR non signalé HDR', (await probe('smooth.jpg')).hdr === 'sdr');
  check('SDR sans faux positif de gamut', (await probe('smooth.jpg')).wideGamut === null, 'sRGB');
  check('Rec.709 non pris pour du HDR', (await probe('bt709.jpg')).hdr === 'sdr', 'transfer=1');
  check('gain map Adobe/Google détectée', (await probe('gainmap-adobe.jpg')).hdr === 'gain-map', 'hdrgm:');
  check('gain map ISO 21496-1 détectée', (await probe('gainmap-iso.jpg')).hdr === 'gain-map', 'urn ISO');
  check('PQ détecté', (await probe('pq.jpg')).hdr === 'pq', 'transfer=16');
  check('HLG détecté', (await probe('hlg.jpg')).hdr === 'hlg', 'transfer=18');

  const p3 = await probe('p3.jpg');
  check('Display P3 lu dans un ICC v4', /display p3/i.test(p3.wideGamut ?? ''), p3.wideGamut ?? '(aucun)');
  check('la perte de gamut est annoncée', p3.losses.some((l) => /écrêt/.test(l)), `${p3.losses.length} perte(s)`);
  check('la perte HDR est annoncée', (await probe('pq.jpg')).losses.some((l) => /HDR PQ/.test(l)));

  // Le pipeline convertit VRAIMENT les couleurs, il ne ré-étiquette pas : un
  // rouge pur Display P3 est hors du gamut sRGB, il doit ressortir écrêté.
  const p3red = Buffer.alloc(64 * 64 * 3);
  for (let i = 0; i < 64 * 64; i++) p3red[i * 3] = 255;
  await sharp(p3red, { raw: { width: 64, height: 64, channels: 3 } })
    .withIccProfile(P3_PROFILE)
    .jpeg({ quality: 100 })
    .toFile(file('p3red.jpg'));
  const converted = await prep('p3red.jpg');
  const px = await sharp(converted.buffer).raw().toBuffer();
  check('conversion colorimétrique réelle', px[0]! > 250 && px[1]! < 6 && px[2]! < 6, `rgb(${px[0]},${px[1]},${px[2]})`);

  console.log('\n── Préparation ──');
  const cases = ['smooth.jpg', 'rough.jpg', 'p3.jpg', 'shot.avif', 'shot.webp', 'flat.png', 'alpha.png', 'pq.jpg'];
  for (const name of cases) {
    const r = await prep(name);
    console.log(
      `  ${name.padEnd(18)} ${`${r.from.w}×${r.from.h}`.padEnd(10)} → ${`${r.to.w}×${r.to.h}`.padEnd(10)}` +
        ` ${String(Math.round(r.to.bytes / 1024)).padStart(5)} Ko  q=${r.quality ?? '—'}  .${r.ext}`
    );
    check(`  ${name} : grand côté plafonné`, r.to.w > 0 && Math.max(r.to.w, r.to.h) <= MAX_EDGE, `${r.to.w}×${r.to.h}`);
    // 4×4 pixels × le nombre de canaux réels — un PNG à alpha en a 4, pas 3.
    const channels = (await sharp(r.buffer).metadata()).channels ?? 3;
    const decoded = await sharp(r.buffer).resize(4, 4).raw().toBuffer();
    check(`  ${name} : sortie décodable`, decoded.length === 16 * channels, `${channels} canaux`);
  }

  check('dégradé : reste au palier haut', (await prep('smooth.jpg')).quality === 82, 'q=82');
  const noisy = await prep('rough.jpg');
  check('bruit : l’échelle de qualité descend', (noisy.quality ?? 82) < 82, `q=${noisy.quality}`);
  check('dégradé : sous le plafond de poids', (await prep('smooth.jpg')).to.bytes <= MAX_BYTES, `${MAX_BYTES / 1024} Ko`);
  check('PNG opaque bascule en JPEG', (await prep('flat.png')).ext === 'jpg', 'hors budget en PNG');
  const alpha = await prep('alpha.png');
  check('PNG à transparence reste PNG', alpha.ext === 'png' && alpha.quality === null, 'alpha préservé');
  check('PNG à transparence garde son alpha', (await sharp(alpha.buffer).metadata()).hasAlpha === true);
  check('WebP reste WebP', (await prep('shot.webp')).ext === 'webp');
  check('AVIF ressort en JPEG', (await prep('shot.avif')).ext === 'jpg', 'pas de place sur le web');
  check('AVIF décodé sans repli système', !(await prep('shot.avif')).systemDecoded, 'sharp seul');

  // HEIC/HEVC : `sharp` en lit l'EN-TÊTE mais ne peut pas en décoder les pixels
  // (pas de décodeur HEVC dans les binaires prébuilts). Le repli `sips` doit
  // prendre le relais. Cas fabriqué par sips lui-même → macOS uniquement.
  let heicMade = false;
  if (process.platform === 'darwin') {
    try {
      execFileSync('sips', ['-s', 'format', 'heic', file('smooth.jpg'), '--out', file('phone.heic')], {
        stdio: 'ignore',
      });
      heicMade = fs.existsSync(file('phone.heic'));
    } catch {
      heicMade = false;
    }
  }
  if (heicMade) {
    let sharpAlone = true;
    try {
      await sharp(fs.readFileSync(file('phone.heic'))).resize(8, 8).raw().toBuffer();
    } catch {
      sharpAlone = false;
    }
    const heic = await prep('phone.heic');
    console.log(
      `  ${'phone.heic'.padEnd(18)} ${`${heic.from.w}×${heic.from.h}`.padEnd(10)} → ` +
        `${`${heic.to.w}×${heic.to.h}`.padEnd(10)} ${String(Math.round(heic.to.bytes / 1024)).padStart(5)} Ko` +
        `  .${heic.ext}  ${heic.systemDecoded ? '[sips]' : '[sharp]'}`
    );
    check('HEIC : repli système si sharp ne décode pas', heic.systemDecoded === !sharpAlone, sharpAlone ? 'sharp a suffi' : 'sips a pris le relais');
    check('HEIC ressort en JPEG', heic.ext === 'jpg' && heic.contentType === 'image/jpeg');
    check('HEIC : grand côté plafonné', Math.max(heic.to.w, heic.to.h) <= MAX_EDGE, `${heic.to.w}×${heic.to.h}`);
  } else {
    console.log('  (cas HEIC ignoré : sips indisponible)');
  }

  // Une petite image ne doit JAMAIS être agrandie.
  await sharp(gradient(800, 600), { raw: { width: 800, height: 600, channels: 3 } })
    .jpeg()
    .toFile(file('small.jpg'));
  const small = await prep('small.jpg');
  check('petite image non agrandie', small.to.w === 800 && small.to.h === 600, `${small.to.w}×${small.to.h}`);

  fs.rmSync(DIR, { recursive: true, force: true });
  console.log(failures === 0 ? '\n✓ Tous les cas passent.' : `\n✗ ${failures} cas en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  fs.rmSync(DIR, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
