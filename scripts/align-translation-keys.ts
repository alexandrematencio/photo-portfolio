/**
 * Aligne les `_key` des traductions EN/RU sur ceux de leur article français
 * (2026-10-29, phase 1 de la Concept Map).
 *
 *   npm run align-translation-keys            → dry-run : ce qui changerait
 *   npm run align-translation-keys -- --yes   → écrit
 *
 * Pourquoi : le `_key` d'un bloc est l'ancre de son paragraphe (`#p-<clé>`),
 * et un même lien doit marcher dans les trois langues. `translate-post`
 * recopie les clés françaises depuis la traduction incrémentale ; les
 * traductions écrites AVANT (le 2026-10-18) portent des clés à elles
 * (`b0001`, `q000f`…).
 *
 * Seule la clé change : ni le texte, ni les retouches d'Alexandre. Un bloc
 * n'est re-clé que si les deux corps ont exactement la même structure (même
 * nombre de blocs, même type et même style à chaque rang) — c'est le cas
 * quand la traduction a été reconstruite depuis le français, et rien n'est
 * deviné sinon : l'article est signalé et laissé tel quel.
 *
 * Brouillon ET publié sont alignés : n'aligner que le publié ferait revenir
 * les anciennes clés au prochain Publish du brouillon.
 */
import { createClient } from '@sanity/client';

const APPLY = process.argv.includes('--yes');
const TOKEN = process.env.SANITY_API_WRITE_TOKEN;
if (APPLY && !TOKEN) throw new Error('SANITY_API_WRITE_TOKEN manquant (.env.local)');

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? 'yh5i5diw',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2026-01-01',
  token: TOKEN,
  useCdn: false,
  perspective: 'raw',
});

type Block = { _key: string; _type: string; style?: string };
type Doc = { _id: string; language?: string; slug?: string; src?: string; body?: Block[] };

const shape = (b: Block) => `${b._type}:${b.style ?? ''}`;

async function main() {
  const docs = await client.fetch<Doc[]>(
    `*[_type == "post"]{ _id, language, "slug": slug.current, "src": translationOf._ref, body }`,
  );
  const fr = new Map(docs.filter((d) => !d.src && !d._id.startsWith('drafts.')).map((d) => [d._id, d]));

  const tx = client.transaction();
  let changed = 0;
  for (const t of docs.filter((d) => d.src)) {
    const source = fr.get(t.src!);
    const label = `${t._id} (${t.language})`;
    if (!source?.body || !t.body) {
      console.log(`  – ${label} : pas de français publié, laissé tel quel`);
      continue;
    }
    if (t.body.map((b) => b._key).join() === source.body.map((b) => b._key).join()) {
      console.log(`  = ${label} : déjà aligné`);
      continue;
    }
    if (t.body.map(shape).join() !== source.body.map(shape).join()) {
      console.log(`  ✗ ${label} : structure différente du français (${t.body.length} blocs / ${source.body.length}), laissé tel quel`);
      continue;
    }
    const body = t.body.map((b, i) => ({ ...b, _key: source.body![i]._key }));
    tx.patch(t._id, (p) => p.set({ body }));
    changed++;
    console.log(`  → ${label} : ${body.length} blocs re-clés`);
  }

  if (!APPLY) {
    console.log(`\nDry-run : ${changed} document(s) à aligner. Relance avec \`-- --yes\` pour écrire.\n`);
    return;
  }
  if (changed) await tx.commit({ visibility: 'sync' });
  console.log(`\n✓ ${changed} document(s) alignés.\n`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
