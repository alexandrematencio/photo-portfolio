/**
 * Réduit au plafond (MAX_EDGE) les assets image STOCKÉS en pleine résolution,
 * dépose la version réduite et fait pointer dessus chaque document qui
 * référençait l'ancien asset — documents publiés ET brouillons.
 *
 *   npm run downsize-assets                  → DRY-RUN : liste, n'écrit rien
 *   npm run downsize-assets -- --yes         → applique
 *   npm run downsize-assets -- --yes --limit 2   → deux assets, pour éprouver
 *
 * Pourquoi : 121 assets (audit du 2026-09-11) sont stockés jusqu'à 6356 px ;
 * retirer `?w=` d'une URL du site les rend en entier. Plafonner les URLs côté
 * code ne ferme rien — seul l'asset stocké compte (lib/sanity/image.ts).
 *
 * Source de la réduction, dans l'ordre : le master local `portfolio/<nom>`
 * s'il existe (même nom que `originalFilename`), sinon le fichier servi par le
 * CDN à l'URL originale — déjà ré-encodé par Sanity, mais à 2048 px la seconde
 * génération est invisible. `prepareForWeb` fait le reste : plafond, poids,
 * sRGB, signature.
 *
 * RÉVERSIBLE : les anciens assets ne sont PAS supprimés. Ils deviennent
 * orphelins (plus aucune URL du site n'y mène) et le journal JSON écrit dans
 * resources/ garde la correspondance old → new. La purge est une décision à
 * part (spec R1), jamais prise ici.
 *
 * Idempotent : un asset déjà sous le plafond n'est pas sélectionné, une
 * relance ne refait donc que ce qui a échoué.
 */
import { createClient } from '@sanity/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { MAX_EDGE, prepareForWeb } from './prepare-image';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;

const APPLY = process.argv.includes('--yes');
const limitAt = process.argv.indexOf('--limit');
const LIMIT = limitAt >= 0 ? Number(process.argv[limitAt + 1]) : Infinity;
const PORTFOLIO_DIR = path.resolve(process.cwd(), 'portfolio');

if (!PROJECT_ID) {
  console.error('✗ NEXT_PUBLIC_SANITY_PROJECT_ID manquant dans .env.local.');
  process.exit(1);
}
if (APPLY && !WRITE_TOKEN) {
  console.error('✗ SANITY_API_WRITE_TOKEN manquant dans .env.local.');
  process.exit(1);
}

const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: API_VERSION,
  token: WRITE_TOKEN ?? process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
  // `raw` : les brouillons référencent l'asset autant que les publiés — un
  // brouillon oublié republierait l'ancien asset au prochain Publish.
  perspective: 'raw',
});

type Target = {
  assetId: string;
  url: string;
  originalFilename: string | null;
  size: number;
  width: number;
  height: number;
  photoRefs: { _id: string; year: number | null }[];
  heroDefault: string[];
  heroReveal: string[];
};

type Ref = { docId: string; field: string; year: number | undefined };

type LogEntry = {
  oldAssetId: string;
  newAssetId: string;
  source: 'portfolio' | 'cdn';
  from: { w: number; h: number; bytes: number };
  to: { w: number; h: number; bytes: number };
  patched: Ref[];
};

const TARGETS_QUERY = `
*[_type == "sanity.imageAsset" && (metadata.dimensions.width > $max || metadata.dimensions.height > $max)]{
  "assetId": _id, url, originalFilename, size,
  "width": metadata.dimensions.width, "height": metadata.dimensions.height,
  "photoRefs": *[_type == "photo" && image.asset._ref == ^._id]{ _id, year },
  "heroDefault": *[_id in ["siteSettings", "drafts.siteSettings"] && hero.defaultImage.asset._ref == ^._id]._id,
  "heroReveal": *[_id in ["siteSettings", "drafts.siteSettings"] && hero.revealImage.asset._ref == ^._id]._id
} | order(size desc)`;

function refsOf(t: Target): Ref[] {
  return [
    ...t.photoRefs.map((p) => ({ docId: p._id, field: 'image.asset._ref', year: p.year ?? undefined })),
    ...t.heroDefault.map((id) => ({ docId: id, field: 'hero.defaultImage.asset._ref', year: undefined })),
    ...t.heroReveal.map((id) => ({ docId: id, field: 'hero.revealImage.asset._ref', year: undefined })),
  ];
}

async function localMaster(name: string | null): Promise<Buffer | null> {
  if (!name) return null;
  try {
    return await fs.readFile(path.join(PORTFOLIO_DIR, name));
  } catch {
    return null;
  }
}

const mo = (b: number) => `${(b / 1024 / 1024).toFixed(1)} Mo`;

async function main(): Promise<void> {
  const all = await client.fetch<Target[]>(TARGETS_QUERY, { max: MAX_EDGE });
  // Les orphelins ne mènent nulle part : rien à repointer, on ne les touche pas.
  const targets = all.filter((t) => refsOf(t).length > 0).slice(0, LIMIT);
  const orphans = all.length - all.filter((t) => refsOf(t).length > 0).length;

  console.log(
    `${all.length} asset(s) au-dessus de ${MAX_EDGE} px, dont ${orphans} orphelin(s) ignoré(s).\n` +
      `${targets.length} à réduire (${mo(targets.reduce((s, t) => s + t.size, 0))}).\n`
  );
  for (const t of targets) {
    const local = (await localMaster(t.originalFilename)) !== null;
    console.log(
      `  ${(t.originalFilename ?? t.assetId).padEnd(44)} ${`${t.width}×${t.height}`.padEnd(10)} ` +
        `${mo(t.size).padStart(8)}  ${local ? 'master local' : 'via CDN'}  → ${refsOf(t).length} doc(s)`
    );
  }
  if (!APPLY) {
    console.log('\nDry-run terminé. Relance avec --yes pour appliquer.');
    return;
  }

  const log: LogEntry[] = [];
  const stamp = new Date().toISOString().slice(0, 10);
  const logPath = path.resolve(process.cwd(), `resources/downsize-assets-${stamp}.json`);
  await fs.mkdir(path.dirname(logPath), { recursive: true });

  for (const [i, t] of targets.entries()) {
    const name = t.originalFilename ?? `${t.assetId}.jpg`;
    console.log(`\n[${i + 1}/${targets.length}] ${name}`);
    let source = await localMaster(t.originalFilename);
    let origin: LogEntry['source'] = 'portfolio';
    if (!source) {
      const res = await fetch(t.url);
      if (!res.ok) throw new Error(`${name} : HTTP ${res.status}`);
      source = Buffer.from(await res.arrayBuffer());
      origin = 'cdn';
    }

    const refs = refsOf(t);
    const year = refs.find((r) => r.year !== undefined)?.year;
    const prepared = await prepareForWeb(name, source, { year });
    const asset = await client.assets.upload('image', prepared.buffer, {
      filename: `${path.basename(name, path.extname(name))}.${prepared.ext}`,
      contentType: prepared.contentType,
    });

    for (const ref of refs) {
      await client.patch(ref.docId).set({ [ref.field]: asset._id }).commit();
    }
    console.log(
      `  ${prepared.from.w}×${prepared.from.h} ${mo(prepared.from.bytes)} → ` +
        `${prepared.to.w}×${prepared.to.h} ${Math.round(prepared.to.bytes / 1024)} Ko ` +
        `(${origin}) · ${refs.length} doc(s) repointé(s) → ${asset._id}`
    );

    log.push({ oldAssetId: t.assetId, newAssetId: asset._id, source: origin, from: prepared.from, to: prepared.to, patched: refs });
    // Journal écrit à CHAQUE pas : un plantage au 80ᵉ asset ne perd pas les 79.
    await fs.writeFile(logPath, JSON.stringify(log, null, 2));
  }

  console.log(`\n✓ ${log.length} asset(s) réduit(s). Journal : ${path.relative(process.cwd(), logPath)}`);
  console.log('Les anciens assets restent en base (orphelins). Leur purge est une décision à part.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
