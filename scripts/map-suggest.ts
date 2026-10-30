/**
 * JEV PROPOSE LES MÉCANISMES D'UN ARTICLE (journal-writing, étape « vault »).
 *
 *   npm run map:suggest -- <slug>          → écrit les propositions dans le vault
 *   npm run map:suggest -- <slug> --dry    → affiche seulement
 *   npm run map:suggest -- <slug> --eval   → calibrage : compare à ce qui est déjà validé
 *
 * Pour chaque thèse de l'article (`Thèses/<article>/`), Jev lit le passage
 * qu'elle couvre et dit, mécanisme par mécanisme, si le passage le mobilise.
 * Les meilleurs (p ≥ 0,7, quatre au plus) vont dans la propriété
 * `mecanismes_proposes` de la thèse, que `map:build` ne lit pas : Alexandre
 * valide en déplaçant le lien dans `mecanismes`, ou le supprime.
 *
 * Une proposition supprimée ne revient pas : `_jev/suggest-cache.json` garde
 * tout ce qui a déjà été proposé.
 */
import { createClient } from '@sanity/client';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MAP_BODY_GROQ, mapParagraphs, normalizeQuote, type MapBlock } from '../lib/journal/mapAnchors';
import { ask, JEV_DIR, jevConfigured, noulOf, spendLine, type Question } from './jev/client';
import { link, readVault, setProperties, str, target } from './jev/vault';

const args = process.argv.slice(2);
const SLUG = args.find((a) => !a.startsWith('--'));
const DRY = args.includes('--dry');
const EVAL = args.includes('--eval');
const YES = 0.7;
const MAX = 4;
const CACHE = path.join(JEV_DIR, 'suggest-cache.json');

async function main() {
  if (!SLUG) throw new Error('Usage : npm run map:suggest -- <slug> [--dry | --eval]');
  if (!jevConfigured()) throw new Error('TYPESAFE_API_KEY manquant (.env.local) : Jev non configuré');

  const notes = readVault();
  const mechanisms = notes.filter((n) => n.meta.type === 'mécanisme');
  const theses = notes
    .filter((n) => (n.meta.type === 'thèse' || n.meta.type === 'these') && str(n.meta.article_slug) === SLUG)
    .sort((a, b) => Number(a.meta.ordre) - Number(b.meta.ordre));
  if (!theses.length) throw new Error(`Aucune thèse pour « ${SLUG} » dans le vault : les créer d'abord (Thèses/<article>/)`);

  // L'article : le brouillon s'il existe (article pas encore publié), sinon la version publiée.
  const client = createClient({
    projectId: 'yh5i5diw',
    dataset: 'production',
    apiVersion: '2026-01-01',
    useCdn: false,
    token: process.env.SANITY_API_WRITE_TOKEN,
    perspective: 'raw',
  });
  const posts = await client.fetch<{ _id: string; title: string; body?: MapBlock[] }[]>(
    `*[_type == "post" && !defined(translationOf) && slug.current == $slug]{ _id, title, "body": ${MAP_BODY_GROQ} }`,
    { slug: SLUG },
  );
  const post = posts.find((p) => p._id.startsWith('drafts.')) ?? posts[0];
  const paras = mapParagraphs(post?.body);
  if (!post) console.warn(`⚠ « ${SLUG} » introuvable dans Sanity : Jev ne lira que le verdict et le résumé des thèses`);

  // Chaque thèse couvre son paragraphe et les suivants, jusqu'à la thèse suivante (comme map:build).
  const starts = theses.map((t) => {
    const q = normalizeQuote(str(t.meta.citation));
    return q ? paras.findIndex((p) => normalizeQuote(p.text).includes(q)) : -1;
  });
  const passageOf = (k: number) => {
    const i = starts[k];
    if (i < 0) return '';
    const end = starts.slice(k + 1).find((x) => x > i) ?? paras.length;
    return paras
      .slice(i, end)
      .map((p) => p.text)
      .join('\n\n')
      .slice(0, 9000);
  };

  const questions: Record<string, Question> = Object.fromEntries(
    mechanisms.map((m, i) => [
      `m${i}`,
      {
        type: 'noul',
        instructions: `Does the passage rely on this mechanism? « ${m.title} » : ${str(m.meta.definition)}`,
        criteria: {
          true: "The passage's argument uses or illustrates this mechanism, even in other words or about another subject",
          false: 'The passage argues something else; the mechanism is at most loosely related to its topic',
        },
      },
    ]),
  );

  const cache: Record<string, string[]> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  const hits: number[] = [];
  let total = 0;

  console.log(`map:suggest — ${post?.title ?? SLUG} (${theses.length} thèses, ${mechanisms.length} mécanismes)${EVAL ? ' · calibrage' : DRY ? ' · essai' : ''}\n`);
  for (const [k, t] of theses.entries()) {
    const state = {
      article: post?.title ?? SLUG,
      section: str(t.meta.section),
      thesis: str(t.meta.verdict),
      passage: passageOf(k) || str(t.meta.resume),
    };
    const answers = await ask(state, questions, 'map:suggest');
    const ranked = mechanisms.map((m, i) => ({ file: m.file, p: noulOf(answers[`m${i}`]) })).sort((a, b) => b.p - a.p);
    const listed = new Set(((t.meta.mecanismes as unknown[]) ?? []).map(target));
    const pendingNow = ((t.meta.mecanismes_proposes as unknown[]) ?? []).map(target);
    // Proposé un jour, ni validé ni encore en attente : Alexandre l'a supprimé.
    const rejected = new Set((cache[t.file] ?? []).filter((f) => !listed.has(f) && !pendingNow.includes(f)));

    console.log(`${t.file}`);
    if (EVAL) {
      // Ce qui est déjà validé sert de vérité : où Jev le place-t-il ?
      for (const f of listed) {
        const rank = ranked.findIndex((r) => r.file === f);
        const p = ranked[rank]?.p ?? NaN;
        total++;
        if (p >= YES) hits.push(p);
        console.log(`  ${p >= YES ? '✓' : '✗'} ${f} — p ${p.toFixed(2)}, rang ${rank + 1}`);
      }
      for (const r of ranked.filter((r) => !listed.has(r.file) && r.p >= YES).slice(0, MAX)) console.log(`  + ${r.file} — p ${r.p.toFixed(2)} (non listé)`);
      continue;
    }

    // Les MAX meilleurs, toujours les mêmes d'un passage à l'autre : relancer ne creuse pas plus loin.
    const top = ranked.filter((r) => r.p >= YES && !listed.has(r.file) && !rejected.has(r.file)).slice(0, MAX);
    const fresh = top.filter((r) => !pendingNow.includes(r.file));
    for (const r of fresh) console.log(`  + ${r.file} — p ${r.p.toFixed(2)}`);
    if (!fresh.length) console.log('  (rien de nouveau)');
    if (!listed.size && ranked[0].p < 0.5)
      console.log(`  ⚠ aucun mécanisme existant ne colle (meilleur : ${ranked[0].file}, p ${ranked[0].p.toFixed(2)}) → un mécanisme à créer ?`);

    if (!DRY && fresh.length) {
      const proposed = [...pendingNow, ...fresh.map((r) => r.file)];
      setProperties(t.path, { mecanismes_proposes: proposed.map(link) });
      cache[t.file] = [...(cache[t.file] ?? []), ...fresh.map((r) => r.file)];
    }
  }

  if (EVAL) console.log(`\nRappel à p ≥ ${YES} : ${hits.length}/${total} mécanismes validés retrouvés`);
  else if (!DRY) {
    writeFileSync(CACHE, JSON.stringify(cache, null, 1));
    console.log('\n→ propositions écrites dans `mecanismes_proposes` : valider dans Obsidian (déplacer vers `mecanismes`) ou supprimer');
  }
  console.log(spendLine());
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
