/**
 * Préparation des images avant dépôt dans Sanity : sondage HDR / gamut,
 * décodage (avec repli système), plafond de résolution, plafond de poids.
 *
 * ── Pourquoi ce module existe ────────────────────────────────────────────────
 *
 * Le CDN de Sanity RÉ-ENCODE tout ce qu'il sert, y compris à l'URL dite
 * « originale » (mesuré le 2026-08-21 sur un asset du dataset : 2 802 Ko et
 * 3 144 octets d'ICC déposés → 933 Ko servis, ICC à 0, EXIF à 0, chroma 4:4:4
 * dégradé en 4:2:0 ; `?dl=`, `?q=100` et `?w=100000` ré-encodent aussi). Il
 * n'existe donc AUCUNE adresse qui rende les octets déposés.
 *
 * Conséquence directe : une gain map HDR (segment APP2/MPF) ou un fichier
 * PQ/HLG 10 bits ne peut pas survivre au trajet. Le HDR n'est pas « dégradé »
 * en chemin, il est supprimé. Ce module ne prétend donc pas le préserver — il
 * fait l'inverse, proprement : il le DÉTECTE, l'aplatit avec un vrai rendu SDR,
 * et le DIT dans le rapport d'import plutôt que de livrer une image ternie sans
 * le moindre signal.
 *
 * L'outillage ne permettrait de toute façon pas mieux : `sharp` 0.34 / libvips
 * 8.17 refuse explicitement le 10 bits en sortie (« Expected 8 for bitdepth
 * when using prebuilt binaries ») et ne sait ni lire ni écrire de gain map.
 *
 * ── Critères d'export pour Alexandre ─────────────────────────────────────────
 *
 * Puisque tout finit en SDR 8 bits, exporter en HDR depuis Lightroom n'apporte
 * RIEN au site (et alourdit le master). Export recommandé : sRGB 8 bits, grand
 * côté ≥ 2048 px, qualité maximale — ce script se charge du reste. Un export
 * HDR ou Display P3 fonctionne quand même, il est juste converti ici.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ── Plafonds ─────────────────────────────────────────────────────────────────
//
// 2048 px sur le grand côté : remplit n'importe quelle lightbox, y compris sur
// écran retina, mais ne fait qu'un tirage de 17 × 11 cm à 300 dpi —
// inexploitable en impression. Décidé avec Alexandre le 2026-08-21.
//
// C'est la seule protection réelle du travail : plafonner les URLs côté site ne
// sert à rien tant que l'asset stocké est en 6000 px, puisqu'il suffit de
// retirer le `?w=` pour récupérer une image pleine résolution.
export const MAX_EDGE = 2048;

// 400 Ko après optimisation (CLAUDE.md §3.5). Ce n'est pas un vœu : à qualité
// FIXE 82, un fichier du portfolio actuel sortait à 499 Ko (russia-july-18) et
// deux autres au-dessus de 400. L'échelle descendante ci-dessous le ramène à
// 389 Ko en q=76 — un seul fichier sur 22 quitte le palier haut, donc le coût
// en qualité est payé là où il est dû, pas sur tout le lot.
export const MAX_BYTES = 400 * 1024;
export const QUALITY_LADDER = [82, 80, 78, 76, 74, 72, 70] as const;

/** Extensions acceptées dans `portfolio/`. */
export const SUPPORTED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'heic',
  'heif',
  'tif',
  'tiff',
] as const;

export const SUPPORTED_PATTERN = new RegExp(
  `\\.(${SUPPORTED_EXTENSIONS.join('|')})$`,
  'i'
);

// ── Sondage HDR / gamut ──────────────────────────────────────────────────────

export type HdrKind = 'sdr' | 'gain-map' | 'pq' | 'hlg';

export type ImageProbe = {
  hdr: HdrKind;
  /** Description du profil ICC quand ce n'est pas du sRGB (sinon `null`). */
  wideGamut: string | null;
  /** Ce que le fichier perd en entrant dans Sanity, en clair. */
  losses: string[];
};

/**
 * Lit la description d'un profil ICC. Gère les DEUX encodages du tag `desc` :
 * `desc` (ICC v2, ASCII) et `mluc` (ICC v4, UTF-16BE). Un profil Display P3
 * système est en v4 — ne gérer que le v2 renverrait « profil inconnu » sur le
 * cas le plus courant.
 */
function iccDescription(icc: Buffer | undefined): string | null {
  if (!icc || icc.length < 132) return null;
  try {
    const tagCount = icc.readUInt32BE(128);
    for (let i = 0; i < tagCount; i++) {
      const entry = 132 + i * 12;
      if (icc.slice(entry, entry + 4).toString('latin1') !== 'desc') continue;
      const offset = icc.readUInt32BE(entry + 4);
      const size = icc.readUInt32BE(entry + 8);
      const tag = icc.slice(offset, offset + size);
      const type = tag.slice(0, 4).toString('latin1');

      if (type === 'desc') {
        const len = tag.readUInt32BE(8);
        return tag.slice(12, 12 + len).toString('latin1').replace(/\0+$/, '').trim();
      }
      if (type === 'mluc') {
        const len = tag.readUInt32BE(20);
        const off = tag.readUInt32BE(24);
        return tag.slice(off, off + len).swap16().toString('utf16le').trim();
      }
      return null;
    }
  } catch {
    // Profil mal formé : on ne bloque rien pour ça.
  }
  return null;
}

/**
 * Cherche la boîte `colr`/`nclx` d'un conteneur ISOBMFF (AVIF, HEIF) et en lit
 * la fonction de transfert. Disposition : 'colr' 'nclx' primaries(2)
 * transfer(2) matrix(2) range(1). Valeurs qui nous intéressent — 16 = PQ
 * (SMPTE ST 2084), 18 = HLG (ARIB STD-B67).
 */
function transferCharacteristics(buffer: Buffer): number | null {
  const at = buffer.indexOf('colrnclx', 0, 'latin1');
  if (at < 0 || at + 12 > buffer.length) return null;
  return buffer.readUInt16BE(at + 10);
}

/**
 * Détecte le HDR sans dépendance externe.
 *
 * Une gain map se signale par son XMP, jamais par le seul marqueur MPF : celui-ci
 * sert AUSSI aux vignettes et aux paires stéréo, il produirait des faux positifs
 * sur des JPEG parfaitement SDR. On ne se fie donc qu'aux deux namespaces qui
 * ne veulent dire que « gain map » : celui d'Adobe/Google (`hdrgm:`) et l'URN
 * ISO 21496-1 (Ultra HDR standardisé).
 */
export function probeImage(
  buffer: Buffer,
  meta: { icc?: Buffer; depth?: string; space?: string }
): ImageProbe {
  const losses: string[] = [];

  let hdr: HdrKind = 'sdr';
  if (
    buffer.indexOf('urn:iso:std:iso:ts:21496:-1', 0, 'latin1') >= 0 ||
    buffer.indexOf('hdrgm:', 0, 'latin1') >= 0
  ) {
    hdr = 'gain-map';
  } else {
    const transfer = transferCharacteristics(buffer);
    if (transfer === 16) hdr = 'pq';
    else if (transfer === 18) hdr = 'hlg';
  }

  const desc = iccDescription(meta.icc);
  const wideGamut =
    desc && !/s\s*rgb/i.test(desc) && !/^gray/i.test(desc) ? desc : null;

  if (hdr === 'gain-map') {
    losses.push(
      'gain map HDR ignorée (seule l’image SDR de base est reprise) — ' +
        'le CDN Sanity la supprimerait de toute façon'
    );
  }
  if (hdr === 'pq' || hdr === 'hlg') {
    losses.push(
      `HDR ${hdr.toUpperCase()} aplati en SDR — sans cette conversion l’image ` +
        'sortirait sombre et délavée (la courbe PQ/HLG relue comme du sRGB)'
    );
  }
  if (wideGamut) {
    losses.push(
      `profil « ${wideGamut} » converti en sRGB — les couleurs hors gamut sont écrêtées`
    );
  }
  if (meta.depth && meta.depth !== 'uchar') {
    losses.push(`profondeur ${meta.depth} ramenée à 8 bits par canal`);
  }

  return { hdr, wideGamut, losses };
}

// ── Décodage ─────────────────────────────────────────────────────────────────

/**
 * `sharp` lit l'EN-TÊTE d'un `.heic` (dimensions correctes !) mais ne sait pas
 * en décoder les pixels : les binaires prébuilts n'embarquent pas de décodeur
 * HEVC. L'erreur ne tombe donc qu'au moment du rendu — « Support for this
 * compression format has not been built in ». Vérifié le 2026-08-21.
 *
 * Repli macOS : `sips` passe par ColorSync, qui décode le HEVC ET applique le
 * rendu HDR → SDR du système. On sort en PNG (sans perte) : le fichier est
 * gros mais temporaire, et on évite une génération de compression avant le
 * redimensionnement.
 *
 * ⚠️ Le rendu ColorSync d'un master PQ authentique n'a pas pu être vérifié
 * faute de fichier PQ sous la main (aucun encodeur HDR installé). Si un tel
 * fichier arrive un jour, comparer visuellement avant de faire confiance.
 */
async function decodeViaSystem(filepath: string): Promise<Buffer> {
  if (process.platform !== 'darwin') {
    throw new Error(
      `${path.basename(filepath)} : format non décodable par sharp, et le repli ` +
        '`sips` n’existe que sur macOS. Convertis le fichier en JPEG avant import.'
    );
  }
  const tmp = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), 'amatencio-')),
    'decoded.png'
  );
  try {
    await execFileAsync('sips', ['-s', 'format', 'png', filepath, '--out', tmp]);
    return await fs.readFile(tmp);
  } catch (err) {
    throw new Error(
      `${path.basename(filepath)} : ni sharp ni sips ne savent lire ce fichier ` +
        `(${err instanceof Error ? err.message.split('\n')[0] : err}).`
    );
  } finally {
    await fs.rm(path.dirname(tmp), { recursive: true, force: true });
  }
}

// ── Préparation ──────────────────────────────────────────────────────────────

export type PreparedImage = {
  buffer: Buffer;
  /** Extension et type MIME du fichier RÉELLEMENT déposé (≠ source si converti). */
  ext: string;
  contentType: string;
  quality: number | null;
  systemDecoded: boolean;
  probe: ImageProbe;
  from: { w: number; h: number; bytes: number };
  to: { w: number; h: number; bytes: number };
};

/**
 * Format de sortie. Un HEIC/AVIF/TIFF n'a pas de place sur le web : il repart en
 * JPEG.
 *
 * Un PNG SANS canal alpha aussi : le PNG n'a pas de curseur de qualité, une
 * photo y pèse plusieurs centaines de Ko qu'aucun réglage ne peut ramener sous
 * le plafond (mesuré : 844 Ko à 2048 px pour un simple dégradé). Le garder
 * serait accepter un asset hors budget pour rien — sur une photographie, le
 * PNG n'apporte aucune qualité visible que le JPEG à q=82 ne rende déjà.
 * Un PNG AVEC alpha est conservé : la transparence, elle, se perdrait vraiment.
 */
function outputFormat(ext: string, hasAlpha: boolean): 'png' | 'webp' | 'jpeg' {
  if (ext === 'png') return hasAlpha ? 'png' : 'jpeg';
  if (ext === 'webp') return 'webp';
  return 'jpeg';
}

/**
 * Réduit une image pour le web et rend compte de l'opération.
 *
 * `.rotate()` sans argument applique l'orientation EXIF aux PIXELS. Indispensable
 * ici : Sanity supprime les métadonnées du fichier qu'il sert (vérifié au niveau
 * des octets, y compris à l'URL de l'original), donc une image portrait qui
 * compterait sur son drapeau d'orientation arriverait couchée sur le site.
 *
 * `withIccProfile('srgb')` est un garde-fou COULEUR, pas une coquetterie : il
 * déclenche une VRAIE conversion colorimétrique (vérifié avec le profil Display
 * P3 système — le rouge P3 pur ressort écrêté à 254,0,0 et tagué sRGB, et non
 * ré-étiqueté à l'identique). Sans lui, un export AdobeRGB ou ProPhoto serait
 * relu comme du sRGB et virerait au terne, sans le moindre signal.
 */
export async function prepareForWeb(
  filepath: string,
  source: Buffer
): Promise<PreparedImage> {
  const { default: sharp } = await import('sharp');
  const ext = path.extname(filepath).slice(1).toLowerCase();

  const header = await sharp(source).metadata();
  const probe = probeImage(source, header);

  // Sonde de décodage : l'en-tête peut être lisible et les pixels non (HEVC).
  // On ne paie ce test que sur les conteneurs concernés.
  let decodable = source;
  let systemDecoded = false;
  if (header.format === 'heif' || ext === 'heic' || ext === 'heif') {
    try {
      await sharp(source).resize(8, 8).raw().toBuffer();
    } catch {
      decodable = await decodeViaSystem(filepath);
      systemDecoded = true;
    }
  }

  const base = () =>
    sharp(decodable)
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        // `inside` + les deux côtés à la même valeur = le GRAND côté est
        // plafonné, quelle que soit l'orientation. `withoutEnlargement` pour ne
        // jamais gonfler une petite image (un agrandissement n'ajoute aucun
        // détail et alourdirait le fichier pour rien).
        fit: 'inside',
        withoutEnlargement: true,
      });

  const format = outputFormat(ext, header.hasAlpha === true);
  let out: Buffer;
  let quality: number | null = null;

  if (format === 'png') {
    // Un PNG n'a pas de curseur de qualité : il tient son poids ou pas.
    out = await base().png({ compressionLevel: 9 }).withIccProfile('srgb').toBuffer();
  } else {
    // Échelle descendante : on s'arrête au PREMIER palier qui passe sous le
    // plafond, pour ne jamais dégrader plus que nécessaire. Si même le dernier
    // palier ne suffit pas, on le garde — un import ne se bloque jamais sur un
    // critère esthétique (invariant du pipeline, cf. CLAUDE.md §11.14).
    out = Buffer.alloc(0);
    for (const q of QUALITY_LADDER) {
      const encoded =
        format === 'webp'
          ? base().webp({ quality: q })
          : base().jpeg({ quality: q, mozjpeg: true, progressive: true });
      out = await encoded.withIccProfile('srgb').toBuffer();
      quality = q;
      if (out.length <= MAX_BYTES) break;
    }
  }

  const after = await sharp(out).metadata();
  return {
    buffer: out,
    ext: format === 'jpeg' ? 'jpg' : format,
    contentType: `image/${format === 'jpeg' ? 'jpeg' : format}`,
    quality,
    systemDecoded,
    probe,
    from: {
      w: header.width ?? 0,
      h: header.height ?? 0,
      bytes: source.length,
    },
    to: { w: after.width ?? 0, h: after.height ?? 0, bytes: out.length },
  };
}
