/**
 * Migration one-shot : category → styles[], onHomepage/order → siteSettings.curation.
 *
 * Usage :
 *   npm run migrate-taxonomy            → DRY-RUN (affiche le plan, n'écrit rien)
 *   npm run migrate-taxonomy -- --yes   → applique
 *
 * Ce que fait le script (idempotent, re-lançable sans danger) :
 *   1. Crée les 4 documents `style` seed (createIfNotExists — n'écrase pas
 *      les styles déjà édités dans le Studio).
 *   2. Pour chaque photo ayant encore `category` : pose `styles: [ref]`
 *      (si `styles` est vide) puis retire `category`.
 *   3. Construit `siteSettings.curation` depuis les photos publiées
 *      `onHomepage == true` triées par `order` — UNIQUEMENT si `curation`
 *      n'existe pas encore (ne touche jamais une curation déjà en place).
 *   4. Retire `onHomepage` et `order` de toutes les photos.
 *
 * Après migration : la home est pilotée par Réglages du site → Curation
 * (drag & drop), et `npm run set-homepage` n'existe plus.
 */

import { createClient } from '@sanity/client';
import { DEFAULT_STYLES } from './taxonomy-helpers';

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

const APPLY = process.argv.includes('--yes');

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
  category?: string;
  styles?: { _ref: string }[];
  onHomepage?: boolean;
  order?: number;
};

async function main(): Promise<void> {
  console.log(
    `Migration taxonomie — projet ${PROJECT_ID}, dataset ${DATASET} — ${APPLY ? 'APPLICATION' : 'DRY-RUN (ajoute --yes pour appliquer)'}\n`
  );

  // ── 1. Styles seed ────────────────────────────────────────────────────────
  const existingStyleIds = new Set(
    await client.fetch<string[]>(`*[_type == "style"]._id`)
  );
  const stylesToCreate = DEFAULT_STYLES.filter((s) => !existingStyleIds.has(s.id));
  console.log(
    `1. Styles seed : ${stylesToCreate.length ? stylesToCreate.map((s) => s.title).join(', ') + ' à créer' : 'déjà en place'}.`
  );

  // ── 2 + 4. Photos (drafts inclus — perspective raw par défaut) ────────────
  const photos = await client.fetch<PhotoRow[]>(
    `*[_type == "photo"]{ _id, title, category, styles, onHomepage, order }`
  );
  const categoryToStyleId = new Map(
    DEFAULT_STYLES.map((s) => [s.legacyCategory, s.id])
  );

  const needStyles = photos.filter(
    (p) => p.category && (!p.styles || p.styles.length === 0)
  );
  const unknownCategories = needStyles.filter(
    (p) => !categoryToStyleId.has(p.category as string)
  );
  const needCleanup = photos.filter(
    (p) => p.category !== undefined || p.onHomepage !== undefined || p.order !== undefined
  );

  console.log(
    `2. Photos : ${photos.length} au total, ${needStyles.length} à convertir category → styles, ${needCleanup.length} à nettoyer (category/onHomepage/order).`
  );
  if (unknownCategories.length > 0) {
    console.warn(
      `   ⚠ ${unknownCategories.length} photo(s) avec une category inconnue (laisser telles quelles, styles non posés) :`
    );
    for (const p of unknownCategories) {
      console.warn(`     - ${p.title ?? p._id} : "${p.category}"`);
    }
  }

  // ── 3. Curation depuis onHomepage/order (photos publiées uniquement) ─────
  const settings = await client.fetch<{ curation?: unknown[] } | null>(
    `*[_id == "siteSettings"][0]{ curation }`
  );
  const hasCuration =
    Array.isArray(settings?.curation) && settings.curation.length > 0;
  const curated = photos
    .filter((p) => !p._id.startsWith('drafts.') && p.onHomepage === true)
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  if (hasCuration) {
    console.log(
      `3. Curation : déjà en place (${settings!.curation!.length} photos) — non touchée.`
    );
  } else if (!settings) {
    console.log(
      '3. Curation : document siteSettings absent — étape sautée (crée-le dans le Studio d’abord).'
    );
  } else {
    console.log(
      `3. Curation : à construire depuis onHomepage/order → ${curated.length} photos :`
    );
    curated.forEach((p, i) =>
      console.log(`     ${String(i + 1).padStart(2)}. ${p.title ?? p._id}`)
    );
  }

  if (!APPLY) {
    console.log('\nDry-run terminé. Relance avec --yes pour appliquer.');
    return;
  }

  // ── Écriture ──────────────────────────────────────────────────────────────
  for (const style of stylesToCreate) {
    await client.createIfNotExists({
      _id: style.id,
      _type: 'style',
      title: style.title,
      slug: { _type: 'slug', current: style.slug },
      aliases: style.aliases,
    });
    console.log(`✓ style créé : ${style.title}`);
  }

  let tx = client.transaction();
  for (const p of needCleanup) {
    const styleId = p.category ? categoryToStyleId.get(p.category) : undefined;
    const setStyles =
      styleId && (!p.styles || p.styles.length === 0)
        ? {
            styles: [
              { _type: 'reference', _ref: styleId, _key: styleId },
            ],
          }
        : {};
    const unsetFields = [
      ...(p.category !== undefined && (styleId || !p.category) ? ['category'] : []),
      ...(p.onHomepage !== undefined ? ['onHomepage'] : []),
      ...(p.order !== undefined ? ['order'] : []),
    ];
    tx = tx.patch(p._id, (patch) => {
      let next = patch;
      if (Object.keys(setStyles).length > 0) next = next.set(setStyles);
      if (unsetFields.length > 0) next = next.unset(unsetFields);
      return next;
    });
  }
  if (needCleanup.length > 0) {
    await tx.commit();
    console.log(`✓ ${needCleanup.length} photo(s) migrée(s) / nettoyée(s).`);
  }

  if (settings && !hasCuration && curated.length > 0) {
    await client
      .patch('siteSettings')
      .set({
        curation: curated.map((p) => ({
          _type: 'reference',
          _ref: p._id,
          _key: p._id,
        })),
      })
      .commit();
    console.log(`✓ curation posée : ${curated.length} photos, ordre préservé.`);
  }

  console.log(
    '\n✓ Migration terminée. Vérifie dans le Studio (Réglages du site → Curation), puis `npm run deploy`.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
