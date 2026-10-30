/**
 * JEV RANGE LE DUMP DU BLOG (`Graphe-du-journal/_dump/`).
 *
 *   npm run dump:file           → range les notes pas encore rangées
 *   npm run dump:file -- --dry  → affiche seulement
 *
 * Alexandre jette ses notes brutes dans `_dump/` (une note par idée, depuis
 * Obsidian). Pour chacune, Jev dit où elle va :
 *
 *   backlog    une entrée existante de `BLOG/BACKLOG.md` → une ligne de matière y est ajoutée ;
 *   dossier    un dossier d'article (`BLOG/NN-…/`) → une ligne dans son `DUMP.md` ;
 *   vault      un mécanisme ou une thèse du vault → lien dans sa propriété `dump` ;
 *   nouveau    une idée d'article neuve → nouvelle entrée en haut du backlog, « à titrer » ;
 *   hors blog  rien à voir avec le journal (perso, psycho, AAXLO) → laissée telle quelle.
 *
 * La note n'est jamais déplacée ni modifiée dans son texte : elle reçoit
 * `rangé`, `rangé_le` et `p`. Sous 0,5 de confiance, elle reste non rangée et
 * est listée « à trancher ». Les fichiers qui commencent par `_` sont ignorés.
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ask, jevConfigured, spendLine, type Answer, type Question } from './jev/client';
import { link, readVault, setProperties, str, VAULT } from './jev/vault';

const DRY = process.argv.includes('--dry');
const BLOG = path.dirname(VAULT);
const DUMP = path.join(VAULT, '_dump');
const BACKLOG = path.join(BLOG, 'BACKLOG.md');
const SURE = 0.5;
const today = new Date().toISOString().slice(0, 10);

const choiceOf = (a: Answer | undefined) => (a?.type === 'choice' ? a : null);

/** Les entrées du backlog : leur titre (`## …`) et leur premier paragraphe, qui dit l'idée. */
function backlogEntries() {
  if (!existsSync(BACKLOG)) return [];
  return readFileSync(BACKLOG, 'utf8')
    .split(/^(?=## )/m)
    .filter((s) => s.startsWith('## '))
    .map((s) => {
      const title = s.split('\n')[0].slice(3).trim();
      const idea = s.match(/\*\*L'idée\.\*\*\s*([\s\S]*?)(?:\n\n|$)/)?.[1]?.replace(/\s+/g, ' ') ?? '';
      return { title, idea: idea.slice(0, 400) };
    });
}

/** Les dossiers d'article (`01-marches-de-collection`…) et les articles qu'ils contiennent. */
function articleFolders() {
  return readdirSync(BLOG, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d\d-/.test(e.name))
    .map((e) => {
      const files = readdirSync(path.join(BLOG, e.name)).filter((f) => /^article.*\.md$/.test(f));
      return { name: e.name, articles: files.map((f) => f.replace(/^article-?(v\d+-)?|\.md$/g, '')).join(', ') };
    });
}

/** Ajoute une ligne à la fin d'une entrée du backlog (avant l'entrée suivante). */
function appendToBacklog(title: string, line: string) {
  const raw = readFileSync(BACKLOG, 'utf8');
  const start = raw.indexOf(`## ${title}`);
  const next = raw.slice(start + 3).search(/^(?:## |---$)/m);
  const at = next < 0 ? raw.length : start + 3 + next;
  writeFileSync(BACKLOG, raw.slice(0, at).trimEnd() + `\n\n${line}\n\n` + raw.slice(at));
}

function newBacklogEntry(note: string, excerpt: string) {
  const raw = readFileSync(BACKLOG, 'utf8');
  const at = raw.indexOf('\n---\n') + 5;
  const entry = `\n## À titrer — dump du ${today}\n\n**L'idée.** ${excerpt}\n\n**Matière déjà disponible.**\n- \`Graphe-du-journal/_dump/${note}.md\`\n\n**Ce qui manque avant d'écrire.**\n- L'angle en une phrase.\n\n---\n`;
  writeFileSync(BACKLOG, raw.slice(0, at) + entry + raw.slice(at));
}

async function main() {
  if (!jevConfigured()) throw new Error('TYPESAFE_API_KEY manquant (.env.local) : Jev non configuré');
  mkdirSync(DUMP, { recursive: true });
  const pending = readdirSync(DUMP)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => {
      const raw = readFileSync(path.join(DUMP, f), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
      const meta = (m ? parseYaml(m[1]) : {}) ?? {};
      return { file: f.slice(0, -3), path: path.join(DUMP, f), text: (m ? raw.slice(m[0].length) : raw).trim(), meta };
    })
    .filter((n) => !n.meta.rangé && n.text);
  if (!pending.length) {
    console.log('dump:file — rien à ranger.');
    return;
  }

  const backlog = backlogEntries();
  const folders = articleFolders();
  const vault = readVault();
  const mechanisms = vault.filter((n) => n.meta.type === 'mécanisme');
  const theses = vault.filter((n) => n.meta.type === 'thèse' || n.meta.type === 'these');

  // Une seule requête par note : la catégorie, et, par spéculation, la cible dans chaque catégorie.
  const questions: Record<string, Question> = {
    blog: {
      type: 'noul',
      instructions: "Is this note material for Alexandre's blog (an essay journal on markets, society, cognition), rather than private life, therapy notes or client work?",
    },
    kind: {
      type: 'choice',
      instructions: 'Where does this note belong in the blog workflow?',
      criteria: {
        backlog: 'Feeds an article idea already listed in the backlog',
        folder: 'Feeds an article series or draft already in progress',
        vault: 'Adds an example, case or nuance to one existing mechanism or thesis',
        new_idea: 'Starts an article idea that none of the existing ones covers',
      },
    },
  };
  if (backlog.length)
    questions.backlog = { type: 'choice', instructions: 'Which backlog entry does this note feed?', criteria: Object.fromEntries(backlog.map((b) => [b.title, b.idea || null])) };
  if (folders.length)
    questions.folder = { type: 'choice', instructions: 'Which article series does this note feed?', criteria: Object.fromEntries(folders.map((f) => [f.name, f.articles || null])) };
  questions.mechanism = {
    type: 'choice',
    instructions: 'Which mechanism does this note illustrate or nuance?',
    criteria: Object.fromEntries(mechanisms.slice(0, 255).map((m) => [m.file, str(m.meta.definition).slice(0, 200)])),
  };
  questions.thesis = {
    type: 'choice',
    instructions: 'Which thesis does this note illustrate or nuance?',
    criteria: Object.fromEntries(theses.slice(0, 255).map((t) => [t.file, str(t.meta.verdict)])),
  };
  questions.mechanism_rather = { type: 'noul', instructions: 'Is this note more about a general mechanism than about one specific claim of one article?' };

  const undecided: string[] = [];
  console.log(`dump:file — ${pending.length} note(s) à ranger${DRY ? ' · essai' : ''}\n`);
  for (const n of pending) {
    const a = await ask({ note: n.text.slice(0, 12000) }, questions, 'dump:file');
    const blog = a.blog?.type === 'noul' ? a.blog.noul : 0;
    const kind = choiceOf(a.kind);
    let dest = '';
    let p = 0;

    if (blog < 0.3) [dest, p] = ['hors blog', 1 - blog];
    else if (blog < 0.7 || !kind || kind.confidence < SURE) undecided.push(n.file);
    else if (kind.choice === 'new_idea') [dest, p] = ['nouveau', kind.confidence];
    else {
      const sub = choiceOf(
        a[kind.choice === 'vault' ? ((a.mechanism_rather as { noul: number }).noul >= 0.5 ? 'mechanism' : 'thesis') : kind.choice],
      );
      if (!sub || sub.confidence < SURE) undecided.push(n.file);
      else [dest, p] = [`${kind.choice === 'vault' ? 'vault' : kind.choice}:${sub.choice}`, Math.min(kind.confidence, sub.confidence)];
    }
    if (!dest) {
      console.log(`  ? ${n.file} — à trancher`);
      continue;
    }
    console.log(`  → ${n.file} : ${dest} (p ${p.toFixed(2)})`);
    if (DRY) continue;

    const excerpt = n.text.replace(/\s+/g, ' ').slice(0, 160) + (n.text.length > 160 ? '…' : '');
    const [type, where] = [dest.split(':')[0], dest.slice(dest.indexOf(':') + 1)];
    if (type === 'backlog') appendToBacklog(where, `- Dump du ${today} : \`Graphe-du-journal/_dump/${n.file}.md\` — ${excerpt}`);
    else if (type === 'folder') appendFileSync(path.join(BLOG, where, 'DUMP.md'), `- ${today} · \`Graphe-du-journal/_dump/${n.file}.md\` — ${excerpt}\n`);
    else if (type === 'vault') {
      const note = vault.find((v) => v.file === where)!;
      setProperties(note.path, { dump: [...((note.meta.dump as string[]) ?? []), link(n.file)] });
    } else if (type === 'nouveau') newBacklogEntry(n.file, excerpt);
    setProperties(n.path, { rangé: type === 'vault' ? link(where) : dest, rangé_le: today, p: Math.round(p * 100) / 100 });
  }
  if (undecided.length) console.log(`\nÀ trancher (${undecided.length}) : ${undecided.join(', ')} — restent dans _dump, non rangées`);
  console.log(spendLine());
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
