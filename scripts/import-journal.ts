/**
 * Import ONE-SHOT des articles du journal : `content/journal/*.md` → documents
 * `post` et `journalSeries` dans Sanity (schéma : sanity/schemas/journal.ts).
 *
 *   npm run import-journal                        → dry-run : ce qui serait écrit
 *   npm run import-journal -- --yes               → écrit les articles en BROUILLONS
 *   npm run import-journal -- --yes --publish     → écrit les articles publiés
 *
 * Idempotent : `_id` déterministes (`post-<fichier>`, `journalSeries-<slug>`),
 * `createOrReplace`, en UNE transaction.
 *
 * **Brouillons par défaut** (décision Alexandre, 2026-10-17) : le dataset est
 * en lecture publique, un article publié est donc lisible par l'API, notes
 * « à trancher » comprises. Un brouillon (`drafts.post-…`) ne l'est pas ; il se
 * relit dans le Studio et se publie d'un clic. Les SÉRIES sont écrites
 * publiées : elles ne portent qu'un titre, et une référence vers un brouillon
 * déclenche un avertissement dans le Studio.
 *
 * Joué le 2026-10-17 (articles en brouillons), puis `content/journal/` a été
 * supprimé : le Studio est la seule source de vérité (§8.5). Le script reste
 * comme trace et pour un futur import de brouillons Markdown — il lit le
 * dossier s'il existe.
 *
 * Markdown accepté (celui des brouillons d'Alexandre) : en-tête `---`
 * (title, dek, series, part, date, referencesNote), `## intertitre`,
 * `> citation en exergue`, tableaux `|`, tableau à colonne « Famille » =
 * bilan de verdicts, `{{figure:loop}}`, `[^clé]: référence`, et en ligne
 * **gras**, *emphase*, _titre d'œuvre_, ==surligné==, `[^clé]` (appel), `[question]`
 * (note à trancher ; seule sur sa ligne = paragraphe à trancher).
 */
import { createClient } from '@sanity/client';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;
const APPLY = process.argv.includes('--yes');
const PUBLISH = process.argv.includes('--publish');
const DIR = path.join(process.cwd(), 'content/journal');

if (!PROJECT_ID) throw new Error('NEXT_PUBLIC_SANITY_PROJECT_ID manquant');
if (APPLY && !WRITE_TOKEN) throw new Error('SANITY_API_WRITE_TOKEN manquant (.env.local)');

const client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: API_VERSION, token: WRITE_TOKEN, useCdn: false });

type Span = { _type: 'span'; _key: string; text: string; marks: string[] };
type Child = Span | { _type: 'journalNoteRef'; _key: string; refKey: string } | { _type: 'journalDraftNote'; _key: string; text: string };
type Doc = Record<string, unknown> & { _id: string; _type: string };

let seq = 0;
const key = () => `k${(seq++).toString(36)}`;

function slugify(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const INLINE = /(==[^=]+==|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_]+_|\[\^[a-z0-9]+\]|\[[^\]^][^\]]*\])/g;

function children(text: string, marks: string[] = []): Child[] {
  const out: Child[] = [];
  for (const part of text.split(INLINE).filter(Boolean)) {
    if (part.length > 4 && part.startsWith('==') && part.endsWith('==')) out.push(...children(part.slice(2, -2), [...marks, 'highlight']));
    else if (part.startsWith('**')) out.push(...children(part.slice(2, -2), [...marks, 'strong']));
    else if (part.startsWith('[^')) out.push({ _type: 'journalNoteRef', _key: key(), refKey: part.slice(2, -1) });
    else if (part.startsWith('[') && part.endsWith(']')) out.push({ _type: 'journalDraftNote', _key: key(), text: part.slice(1, -1) });
    else if (part.length > 2 && part.startsWith('_') && part.endsWith('_')) out.push(...children(part.slice(1, -1), [...marks, 'cite']));
    else if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) out.push(...children(part.slice(1, -1), [...marks, 'em']));
    else out.push({ _type: 'span', _key: key(), text: part, marks });
  }
  return out;
}

const block = (style: string, text: string) => ({ _type: 'block', _key: key(), style, markDefs: [], children: children(text) });
const cells = (line: string) => line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

function parse(file: string) {
  const raw = readFileSync(path.join(DIR, file), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file} : en-tête manquant`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }

  const body: unknown[] = [];
  const references: { _key: string; _type: string; citation: unknown[] }[] = [];
  for (const chunk of raw.slice(m[0].length).split(/\n{2,}/).map((c) => c.trim()).filter(Boolean)) {
    if (chunk.startsWith('## ')) body.push(block('h2', chunk.slice(3)));
    else if (chunk.startsWith('> ')) body.push({ _type: 'journalPullQuote', _key: key(), text: chunk.slice(2) });
    else if (chunk === '{{figure:loop}}') body.push({ _type: 'journalFigure', _key: key(), figure: 'loop' });
    else if (chunk.startsWith('[^')) {
      for (const line of chunk.split('\n')) {
        const r = line.match(/^\[\^([a-z0-9]+)\]:\s*(.+)$/);
        if (!r) throw new Error(`${file} : référence illisible « ${line} »`);
        references.push({ _key: r[1], _type: 'journalReference', citation: [block('normal', r[2])] });
      }
    } else if (chunk.startsWith('|')) {
      const [head, ...rows] = chunk.split('\n').filter((l) => !/^\|[\s|:-]+\|$/.test(l)).map(cells);
      if (head[head.length - 1] === 'Famille') {
        body.push({
          _type: 'journalVerdicts',
          _key: key(),
          rows: rows.map(([idea, prior, verdict, kind]) => ({ _type: 'journalVerdict', _key: key(), idea, prior, verdict, kind })),
        });
      } else {
        body.push({ _type: 'journalTable', _key: key(), head, rows: rows.map((c) => ({ _type: 'journalTableRow', _key: key(), cells: c })) });
      }
    } else if (/^\[[^\]^][^\]]*\]$/.test(chunk)) body.push({ _type: 'journalDraftBlock', _key: key(), text: chunk.slice(1, -1) });
    else body.push(block('normal', chunk.replace(/\n/g, ' ')));
  }
  return { meta, body, references };
}

async function main() {
  const docs: Doc[] = [];
  const seriesIds = new Map<string, string>();
  const report: string[] = [];

  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()) {
    const slug = file.replace(/\.md$/, '');
    const { meta, body, references } = parse(file);
    for (const k of ['title', 'dek', 'date']) if (!meta[k]) throw new Error(`${file} : « ${k} » manquant`);

    // Contrôles : chaque appel a sa référence, chaque citation est dans le texte.
    const flat = JSON.stringify(body);
    const keys = new Set(references.map((r) => r._key));
    for (const [, k] of flat.matchAll(/"refKey":"([a-z0-9]+)"/g)) {
      if (!keys.has(k)) throw new Error(`${file} : appel sans référence « ${k} »`);
    }
    const text = (body as { _type: string; children?: { text?: string }[] }[])
      .filter((b) => b._type === 'block')
      .map((b) => (b.children ?? []).map((c) => c.text ?? '').join(''))
      .join(' ')
      .toLowerCase();
    for (const q of body as { _type: string; text?: string }[]) {
      if (q._type === 'journalPullQuote' && !text.includes(q.text!.toLowerCase().replace(/\.$/, ''))) {
        throw new Error(`${file} : citation absente du texte « ${q.text} »`);
      }
    }

    let series: { _type: 'reference'; _ref: string } | undefined;
    if (meta.series) {
      const id = `journalSeries-${slugify(meta.series)}`;
      if (!seriesIds.has(meta.series)) {
        seriesIds.set(meta.series, id);
        docs.push({ _id: id, _type: 'journalSeries', title: meta.series, slug: { _type: 'slug', current: slugify(meta.series) } });
      }
      series = { _type: 'reference', _ref: id };
    }

    docs.push({
      _id: `${PUBLISH ? '' : 'drafts.'}post-${slug}`,
      _type: 'post',
      title: meta.title,
      dek: meta.dek,
      slug: { _type: 'slug', current: slug },
      date: meta.date,
      ...(series ? { series, part: Number(meta.part) } : {}),
      body,
      references,
      ...(meta.referencesNote ? { referencesNote: meta.referencesNote } : {}),
    });

    const count = (t: string) => (flat.match(new RegExp(`"_type":"${t}"`, 'g')) ?? []).length;
    report.push(
      `  ${slug.padEnd(34)} ${String(count('block')).padStart(3)} blocs · ${count('journalPullQuote')} citations · ` +
        `${count('journalNoteRef')} appels / ${references.length} réf. · ${count('journalDraftNote') + count('journalDraftBlock')} à trancher · ` +
        `${count('journalTable')} tableau · ${count('journalVerdicts')} bilan · ${count('journalFigure')} figure`,
    );
  }

  console.log(`\nDataset ${PROJECT_ID}/${DATASET} — ${docs.length} documents :\n`);
  console.log(`  Séries : ${[...seriesIds.keys()].join(', ')}`);
  console.log(report.join('\n'));

  if (!APPLY) {
    console.log(`\nDry-run terminé. Relance avec \`-- --yes\` pour écrire (articles en ${PUBLISH ? 'PUBLIÉS' : 'BROUILLONS'}).\n`);
    return;
  }
  const tx = client.transaction();
  for (const d of docs) tx.createOrReplace(d);
  await tx.commit({ visibility: 'sync' });
  console.log(`\n✓ ${docs.length} documents écrits (articles en ${PUBLISH ? 'publiés' : 'brouillons'}).\n`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
