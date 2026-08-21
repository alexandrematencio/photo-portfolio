/**
 * Rattachement en masse des photos à une série, groupées par lieu.
 *
 * Usage :
 *   npm run assign-series-by-location                    → DRY-RUN (n'écrit rien)
 *   npm run assign-series-by-location -- --yes           → applique
 *   npm run assign-series-by-location -- --min 3         → ignore les lieux < 3 photos
 *   npm run assign-series-by-location -- --location "Paris, France"
 *   npm run assign-series-by-location -- --full-location → série « Paris, France » au lieu de « Paris »
 *   npm run assign-series-by-location -- --force         → réassigne aussi les photos déjà rattachées
 *
 * Comportement :
 *   - Titre de série = partie avant la virgule du lieu (« Paris, France » → « Paris »),
 *     sauf avec --full-location.
 *   - Réutilise une série existante si son titre ou son slug correspond
 *     (comparaison insensible à la casse et aux accents). Sinon la crée avec un
 *     `_id` déterministe `series-<slug>` → re-lancer ne duplique jamais.
 *   - `year` de la série renseignée UNIQUEMENT si toutes les photos du lieu
 *     partagent la même année (sinon on laisse vide plutôt que d'inventer).
 *   - Les photos déjà rattachées à une série sont ignorées par défaut : le
 *     travail manuel déjà fait n'est jamais écrasé sans --force.
 *   - Drafts inclus : si une photo a un brouillon, les deux versions sont
 *     patchées pour ne pas laisser le draft annuler le rattachement.
 *
 * Après coup : Publish dans le Studio, puis `npm run deploy`.
 */

import { createClient } from '@sanity/client';
import readline from 'node:readline/promises';
import {
  normalizeForMatch,
  seriesTitleForLocation,
  slugify,
} from './taxonomy-helpers';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;

if (!PROJECT_ID || !WRITE_TOKEN) {
  console.error(
    '✗ Variables manquantes (NEXT_PUBLIC_SANITY_PROJECT_ID + SANITY_API_WRITE_TOKEN dans .env.local).'
  );
  process.exit(1);
}

const argv = process.argv.slice(2);

function flagValue(name: string): string | null {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
}

const APPLY = argv.includes('--yes');
const FORCE = argv.includes('--force');
const FULL_LOCATION = argv.includes('--full-location');
const ONLY_LOCATION = flagValue('location');
const MIN_RAW = flagValue('min');
const MIN = MIN_RAW ? Number.parseInt(MIN_RAW, 10) : 1;

if (Number.isNaN(MIN) || MIN < 1) {
  console.error('✗ --min attend un entier ≥ 1.');
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN,
  useCdn: false,
});

type PhotoRow = {
  _id: string;
  title?: string;
  location?: string;
  year?: number;
  /** Tableau depuis le 2026-08-21 ; un document non migré porte encore un objet. */
  series?: { _ref?: string }[] | { _ref?: string } | null;
};

type SeriesRow = { _id: string; title: string; slug: string | null };

type Plan = {
  location: string;
  seriesTitle: string;
  seriesSlug: string;
  seriesId: string;
  seriesExists: boolean;
  year: number | null;
  toAssign: PhotoRow[];
  alreadyAssigned: PhotoRow[];
};

/** « Paris, France » → « Paris » (sauf --full-location). Règle partagée. */
/** Lit `photo.series` quelle que soit sa forme (tableau, ou objet non migré). */
function refsOf(value: PhotoRow['series']): string[] {
  if (Array.isArray(value)) {
    return value
      .map((v) => v?._ref)
      .filter((ref): ref is string => typeof ref === 'string');
  }
  return value?._ref ? [value._ref] : [];
}

function seriesTitleFor(location: string): string {
  return seriesTitleForLocation(location, FULL_LOCATION);
}

async function main(): Promise<void> {
  console.log(
    `Rattachement par lieu — projet ${PROJECT_ID}, dataset ${DATASET} — ` +
      `${APPLY ? 'APPLICATION' : 'DRY-RUN (ajoute --yes pour appliquer)'}\n`
  );

  const [photos, existingSeries] = await Promise.all([
    client.fetch<PhotoRow[]>(
      `*[_type == "photo" && defined(location)]{ _id, title, location, year, series }`
    ),
    client.fetch<SeriesRow[]>(
      `*[_type == "series"]{ _id, title, "slug": slug.current }`
    ),
  ]);

  if (photos.length === 0) {
    console.log('Aucune photo avec un lieu renseigné.');
    return;
  }

  // Index des séries existantes : titre normalisé ET slug → doc.
  const seriesByKey = new Map<string, SeriesRow>();
  for (const s of existingSeries) {
    seriesByKey.set(normalizeForMatch(s.title), s);
    if (s.slug) seriesByKey.set(normalizeForMatch(s.slug), s);
  }

  // Regroupement par lieu.
  const groups = new Map<string, PhotoRow[]>();
  for (const p of photos) {
    const loc = p.location?.trim();
    if (!loc) continue;
    if (ONLY_LOCATION && normalizeForMatch(loc) !== normalizeForMatch(ONLY_LOCATION)) {
      continue;
    }
    if (!groups.has(loc)) groups.set(loc, []);
    groups.get(loc)!.push(p);
  }

  if (groups.size === 0) {
    console.log(
      ONLY_LOCATION
        ? `Aucune photo pour le lieu « ${ONLY_LOCATION} ».`
        : 'Aucun lieu exploitable.'
    );
    return;
  }

  const plans: Plan[] = [];
  const skippedTooSmall: { location: string; count: number }[] = [];

  for (const [location, rows] of [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )) {
    if (rows.length < MIN) {
      skippedTooSmall.push({ location, count: rows.length });
      continue;
    }

    const seriesTitle = seriesTitleFor(location);
    const seriesSlug = slugify(seriesTitle);
    const hit =
      seriesByKey.get(normalizeForMatch(seriesTitle)) ??
      seriesByKey.get(normalizeForMatch(seriesSlug));

    // « Déjà rattachée » = rattachée à AU MOINS une série. Depuis que
    // l'appartenance est multiple, ce script AJOUTE au lieu de remplacer : sans
    // ce filtre par défaut il re-rattacherait tout à chaque passage, et
    // `--force` deviendrait la norme silencieuse.
    const toAssign = FORCE ? rows : rows.filter((p) => refsOf(p.series).length === 0);
    const alreadyAssigned = FORCE ? [] : rows.filter((p) => refsOf(p.series).length > 0);

    // Année seulement si le groupe est homogène — sinon on n'invente pas.
    const years = new Set(
      rows.map((p) => p.year).filter((y): y is number => typeof y === 'number')
    );
    const year = years.size === 1 ? [...years][0]! : null;

    plans.push({
      location,
      seriesTitle,
      seriesSlug,
      seriesId: hit?._id ?? `series-${seriesSlug}`,
      seriesExists: Boolean(hit),
      year,
      toAssign,
      alreadyAssigned,
    });
  }

  // ── Rapport ───────────────────────────────────────────────────────────────
  let totalAssign = 0;
  for (const p of plans) {
    totalAssign += p.toAssign.length;
    const tag = p.seriesExists ? 'série existante' : 'série à créer';
    console.log(
      `• ${p.location}  →  « ${p.seriesTitle} » (${tag}${p.year ? `, année ${p.year}` : ''})`
    );
    console.log(
      `    ${p.toAssign.length} photo${p.toAssign.length === 1 ? '' : 's'} à rattacher` +
        (p.alreadyAssigned.length > 0
          ? ` · ${p.alreadyAssigned.length} déjà rattachée${p.alreadyAssigned.length === 1 ? '' : 's'} (ignorée${p.alreadyAssigned.length === 1 ? '' : 's'}, --force pour écraser)`
          : '')
    );
    const preview = p.toAssign.slice(0, 3).map((x) => x.title ?? x._id);
    if (preview.length > 0) {
      console.log(
        `    ex. : ${preview.join(' · ')}${p.toAssign.length > 3 ? ` … (+${p.toAssign.length - 3})` : ''}`
      );
    }
  }

  if (skippedTooSmall.length > 0) {
    console.log(
      `\nLieux ignorés (< ${MIN} photo${MIN === 1 ? '' : 's'}) : ` +
        skippedTooSmall.map((s) => `${s.location} (${s.count})`).join(', ')
    );
  }

  console.log(
    `\nTotal : ${totalAssign} photo${totalAssign === 1 ? '' : 's'} à rattacher, ` +
      `${plans.filter((p) => !p.seriesExists).length} série(s) à créer.`
  );

  if (totalAssign === 0) {
    console.log('Rien à faire.');
    return;
  }
  if (!APPLY) {
    console.log('\nDry-run terminé. Relance avec --yes pour appliquer.');
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = (
    await rl.question(`\nAppliquer ces ${totalAssign} rattachements ? (o/N) `)
  )
    .trim()
    .toLowerCase();
  rl.close();
  if (!['o', 'oui', 'y', 'yes'].includes(answer)) {
    console.log('Annulé.');
    return;
  }

  // ── Écriture ──────────────────────────────────────────────────────────────
  // Séries d'abord : les photos les référencent.
  for (const p of plans.filter((x) => !x.seriesExists && x.toAssign.length > 0)) {
    await client.createIfNotExists({
      _id: p.seriesId,
      _type: 'series',
      title: p.seriesTitle,
      slug: { _type: 'slug', current: p.seriesSlug },
      ...(p.year ? { year: p.year } : {}),
    });
    console.log(`✓ série créée : ${p.seriesTitle}`);
  }

  let tx = client.transaction();
  let patched = 0;
  for (const p of plans) {
    for (const photo of p.toAssign) {
      // AJOUT, pas remplacement : la photo garde ses séries existantes.
      const next = Array.from(new Set([...refsOf(photo.series), p.seriesId]));
      tx = tx.patch(photo._id, {
        set: {
          series: next.map((ref) => ({
            _key: ref,
            _type: 'reference',
            _ref: ref,
          })),
        },
      });
      patched++;
    }
  }
  await tx.commit();

  console.log(
    `\n✓ ${patched} photo${patched === 1 ? '' : 's'} rattachée${patched === 1 ? '' : 's'}.` +
      '\nProchaine étape : vérifie dans le Studio (Photos → Par série), puis `npm run deploy`.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
