/**
 * Import ONE-SHOT des articles du journal : `content/journal/*.md` → documents
 * `post` et `journalSeries` dans Sanity (schéma : sanity/schemas/journal.ts).
 *
 *   npm run import-journal                        → dry-run : ce qui serait écrit
 *   npm run import-journal -- --yes               → écrit les articles en BROUILLONS
 *   npm run import-journal -- --yes --publish     → écrit les articles publiés
 *   … -- --only <slug>                            → un seul fichier (les autres
 *     articles du dossier sont déjà dans le Studio : ne pas les écraser)
 *
 * En-tête facultatif : `tags: A, B` (thématiques existantes, par nom),
 * `cover: <chemin d'image>` et `coverAlt:` (couverture téléversée).
 *
 * Idempotent : `_id` déterministes (`post-<fichier>`, `journalSeries-<slug>`),
 * `createOrReplace`, en UNE transaction. Les blocs d'un article déjà présent
 * gardent leur `_key`, qui est l'ancre publique de leur paragraphe
 * (`lib/journal/stableKeys.ts`).
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
 * bilan de verdicts, `{{figure:loop}}`, `{{youtube:<id>|<titre>}}` (vidéo, affiche
 * = miniature YouTube téléversée dans Sanity), `[^clé]: référence`, et en ligne
 * **gras**, *emphase*, _titre d'œuvre_, ==surligné==, `[^clé]` (appel), `[question]`
 * (note à trancher ; seule sur sa ligne = paragraphe à trancher).
 */
import { createClient } from '@sanity/client';
import { randomBytes } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { reuseKeys, type KeyedBlock } from '../lib/journal/stableKeys';
import { prepareForWeb } from './prepare-image';

const PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const API_VERSION = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;
const APPLY = process.argv.includes('--yes');
const PUBLISH = process.argv.includes('--publish');
const DIR = path.join(process.cwd(), 'content/journal');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;

if (!PROJECT_ID) throw new Error('NEXT_PUBLIC_SANITY_PROJECT_ID manquant');
if (APPLY && !WRITE_TOKEN) throw new Error('SANITY_API_WRITE_TOKEN manquant (.env.local)');

const client = createClient({ projectId: PROJECT_ID, dataset: DATASET, apiVersion: API_VERSION, token: WRITE_TOKEN, useCdn: false });

type Span = { _type: 'span'; _key: string; text: string; marks: string[] };
type Child = Span | { _type: 'journalNoteRef'; _key: string; refKey: string } | { _type: 'journalDraftNote'; _key: string; text: string };
type Doc = Record<string, unknown> & { _id: string; _type: string };

// Clés aléatoires, plus positionnelles (2026-10-29) : la clé d'un bloc est
// l'ancre publique de son paragraphe. Un réimport reprend les clés de
// l'article existant (`reuseKeys`) ; seuls les blocs neufs gardent celle-ci.
const key = () => `k${randomBytes(5).toString('hex')}`;

/** Tout dépôt d'image passe par `prepareForWeb` (plafond 2048 px, signature) : CLAUDE.md §11.12. */
async function uploadImage(name: string, source: Buffer) {
  const prepared = await prepareForWeb(name, source);
  const asset = await client.assets.upload('image', prepared.buffer, {
    filename: `${path.basename(name, path.extname(name))}.${prepared.ext}`,
    contentType: prepared.contentType,
  });
  return { _type: 'image' as const, asset: { _type: 'reference' as const, _ref: asset._id } };
}

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
    else if (chunk.startsWith('{{youtube:')) {
      const v = chunk.match(/^\{\{youtube:([A-Za-z0-9_-]{11})\|([^}]+)\}\}$/);
      if (!v) throw new Error(`${file} : vidéo illisible « ${chunk} » (attendu {{youtube:<id>|<titre>}})`);
      body.push({ _type: 'journalVideo', _key: key(), videoId: v[1], title: v[2].trim() });
    }
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

  const files = readdirSync(DIR).filter((f) => f.endsWith('.md') && (!ONLY || f === `${ONLY}.md`)).sort();
  if (ONLY && !files.length) throw new Error(`--only ${ONLY} : content/journal/${ONLY}.md introuvable`);
  for (const file of files) {
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

    // L'article existe déjà (brouillon d'abord, sinon publié) : ses blocs
    // gardent leur clé, donc leurs ancres `#p-<clé>`.
    const existing = await client.fetch<{ body?: KeyedBlock[] } | null>(
      `coalesce(*[_id == $draft][0], *[_id == $id][0]){ body }`,
      { id: `post-${slug}`, draft: `drafts.post-${slug}` },
    );
    const kept = reuseKeys(body as KeyedBlock[], existing?.body ?? []);
    const reused = kept.filter((b) => (existing?.body ?? []).some((e) => e._key === b._key)).length;
    if (existing) report.push(`  ${slug.padEnd(34)} clés reprises : ${reused}/${kept.length}`);

    // Thématiques : par nom, parmi celles qui existent déjà (jamais créées ici).
    let tags: { _type: 'reference'; _ref: string; _key: string }[] | undefined;
    if (meta.tags) {
      const names = meta.tags.split(',').map((t) => t.trim()).filter(Boolean);
      const found = await client.fetch<{ _id: string; title: string }[]>(`*[_type == "journalTag" && title in $names && !(_id in path("drafts.**"))]{ _id, title }`, { names });
      const missing = names.filter((n) => !found.some((f) => f.title === n));
      if (missing.length) throw new Error(`${file} : thématique inconnue « ${missing.join(', ')} »`);
      tags = names.map((n) => ({ _type: 'reference', _ref: found.find((f) => f.title === n)!._id, _key: key() }));
    }

    // Affiches des vidéos (miniature YouTube) et couverture : téléversées
    // seulement avec --yes. Un réimport reprend l'affiche déjà posée.
    const prev = await client.fetch<{ body?: { _type: string; videoId?: string; poster?: unknown }[]; cover?: unknown } | null>(
      `coalesce(*[_id == $draft][0], *[_id == $id][0]){ body, cover }`,
      { id: `post-${slug}`, draft: `drafts.post-${slug}` },
    );
    for (const b of body as { _type: string; videoId?: string; poster?: unknown }[]) {
      if (b._type !== 'journalVideo') continue;
      const old = prev?.body?.find((o) => o._type === 'journalVideo' && o.videoId === b.videoId)?.poster;
      if (old) b.poster = old;
      else if (APPLY) {
        for (const q of ['maxresdefault', 'hqdefault']) {
          const res = await fetch(`https://i.ytimg.com/vi/${b.videoId}/${q}.jpg`);
          if (!res.ok) continue;
          b.poster = await uploadImage(`youtube-${b.videoId}.jpg`, Buffer.from(await res.arrayBuffer()));
          break;
        }
      }
    }
    let cover: unknown = prev?.cover;
    if (meta.cover && APPLY) {
      const file = path.resolve(DIR, meta.cover);
      cover = { ...(await uploadImage(file, readFileSync(file))), ...(meta.coverAlt ? { alt: meta.coverAlt } : {}) };
    }

    docs.push({
      _id: `${PUBLISH ? '' : 'drafts.'}post-${slug}`,
      _type: 'post',
      title: meta.title,
      dek: meta.dek,
      slug: { _type: 'slug', current: slug },
      date: meta.date,
      ...(series ? { series, part: Number(meta.part) } : {}),
      body: kept,
      references,
      ...(meta.referencesNote ? { referencesNote: meta.referencesNote } : {}),
      ...(tags ? { tags } : {}),
      ...(cover ? { cover } : {}),
    });

    const count = (t: string) => (flat.match(new RegExp(`"_type":"${t}"`, 'g')) ?? []).length;
    report.push(
      `  ${slug.padEnd(34)} ${String(count('block')).padStart(3)} blocs · ${count('journalPullQuote')} citations · ` +
        `${count('journalNoteRef')} appels / ${references.length} réf. · ${count('journalDraftNote') + count('journalDraftBlock')} à trancher · ` +
        `${count('journalTable')} tableau · ${count('journalVerdicts')} bilan · ${count('journalFigure')} figure · ${count('journalVideo')} vidéo`,
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
