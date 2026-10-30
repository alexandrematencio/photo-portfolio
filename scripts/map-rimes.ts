/**
 * JEV CHERCHE LES RIMES ENTRE MÉCANISMES (même structure sous deux habits).
 *
 *   npm run map:rimes           → écrit les nouvelles rimes `proposée` dans le vault
 *   npm run map:rimes -- --dry  → affiche seulement
 *
 * Chaque paire est jugée dans les deux sens (A lu, B en question ; puis
 * l'inverse) et la moyenne fait foi. Seules les paires jamais jugées sont
 * envoyées : `_jev/rimes-cache.json` garde les probabilités, indexées par
 * l'empreinte des définitions — un mécanisme réécrit est rejugé, les autres
 * ne coûtent plus rien.
 *
 * Une rime retenue (p ≥ 0,75, huit au plus par passage) est écrite sur la
 * note du premier mécanisme (ordre alphabétique) avec `statut: "proposée"`,
 * `source: "jev"`, et un `pourquoi` vide : Claude l'écrit en la présentant,
 * Alexandre la passe en `validée` ou la supprime. Une rime supprimée ne
 * revient pas.
 *
 * Signale aussi les doublons probables (deux noms pour la même idée).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ask, JEV_DIR, jevConfigured, noulOf, spendLine, type Question } from './jev/client';
import { link, readVault, setProperties, str, target, type Note } from './jev/vault';

const DRY = process.argv.includes('--dry');
const YES = 0.75;
const DUPLICATE = 0.7;
const MAX = 8;
const CACHE = path.join(JEV_DIR, 'rimes-cache.json');

type Cache = { judged: Record<string, { rhyme: number; duplicate: number }>; proposed: string[] };

const print = (m: Note) => createHash('sha1').update(`${m.title}\n${str(m.meta.definition)}`).digest('hex').slice(0, 10);
const pairKey = (a: string, b: string) => [a, b].sort().join('↔');

async function main() {
  if (!jevConfigured()) throw new Error('TYPESAFE_API_KEY manquant (.env.local) : Jev non configuré');
  const mechanisms = readVault()
    .filter((n) => n.meta.type === 'mécanisme')
    .sort((a, b) => a.file.localeCompare(b.file, 'fr'));
  const byFile = new Map(mechanisms.map((m) => [m.file, m]));
  const cache: Cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : { judged: {}, proposed: [] };

  // Paires déjà reliées, dans un sens ou dans l'autre, quel que soit le statut.
  const linked = new Set<string>();
  for (const m of mechanisms) for (const r of (m.meta.rimes as Record<string, unknown>[]) ?? []) linked.add(pairKey(m.file, target(r.avec)));

  // Une requête par mécanisme lu, avec toutes les paires dirigées qui manquent au cache.
  const directed = (a: Note, b: Note) => `${print(a)}→${print(b)}`;
  let asked = 0;
  for (const a of mechanisms) {
    const others = mechanisms.filter((b) => b !== a && !linked.has(pairKey(a.file, b.file)) && !cache.judged[directed(a, b)]);
    if (!others.length) continue;
    const questions: Record<string, Question> = {};
    others.forEach((b, i) => {
      const other = `« ${b.title} » : ${str(b.meta.definition)}`;
      questions[`r${i}`] = {
        type: 'noul',
        instructions: `Is this other mechanism the same underlying structure as the mechanism in the state, seen in a different domain? ${other}`,
        criteria: {
          true: 'Same causal structure (same forces, same sequence, same outcome), even though the subject matter differs',
          false: 'They only share a topic, a word or a mood; the way things happen is different',
        },
      };
      questions[`d${i}`] = {
        type: 'noul',
        instructions: `Is this other mechanism the same idea as the mechanism in the state, only named differently? ${other}`,
      };
    });
    const answers = await ask({ mechanism: a.title, definition: str(a.meta.definition), quote: str(a.meta.citation) }, questions, 'map:rimes');
    others.forEach((b, i) => {
      cache.judged[directed(a, b)] = { rhyme: noulOf(answers[`r${i}`]), duplicate: noulOf(answers[`d${i}`]) };
    });
    asked += others.length;
    writeFileSync(CACHE, JSON.stringify(cache));
  }

  // Les deux sens, en moyenne.
  const pairs: { a: Note; b: Note; rhyme: number; duplicate: number }[] = [];
  for (const [i, a] of mechanisms.entries())
    for (const b of mechanisms.slice(i + 1)) {
      const ab = cache.judged[directed(a, b)];
      const ba = cache.judged[directed(b, a)];
      if (!ab || !ba || linked.has(pairKey(a.file, b.file))) continue;
      pairs.push({ a, b, rhyme: (ab.rhyme + ba.rhyme) / 2, duplicate: (ab.duplicate + ba.duplicate) / 2 });
    }

  const proposed = new Set(cache.proposed);
  // File d'attente : jamais plus de MAX rimes de Jev en attente de relecture.
  const waiting = mechanisms.flatMap((m) => ((m.meta.rimes as Record<string, unknown>[]) ?? []).filter((r) => r.source === 'jev' && r.statut === 'proposée')).length;
  const duplicates = pairs.filter((p) => p.duplicate >= DUPLICATE).sort((x, y) => y.duplicate - x.duplicate);
  const dupKeys = new Set(duplicates.map((p) => pairKey(p.a.file, p.b.file)));
  const fresh = pairs
    .filter((p) => p.rhyme >= YES && !dupKeys.has(pairKey(p.a.file, p.b.file)) && !proposed.has(pairKey(p.a.file, p.b.file)))
    .sort((x, y) => y.rhyme - x.rhyme)
    .slice(0, Math.max(0, MAX - waiting));

  console.log(`map:rimes — ${mechanisms.length} mécanismes, ${asked} paires dirigées jugées ce passage, ${pairs.length} paires non reliées\n`);
  if (waiting >= MAX) console.log(`${waiting} rimes de Jev attendent déjà une relecture : rien de neuf tant qu'elles ne sont pas validées ou supprimées.`);
  else console.log(fresh.length ? `Rimes proposées (${fresh.length}) :` : 'Aucune nouvelle rime au-dessus du seuil.');
  for (const p of fresh) console.log(`  ${p.a.file} ↔ ${p.b.file} — p ${p.rhyme.toFixed(2)}`);
  if (duplicates.length) {
    console.log(`\nDoublons probables (${duplicates.length}) — fusionner ou distinguer les définitions :`);
    for (const p of duplicates.slice(0, 15)) console.log(`  ${p.a.file} = ${p.b.file} — p ${p.duplicate.toFixed(2)}`);
    if (duplicates.length > 15) console.log(`  … et ${duplicates.length - 15} autres (seuil à revoir s'il y en a autant)`);
  }

  if (!DRY && fresh.length) {
    for (const p of fresh) {
      const note = byFile.get(p.a.file)!;
      const rimes = (note.meta.rimes as Record<string, unknown>[]) ?? [];
      rimes.push({ avec: link(p.b.file), statut: 'proposée', pourquoi: '', source: 'jev', p: Math.round(p.rhyme * 100) / 100 });
      note.meta.rimes = rimes;
      setProperties(note.path, { rimes });
      cache.proposed.push(pairKey(p.a.file, p.b.file));
    }
    writeFileSync(CACHE, JSON.stringify(cache));
    console.log('\n→ rimes écrites avec `pourquoi` vide : à rédiger, puis à valider (`validée`) ou supprimer dans Obsidian');
  }
  console.log(spendLine());
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
