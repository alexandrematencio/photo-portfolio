/**
 * Migration one-shot : pose `series.destination` ('series' | 'work') sur
 * chaque série, d'après ce que le site faisait jusqu'ici — une série listée
 * dans `workPage.collections` était un album Work, toutes les autres des
 * séries. Après ce script, le site se comporte EXACTEMENT comme avant ; la
 * différence est que l'appartenance se lit sur la série elle-même.
 *
 * Usage :
 *   npm run migrate-series-destination              → DRY-RUN (n'écrit rien)
 *   npm run migrate-series-destination -- --yes     → applique
 *
 * Idempotent : une série qui porte déjà une `destination` n'est pas touchée
 * (un choix fait depuis dans le Studio n'est jamais écrasé). Les brouillons
 * sont migrés comme les publiés — un brouillon sans destination rouvrirait le
 * formulaire sur un bouton radio vide.
 *
 * Ne touche NI aux photos, NI à `workPage.collections` (qui reste l'ordre des
 * onglets), NI aux slugs : les adresses /series/<slug> ne bougent pas.
 *
 * Ordre conseillé : déployer le Studio → lancer ce script → déployer le site.
 * Le site accepte pourtant l'ordre inverse (repli sur `workPage.collections`
 * tant qu'une série n'a pas de `destination`, cf. `splitSeriesAndWork`).
 * Une fois appliqué, ce repli peut être retiré.
 */

import { createClient } from '@sanity/client';
import { createInterface } from 'node:readline/promises';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;

const APPLY = process.argv.includes('--yes');

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
  // `raw` : brouillons ET publiés, chacun avec sa propre valeur.
  perspective: 'raw',
});

type Row = { _id: string; title: string | null; destination?: string | null };

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} (oui/non) `);
  rl.close();
  return ['oui', 'o', 'yes', 'y'].includes(answer.trim().toLowerCase());
}

const publishedId = (id: string) => id.replace(/^drafts\./, '');

async function main(): Promise<void> {
  const [rows, workIds] = await Promise.all([
    client.fetch<Row[]>(`*[_type == "series"] | order(title asc) { _id, title, destination }`),
    // Les références de `workPage.collections` pointent des ids PUBLIÉS. Le
    // brouillon de workPage (s'il existe) porte l'ordre en cours d'édition :
    // on prend les deux, une série n'est pas lâchée parce qu'un Publish traîne.
    client.fetch<(string | null)[]>(
      `*[_id in ["workPage", "drafts.workPage"]].collections[]._ref`
    ),
  ]);
  const inWork = new Set(workIds.filter((x): x is string => Boolean(x)));

  const toWork: Row[] = [];
  const toSeries: Row[] = [];
  const done: Row[] = [];
  for (const row of rows) {
    if (row.destination) done.push(row);
    else if (inWork.has(publishedId(row._id))) toWork.push(row);
    else toSeries.push(row);
  }

  // Références de la liste qui ne pointent plus aucune série : signalées, jamais corrigées.
  const known = new Set(rows.map((r) => publishedId(r._id)));
  const dangling = [...inWork].filter((id) => !known.has(id));

  console.log(`\n${APPLY ? 'MIGRATION' : 'DRY-RUN — aucune écriture'} · ${DATASET}\n`);
  console.log(`Documents série analysés (brouillons compris) : ${rows.length}`);
  console.log(`  · → Album Work (listés dans workPage.collections) : ${toWork.length}`);
  console.log(`  · → Série (page /series)                         : ${toSeries.length}`);
  console.log(`  · déjà une destination, ignorés                  : ${done.length}`);
  if (dangling.length > 0) {
    console.log(`  · ⚠️ entrées de workPage.collections sans série : ${dangling.length} (${dangling.join(', ')})`);
  }
  if (toWork.length > 0) {
    console.log('\nAlbums Work :');
    for (const r of toWork) console.log(`  • ${r.title ?? r._id}${r._id.startsWith('drafts.') ? ' (brouillon)' : ''}`);
  }

  const total = toWork.length + toSeries.length;
  if (total === 0) {
    console.log('\nRien à migrer.');
    return;
  }
  if (!APPLY) {
    console.log('\nDRY-RUN terminé. Relancer avec --yes pour appliquer.');
    return;
  }
  if (!(await confirm(`\nÉcrire la destination sur ${total} document(s) ?`))) {
    console.log('Annulé.');
    return;
  }

  let tx = client.transaction();
  let n = 0;
  const flush = async () => {
    if (n === 0) return;
    await tx.commit();
    tx = client.transaction();
    n = 0;
  };
  for (const [rows2, destination] of [[toWork, 'work'], [toSeries, 'series']] as const) {
    for (const r of rows2) {
      tx = tx.patch(r._id, (p) => p.setIfMissing({ destination }));
      if (++n >= 50) await flush();
    }
  }
  await flush();
  console.log(`\n✓ ${total} document(s) migré(s).`);
}

main().catch((err) => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
