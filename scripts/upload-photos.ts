/**
 * Upload bulk des photos du dossier ./portfolio vers Sanity.
 *
 * ── Convention de nommage des fichiers ────────────────────────────────────────
 *
 *   Titre -lieu -style[,style2,style3] [-boîtier] [-objectif].jpeg
 *
 *   Exemple :
 *   "Pas de vin à la fête -paris -sp,paysage -Fuji X-PRO2 -MF 35MM f1.4 Meike.jpeg"
 *
 *   - Séparateur de champs : ` -` (espace + tiret). Un tiret collé dans le
 *     titre ("Rendez-vous") ne pose aucun problème.
 *   - Styles : codes courts résolus via les alias des documents `style` dans
 *     Sanity (sp → Street, paysage → Landscape, …). Alias inconnu = fichier
 *     signalé et SKIPPÉ (pas de style fantôme créé).
 *   - Boîtier / objectif : optionnels. Fallback EXIF (Model / LensModel) si
 *     absents du nom. Les objectifs manuels (ex. Meike MF) n'écrivent pas
 *     d'EXIF → les donner dans le nom de fichier. Le nom de fichier GAGNE
 *     sur l'EXIF s'il est renseigné.
 *   - Séries : `-serie:Global Street, Topo` (une ou plusieurs, créées au
 *     besoin) ; sans clé, un jeton dont TOUS les segments sont des séries
 *     existantes est reconnu. Cumulable avec --auto-series.
 *   - Date / année : jamais dans le nom — lues depuis l'EXIF
 *     (DateTimeOriginal), fallback année courante.
 *   - Fichier sans séparateur ` -` : mode legacy (titre depuis le nom,
 *     aucun style — la photo remonte dans les alertes du Dashboard).
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   npm run upload-photos              → parse + rapport, puis demande confirmation
 *   npm run upload-photos -- --dry-run → rapport seul, n'écrit rien
 *   npm run upload-photos -- --yes     → pas de confirmation interactive
 *
 * Idempotent : _id déterministe par nom de fichier ; re-lancer skip les photos
 * déjà importées. Les documents `camera` / `lens` manquants sont créés à la
 * volée (avec la chaîne EXIF en alias quand elle est connue) et listés dans le
 * rapport pour repérer les doublons de saisie.
 *
 * La sélection home ne se fait plus ici : Réglages du site → Curation.
 */

import { createClient } from '@sanity/client';
import exifr from 'exifr';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import {
  normalizeForMatch,
  seriesTitleForLocation,
  slugify,
  titleCase,
} from './taxonomy-helpers';
import {
  parsePhotoFilename,
  type ParseContext,
} from './parse-photo-filename';
import {
  MAX_BYTES,
  MAX_EDGE,
  SUPPORTED_PATTERN,
  prepareForWeb,
  probeImage,
  type ImageProbe,
} from './prepare-image';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
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

const DRY_RUN = process.argv.includes('--dry-run');
const ASSUME_YES = process.argv.includes('--yes');
/** Rattache chaque photo à la série de son lieu (créée au besoin). */
const AUTO_SERIES = process.argv.includes('--auto-series');
/** Série « Paris, France » plutôt que « Paris » — doit matcher assign-series-by-location. */
const FULL_LOCATION = process.argv.includes('--full-location');

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN,
  useCdn: false,
});

const PORTFOLIO_DIR = path.resolve(process.cwd(), 'portfolio');
const PARALLAX_PATTERN = [0.1, -0.05, 0.15, -0.1, 0.05, 0.12];
const RESERVED_FILES = new Set([
  'photo-profile.jpg',
  'photo-profile.jpeg',
  'photo-profile.png',
]);

// Plafonds de résolution et de poids, sondage HDR, décodage : `prepare-image.ts`.
//
// ⚠️ Les masters restent dans `portfolio/` (gitignoré) : ce script ne modifie
// JAMAIS les fichiers sources, il n'envoie qu'une copie réduite.

const mo = (bytes: number) => `${(bytes / 1048576).toFixed(1)} Mo`;
const ko = (bytes: number) => `${Math.round(bytes / 1024)} Ko`;

// ── Taxonomies Sanity ─────────────────────────────────────────────────────────

type TaxonomyDoc = { _id: string; title: string; aliases?: string[] };

/** normalize(title | alias) → doc, pour un type donné. */
function buildMatcher(docs: TaxonomyDoc[]): Map<string, TaxonomyDoc> {
  const map = new Map<string, TaxonomyDoc>();
  for (const doc of docs) {
    map.set(normalizeForMatch(doc.title), doc);
    for (const alias of doc.aliases ?? []) {
      map.set(normalizeForMatch(alias), doc);
    }
  }
  return map;
}

/** Docs camera/lens à créer, dédupliqués sur l'ensemble du run. */
type PendingGear = { _id: string; _type: 'camera' | 'lens'; title: string; aliases: Set<string> };

class GearResolver {
  private matcher: Map<string, TaxonomyDoc>;
  readonly pending = new Map<string, PendingGear>();

  constructor(
    private type: 'camera' | 'lens',
    existing: TaxonomyDoc[]
  ) {
    this.matcher = buildMatcher(existing);
  }

  /**
   * Résout un nom (token fichier et/ou chaîne EXIF) vers un _id de document,
   * en créant un doc pending si aucun existant ne matche. Quand les deux
   * sources sont connues, le token fichier donne le title et l'EXIF devient
   * un alias (les uploads suivants EXIF-only matcheront).
   */
  resolve(fromFilename: string | null, fromExif: string | null): {
    ref: string | null;
    source: 'fichier' | 'exif' | null;
    created: boolean;
    title: string | null;
  } {
    const name = fromFilename ?? fromExif;
    if (!name) return { ref: null, source: null, created: false, title: null };
    const source = fromFilename ? 'fichier' : 'exif';

    const hit =
      this.matcher.get(normalizeForMatch(name)) ??
      (fromExif ? this.matcher.get(normalizeForMatch(fromExif)) : undefined);
    if (hit) return { ref: hit._id, source, created: false, title: hit.title };

    const id = `${this.type}-${slugify(name)}`;
    let entry = this.pending.get(id);
    if (!entry) {
      entry = { _id: id, _type: this.type, title: name, aliases: new Set() };
      this.pending.set(id, entry);
      // Matche aussi les fichiers suivants du même run.
      this.matcher.set(normalizeForMatch(name), { _id: id, title: name });
    }
    if (fromFilename && fromExif && normalizeForMatch(fromExif) !== normalizeForMatch(fromFilename)) {
      entry.aliases.add(fromExif);
      this.matcher.set(normalizeForMatch(fromExif), { _id: id, title: name });
    }
    return { ref: id, source, created: true, title: entry.title };
  }
}

// ── Parsing du nom de fichier ────────────────────────────────────────────────

// Le parsing vit dans `parse-photo-filename.ts` : champs nommés, ordre libre,
// tous optionnels. Vérifié par `npm run check-parser`.

// ── EXIF ─────────────────────────────────────────────────────────────────────

type ExifData = {
  dateTaken?: string;
  year: number;
  model: string | null;
  lensModel: string | null;
};

async function readExif(filepath: string): Promise<ExifData> {
  const fallbackYear = new Date().getFullYear();
  let dateTaken: string | undefined;
  let year = fallbackYear;
  let model: string | null = null;
  let lensModel: string | null = null;
  try {
    const exif = await exifr.parse(filepath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateCreated', 'Model', 'LensModel'],
    });
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateCreated;
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
      const y = raw.getFullYear();
      if (y >= 1990 && y <= fallbackYear + 1) {
        dateTaken = raw.toISOString().slice(0, 10);
        year = y;
      }
    }
    if (typeof exif?.Model === 'string' && exif.Model.trim()) {
      model = exif.Model.trim();
    }
    if (typeof exif?.LensModel === 'string' && exif.LensModel.trim()) {
      lensModel = exif.LensModel.trim();
    }
  } catch {
    // EXIF illisible → fallbacks
  }
  return { dateTaken, year, model, lensModel };
}

// ── Plan ─────────────────────────────────────────────────────────────────────

type PlanEntry = {
  filename: string;
  docId: string;
  status: 'ok' | 'skip-existing';
  warnings: string[];
  title: string;
  slug: string;
  location: string | null;
  styleRefs: { _ref: string; title: string }[];
  cameraRef: string | null;
  cameraLabel: string;
  lensRef: string | null;
  lensLabel: string;
  year: number;
  dateTaken?: string;
  seriesRefs: { ref: string; label: string }[];
  seriesLabel: string;
  /** Sondage HDR / gamut / profondeur — `null` sur une photo déjà importée. */
  probe: ImageProbe | null;
};

/** Série à créer (`-serie:` ou --auto-series), dédupliquée sur le run. */
type PendingSeries = { _id: string; title: string; slug: string };

async function main(): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.readdir(PORTFOLIO_DIR);
  } catch {
    console.error(`✗ Dossier introuvable : ${PORTFOLIO_DIR}`);
    process.exit(1);
  }

  // Le filtre acceptait autrefois les seuls jpg/png/webp : un HEIC ou un AVIF
  // déposé dans `portfolio/` était ignoré SANS le moindre message. Les formats
  // d'appareil moderne (donc ceux qui portent du HDR) entrent maintenant dans
  // le lot — cf. SUPPORTED_EXTENSIONS.
  const files = entries
    .filter(
      (f) => SUPPORTED_PATTERN.test(f) && !RESERVED_FILES.has(f.toLowerCase())
    )
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
      const numB = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
      if (numA && numB) return numA - numB;
      return a.localeCompare(b);
    });

  if (files.length === 0) {
    console.log('Aucune photo trouvée dans portfolio/.');
    return;
  }

  // Taxonomies existantes (published uniquement — pas de refs vers des drafts).
  const [styles, cameras, lenses, existingPhotoIds, knownLocations, existingSeries] =
    await Promise.all([
      client.fetch<TaxonomyDoc[]>(
        `*[_type == "style" && !(_id in path('drafts.**'))]{ _id, title, aliases }`
      ),
      client.fetch<TaxonomyDoc[]>(
        `*[_type == "camera" && !(_id in path('drafts.**'))]{ _id, title, aliases }`
      ),
      client.fetch<TaxonomyDoc[]>(
        `*[_type == "lens" && !(_id in path('drafts.**'))]{ _id, title, aliases }`
      ),
      client.fetch<string[]>(`*[_type == "photo"]._id`),
      client.fetch<string[]>(
        `array::unique(*[_type == "photo" && defined(location)].location)`
      ),
      client.fetch<{ _id: string; title: string; slug: string | null }[]>(
        `*[_type == "series"]{ _id, title, "slug": slug.current }`
      ),
    ]);

  if (styles.length === 0) {
    console.warn(
      '⚠ Aucun document `style` dans Sanity. Lance d’abord `npm run migrate-taxonomy -- --yes`\n' +
        '  (seed Street/Landscape/Portrait/Architecture) — sinon tous les styles seront inconnus.\n'
    );
  }

  const styleMatcher = buildMatcher(styles);
  const cameraResolver = new GearResolver('camera', cameras);
  const lensResolver = new GearResolver('lens', lenses);
  const knownPhotoIds = new Set(existingPhotoIds);

  // Index des séries existantes (titre ET slug) — sert au rattachement par nom
  // de fichier (`-serie:`) comme à --auto-series.
  const seriesByKey = new Map<string, { _id: string; title: string }>();
  for (const s of existingSeries) {
    seriesByKey.set(normalizeForMatch(s.title), s);
    if (s.slug) seriesByKey.set(normalizeForMatch(s.slug), s);
  }
  const pendingSeries = new Map<string, PendingSeries>();

  const parseCtx: ParseContext = {
    styleAliases: new Set(styleMatcher.keys()),
    cameraAliases: new Set(buildMatcher(cameras).keys()),
    lensAliases: new Set(buildMatcher(lenses).keys()),
    knownLocations: new Set(knownLocations.map(normalizeForMatch)),
    seriesKeys: new Set(seriesByKey.keys()),
    currentYear: new Date().getFullYear(),
  };

  /**
   * Résout (ou planifie) une série par son nom — le titre est gardé tel que
   * tapé dans le nom de fichier. La clé est aussi ajoutée au contexte de parse :
   * une série créée par le fichier 3 devient reconnaissable en écriture
   * implicite dès le fichier 4 du même run.
   */
  function resolveSeriesByName(name: string): { ref: string; label: string } {
    const key = normalizeForMatch(name);
    const hit = seriesByKey.get(key);
    if (hit) return { ref: hit._id, label: hit.title };

    const slug = slugify(name);
    const id = `series-${slug}`;
    if (!pendingSeries.has(id)) {
      pendingSeries.set(id, { _id: id, title: name, slug });
      seriesByKey.set(key, { _id: id, title: name });
      parseCtx.seriesKeys.add(key);
    }
    return { ref: id, label: `${name} (nouvelle)` };
  }

  /** Résout (ou planifie) la série correspondant à un lieu (--auto-series). */
  function resolveSeriesForLocation(location: string): {
    ref: string;
    label: string;
  } {
    return resolveSeriesByName(seriesTitleForLocation(location, FULL_LOCATION));
  }

  // ── Construction du plan ────────────────────────────────────────────────────
  const plan: PlanEntry[] = [];
  for (const filename of files) {
    const base = path.basename(filename, path.extname(filename));
    const docId = `photo-${slugify(base)}`;
    const parsed = parsePhotoFilename(base, parseCtx);
    const warnings: string[] = [...parsed.warnings];

    if (knownPhotoIds.has(docId)) {
      plan.push({
        filename,
        docId,
        status: 'skip-existing',
        warnings,
        title: parsed.title,
        slug: '',
        location: parsed.location,
        styleRefs: [],
        cameraRef: null,
        cameraLabel: '—',
        lensRef: null,
        lensLabel: '—',
        year: 0,
        seriesRefs: [],
        seriesLabel: '—',
        probe: null,
      });
      continue;
    }

    const filepath = path.join(PORTFOLIO_DIR, filename);
    const exif = await readExif(filepath);

    // Sondage HDR / gamut AU MOMENT DU PLAN, pas à l'upload : le dry-run doit
    // dire ce qui sera perdu AVANT d'écrire quoi que ce soit, sinon il ment par
    // omission sur le seul point qui n'est pas rattrapable après coup. Le
    // buffer est relu à l'upload plutôt que gardé — 22 masters de 30 Mo en
    // mémoire simultanément, non.
    const { default: sharp } = await import('sharp');
    let probe: ImageProbe | null = null;
    try {
      const raw = await fs.readFile(filepath);
      probe = probeImage(raw, await sharp(raw).metadata());
      probe.losses.forEach((l) => warnings.push(l));
    } catch (err) {
      warnings.push(
        `image illisible au sondage (${err instanceof Error ? err.message.split('\n')[0] : err})`
      );
    }

    // Styles — un alias inconnu n'interrompt JAMAIS l'import : il est signalé
    // et la photo remonte dans l'alerte « sans style » du tableau de bord.
    const styleRefs: { _ref: string; title: string }[] = [];
    for (const token of parsed.styleTokens) {
      const hit = styleMatcher.get(normalizeForMatch(token));
      if (!hit) {
        warnings.push(
          `style inconnu « ${token} » — ignoré (ajoute-le dans Taxonomies → Styles)`
        );
      } else if (!styleRefs.some((s) => s._ref === hit._id)) {
        styleRefs.push({ _ref: hit._id, title: hit.title });
      }
    }
    if (styleRefs.length > 3) {
      warnings.push(`${styleRefs.length} styles reconnus — seuls les 3 premiers sont gardés`);
      styleRefs.length = 3;
    }
    if (parsed.legacy) {
      warnings.push('nom hors convention : titre seul, tout le reste à compléter');
    } else if (styleRefs.length === 0) {
      warnings.push('aucun style');
    }
    if (!parsed.location) warnings.push('aucun lieu');
    for (const token of parsed.unresolved) {
      warnings.push(`jeton non compris « ${token} » — ignoré`);
    }

    const camera = cameraResolver.resolve(parsed.cameraToken, exif.model);
    const lens = lensResolver.resolve(parsed.lensToken, exif.lensModel);
    if (!camera.ref) warnings.push('boîtier inconnu (ni nom de fichier, ni EXIF)');
    if (!lens.ref) warnings.push('objectif inconnu (ni nom de fichier, ni EXIF — objectif manuel ?)');

    // Année : nom de fichier prioritaire, puis EXIF, puis année courante.
    const year = parsed.year ?? exif.year;
    let dateTaken = parsed.dateTaken ?? exif.dateTaken;
    // Si le nom impose une année que la date EXIF contredit, la date EXIF est
    // fausse (scan, retouche, horloge déréglée) : on ne garde pas un couple
    // incohérent du type « année 2022, prise le 2026-04-12 ».
    if (dateTaken && !dateTaken.startsWith(String(year))) {
      warnings.push(
        `date EXIF ${dateTaken} incohérente avec l'année ${year} — date ignorée`
      );
      dateTaken = undefined;
    }
    if (!parsed.year && !exif.dateTaken) {
      warnings.push(`ni année dans le nom, ni date EXIF → année ${year} par défaut`);
    }

    // Séries : celles du nom de fichier (`-serie:a, b` ou implicites), puis
    // celle du lieu si --auto-series — cumulables, `photo.series` est un
    // tableau (appartenance multiple, cf. CLAUDE.md §11.2).
    const seriesRefs: { ref: string; label: string }[] = [];
    for (const token of parsed.seriesTokens) {
      const s = resolveSeriesByName(token);
      if (!seriesRefs.some((x) => x.ref === s.ref)) seriesRefs.push(s);
    }
    if (AUTO_SERIES && parsed.location) {
      const s = resolveSeriesForLocation(parsed.location);
      if (!seriesRefs.some((x) => x.ref === s.ref)) seriesRefs.push(s);
    } else if (AUTO_SERIES && !parsed.location && seriesRefs.length === 0) {
      warnings.push('--auto-series sans lieu : aucune série assignée');
    }
    const seriesLabel =
      seriesRefs.map((s) => s.label).join(', ') || '—';

    // Slug SEO : [année]-[lieu-court]-[titre] (cf. CLAUDE.md §5.1).
    const locationShort = parsed.location
      ? slugify(parsed.location.split(',')[0]!)
      : null;
    const slug = [year, locationShort, slugify(parsed.title)]
      .filter(Boolean)
      .join('-');

    plan.push({
      filename,
      docId,
      status: 'ok',
      warnings,
      title: parsed.title,
      slug,
      location: parsed.location ? titleCase(parsed.location) : null,
      styleRefs,
      cameraRef: camera.ref,
      cameraLabel: camera.title
        ? `${camera.title}${camera.created ? ' (nouveau)' : ''} [${camera.source}]`
        : '—',
      lensRef: lens.ref,
      lensLabel: lens.title
        ? `${lens.title}${lens.created ? ' (nouveau)' : ''} [${lens.source}]`
        : '—',
      year,
      dateTaken,
      seriesRefs,
      seriesLabel,
      probe,
    });
  }

  // ── Rapport ────────────────────────────────────────────────────────────────
  const toUpload = plan.filter((p) => p.status === 'ok');
  const skipped = plan.filter((p) => p.status === 'skip-existing');
  const incomplete = toUpload.filter(
    (p) => !p.location || p.styleRefs.length === 0 || !p.cameraRef
  );

  console.log(
    `Plan d'upload — projet ${PROJECT_ID}, dataset ${DATASET} :\n` +
      `  ${toUpload.length} à uploader · ${skipped.length} déjà importée(s)\n`
  );

  for (const p of toUpload) {
    console.log(`• ${p.filename}`);
    console.log(`    titre    : ${p.title}`);
    console.log(`    slug     : ${p.slug}`);
    console.log(`    lieu     : ${p.location ?? '—'}`);
    console.log(
      `    styles   : ${p.styleRefs.map((s) => s.title).join(', ') || '—'}`
    );
    console.log(`    boîtier  : ${p.cameraLabel}`);
    console.log(`    objectif : ${p.lensLabel}`);
    console.log(`    série    : ${p.seriesLabel}`);
    console.log(
      `    année    : ${p.year}${p.dateTaken ? ` (date ${p.dateTaken})` : ''}`
    );
    p.warnings.forEach((w) => console.log(`    ⚠ ${w}`));
  }
  if (skipped.length > 0) {
    console.log(
      `\nDéjà importées (skip) : ${skipped.map((p) => p.filename).join(', ')}`
    );
  }

  const newGear = [...cameraResolver.pending.values(), ...lensResolver.pending.values()];
  if (newGear.length > 0) {
    console.log(
      `\nDocuments matériel à créer : ${newGear
        .map((g) => `${g._type}/${g.title}`)
        .join(', ')}\n  (vérifie qu'aucun n'est un doublon de saisie d'un existant)`
    );
  }
  if (pendingSeries.size > 0) {
    console.log(
      `\nSéries à créer : ${[...pendingSeries.values()]
        .map((s) => s.title)
        .join(', ')}`
    );
  }
  // Le HDR ne « se dégrade » pas en chemin : le CDN Sanity le supprime (mesuré,
  // cf. prepare-image.ts). Autant l'annoncer en bloc, une bonne fois, plutôt que
  // de le laisser noyé dans les avertissements ligne à ligne.
  const hdrFiles = toUpload.filter((p) => p.probe && p.probe.hdr !== 'sdr');
  if (hdrFiles.length > 0) {
    console.log(
      `\n${hdrFiles.length} fichier(s) HDR détecté(s) — aplati(s) en SDR avant dépôt :\n  ` +
        hdrFiles.map((p) => `${p.filename} (${p.probe!.hdr})`).join('\n  ') +
        '\n  Le CDN Sanity ré-encode tout ce qu’il sert : aucune URL ne rendrait\n' +
        '  le HDR, même à l’adresse « originale ». Exporte en sRGB 8 bits, grand\n' +
        `  côté ≥ ${MAX_EDGE} px, qualité max — le HDR n’apporte rien ici.`
    );
  }
  if (incomplete.length > 0) {
    console.log(
      `\n${incomplete.length} photo(s) incomplète(s) — importées quand même, ` +
        'à compléter dans le Studio (elles remontent dans les alertes du tableau de bord) :\n  ' +
        incomplete.map((p) => p.title).join(' · ')
    );
  }

  if (toUpload.length === 0) {
    console.log('\nRien à uploader.');
    return;
  }
  if (DRY_RUN) {
    console.log('\nDry-run terminé. Relance sans --dry-run pour uploader.');
    return;
  }

  if (!ASSUME_YES) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`\nUploader ${toUpload.length} photo(s) ? (o/N) `)).trim().toLowerCase();
    rl.close();
    if (answer !== 'o' && answer !== 'oui' && answer !== 'y' && answer !== 'yes') {
      console.log('Annulé.');
      return;
    }
  }

  // ── Écriture : matériel + séries d'abord (les photos les référencent) ─────
  for (const gear of newGear) {
    await client.createIfNotExists({
      _id: gear._id,
      _type: gear._type,
      title: gear.title,
      slug: { _type: 'slug', current: slugify(gear.title) },
      aliases: [...gear.aliases],
    });
    console.log(`✓ ${gear._type} créé : ${gear.title}`);
  }
  for (const s of pendingSeries.values()) {
    await client.createIfNotExists({
      _id: s._id,
      _type: 'series',
      title: s.title,
      slug: { _type: 'slug', current: s.slug },
    });
    console.log(`✓ série créée : ${s.title}`);
  }

  for (const [index, p] of toUpload.entries()) {
    const filepath = path.join(PORTFOLIO_DIR, p.filename);
    console.log(`[${index + 1}/${toUpload.length}] upload ${p.filename}…`);

    const buffer = await fs.readFile(filepath);

    // Réduction AVANT dépôt — cf. MAX_EDGE / MAX_BYTES. Le master de
    // `portfolio/` n'est pas touché : seule cette copie part chez Sanity.
    const shrunk = await prepareForWeb(filepath, buffer);
    const ratio = 1 - shrunk.to.bytes / shrunk.from.bytes;
    console.log(
      `        ${shrunk.from.w}×${shrunk.from.h} ${mo(shrunk.from.bytes)}` +
        ` → ${shrunk.to.w}×${shrunk.to.h} ${ko(shrunk.to.bytes)}` +
        ` (−${Math.round(ratio * 100)} %` +
        (shrunk.quality ? `, q=${shrunk.quality}` : '') +
        `)${shrunk.to.bytes > MAX_BYTES ? ' ⚠ au-dessus du plafond' : ''}` +
        (shrunk.systemDecoded ? ' [décodé par sips]' : '')
    );

    // Le nom porte l'extension du fichier RÉELLEMENT déposé : un HEIC converti
    // en JPEG garderait sinon un `.heic` trompeur côté Sanity.
    const asset = await client.assets.upload('image', shrunk.buffer, {
      filename: `${path.basename(p.filename, path.extname(p.filename))}.${shrunk.ext}`,
      contentType: shrunk.contentType,
    });

    await client.createOrReplace({
      _id: p.docId,
      _type: 'photo',
      title: p.title,
      slug: { _type: 'slug', current: p.slug },
      image: {
        _type: 'image',
        asset: { _type: 'reference', _ref: asset._id },
        // Filet de sécurité : la vraie description sensorielle se rédige dans
        // le Studio (alerte Dashboard « sans légende » en rappel).
        alt: [p.title, p.location].filter(Boolean).join(' — '),
      },
      ...(p.styleRefs.length > 0
        ? {
            styles: p.styleRefs.map((s) => ({
              _type: 'reference',
              _ref: s._ref,
              _key: s._ref,
            })),
          }
        : {}),
      ...(p.cameraRef
        ? { camera: { _type: 'reference', _ref: p.cameraRef } }
        : {}),
      ...(p.lensRef ? { lens: { _type: 'reference', _ref: p.lensRef } } : {}),
      // `series` est un TABLEAU (appartenance multiple, cf. CLAUDE.md §11.2).
      // `_key` = l'id de la série : déterministe, donc un ré-upload de la même
      // photo produit exactement le même document (l'idempotence du script
      // repose là-dessus).
      ...(p.seriesRefs.length > 0
        ? {
            series: p.seriesRefs.map((s) => ({
              _key: s.ref,
              _type: 'reference',
              _ref: s.ref,
            })),
          }
        : {}),
      year: p.year,
      ...(p.location ? { location: p.location } : {}),
      ...(p.dateTaken ? { dateTaken: p.dateTaken } : {}),
      parallaxSpeed: PARALLAX_PATTERN[index % PARALLAX_PATTERN.length],
    });

    console.log(`        → ${p.docId} (${p.title}, ${p.year})`);
  }

  console.log(
    `\n✓ Terminé.` +
      (incomplete.length > 0
        ? `\n${incomplete.length} photo(s) à compléter dans le Studio (Tableau de bord → Alertes qualité).`
        : '') +
      '\nProchaine étape : curation dans le Studio (Réglages du site), puis `npm run deploy`.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
