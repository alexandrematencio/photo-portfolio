/**
 * EXPORT DE LA CONCEPT MAP (phase 2, docs/superpowers/plans/2026-10-28-journal-map.md).
 *
 *   npm run map:build              → lit le vault, écrit .concept-map/ et affiche le rapport
 *   npm run map:build -- --strict  → échoue si une citation ne se retrouve pas
 *   npm run map:build -- --write   → écrit aussi le BROUILLON `drafts.journalMap`
 *                                    (SANITY_API_WRITE_TOKEN), à relire et publier
 *                                    dans le Studio (Journal ▸ Concept Map)
 *
 * Le vault Obsidian fait foi (`JOURNAL_VAULT`, par défaut
 * ~/Documents/ALEX-PERSO/BLOG/Graphe-du-journal) : on y corrige les thèses,
 * les mécanismes et les rimes, ce script n'en est que la sortie. Il lit les
 * PROPRIÉTÉS des notes (frontmatter), jamais leur texte.
 *
 * Ce qui sort, et rien d'autre — le filtre est ici, dans le code, pas dans
 * un réglage : le dépôt et la carte sont publics.
 * - articles (titre, série, thématiques) ;
 * - thèses `public` ≠ false : verdict et citation exacte, plus l'ancre ;
 * - mécanismes `public` ≠ false employés par au moins une thèse sortie ;
 * - rimes `écrite` ou `validée` entre deux mécanismes sortis.
 * Jamais : vécu, questions, références et verdicts, cas, rimes `proposée`,
 * résumés de thèses (paraphrases de Claude).
 *
 * L'ancre d'une thèse est le `_key` du paragraphe qui contient sa citation
 * dans l'article FRANÇAIS publié (les traductions portent les mêmes clés,
 * cf. `align-translation-keys`). Une thèse couvre ce paragraphe et les
 * suivants, jusqu'à l'ancre de la thèse suivante : c'est ce qui permettra,
 * en lisant, de retrouver « où l'on est » dans la carte.
 *
 * Mise en page calculée ici (ForceAtlas2, départ déterministe) et repartant
 * des positions du dernier export : la carte ne tremble pas, et un article
 * ajouté ne chamboule pas ce qui était déjà placé.
 */
import { createClient } from '@sanity/client';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import { parse as parseYaml } from 'yaml';
import { mapParagraphs, normalizeQuote as normalize, type MapBlock } from '../lib/journal/mapAnchors';
import { JOURNAL_MAP_ID, JOURNAL_MAP_QUERY, type JournalMapDoc } from '../lib/journal/conceptMap';

const STRICT = process.argv.includes('--strict');
const WRITE = process.argv.includes('--write');
const VAULT = process.env.JOURNAL_VAULT ?? path.join(homedir(), 'Documents/ALEX-PERSO/BLOG/Graphe-du-journal');
const OUT_DIR = path.join(process.cwd(), '.concept-map');
const OUT = path.join(OUT_DIR, 'concept-map.json');

// ---------- le vault ----------

type Note = { file: string; folder: string; meta: Record<string, unknown>; title: string };

function readVault(dir: string, rel = ''): Note[] {
  const notes: Note[] = [];
  for (const entry of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_archive') continue;
    const r = path.join(rel, entry.name);
    if (entry.isDirectory()) notes.push(...readVault(dir, r));
    else if (entry.name.endsWith('.md')) {
      const raw = readFileSync(path.join(dir, r), 'utf8');
      const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
      const meta = (m ? parseYaml(m[1]) : {}) ?? {};
      const h1 = raw.match(/^# (.+)$/m)?.[1]?.trim();
      const file = entry.name.slice(0, -3);
      notes.push({ file, folder: rel.split(path.sep)[0], meta, title: h1 ?? file });
    }
  }
  return notes;
}

/** `[[fichier|alias]]` → `fichier`. */
const target = (link: unknown) => String(link).replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const isPublic = (n: Note) => n.meta.public !== false;

// ---------- les articles publiés ----------

type Post = { slug: string; title: string; body: MapBlock[] };

const fingerprint = (s: string) => createHash('sha1').update(normalize(s)).digest('hex').slice(0, 10);
const paragraphs = (post: Post) => mapParagraphs(post.body);

// ---------- le modèle exporté ----------

export type MapNode =
  | { id: string; kind: 'article'; label: string; slug: string; series: string | null; part: number | null; themes: string[]; x: number; y: number }
  | {
      id: string;
      kind: 'thesis';
      label: string;
      article: string;
      order: number;
      quote: string;
      /** Paragraphe de la citation ; `null` si elle ne se retrouve plus (le lien retombe sur l'article). */
      anchor: string | null;
      /** Paragraphes couverts, de l'ancre jusqu'à la thèse suivante. */
      covers: string[];
      /** Empreinte du texte du paragraphe d'ancre au moment de l'export (garde de dérive, phase 3). */
      print: string | null;
      /** `_key` de l'intertitre qui précède l'ancre : le repli du lien si le paragraphe disparaît. */
      section: string | null;
      x: number;
      y: number;
    }
  | { id: string; kind: 'mechanism'; label: string; definition: string; quote: string; quoteArticle: string; anchor: string | null; section: string | null; x: number; y: number };

export type MapEdge = { source: string; target: string; kind: 'part' | 'next' | 'uses' | 'rhyme'; why?: string };

async function main() {
  if (!existsSync(VAULT)) throw new Error(`Vault introuvable : ${VAULT} (JOURNAL_VAULT)`);
  const notes = readVault(VAULT);
  const byFile = new Map(notes.map((n) => [n.file, n]));
  const of = (type: string) => notes.filter((n) => n.meta.type === type);

  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (WRITE && !token) throw new Error('SANITY_API_WRITE_TOKEN manquant (.env.local) pour --write');
  const client = createClient({ projectId: 'yh5i5diw', dataset: 'production', apiVersion: '2026-01-01', useCdn: false, token, perspective: 'raw' });
  const posts = await client.fetch<Post[]>(
    `*[_type == "post" && !defined(translationOf) && !(_id in path("drafts.**"))]{ "slug": slug.current, title, body }`,
  );
  const postBy = new Map(posts.map((p) => [p.slug, p]));

  const report: string[] = [];
  const problems: string[] = [];
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];

  // Articles
  const articleId = new Map<string, string>(); // fichier de la note → id
  for (const n of of('article')) {
    const slug = str(n.meta.slug);
    if (!postBy.has(slug)) {
      problems.push(`Article « ${n.title} » : slug « ${slug} » absent des articles publiés — ignoré`);
      continue;
    }
    const series = str(n.meta.serie);
    nodes.push({
      id: `a:${slug}`,
      kind: 'article',
      label: postBy.get(slug)!.title,
      slug,
      series: series && series !== 'Hors série' ? series : null,
      part: series && series !== 'Hors série' ? Number(n.meta.ordre) || null : null,
      themes: ((n.meta.thematiques as unknown[]) ?? []).map(str),
      x: 0,
      y: 0,
    });
    articleId.set(n.file, `a:${slug}`);
  }

  // Thèses, par article, dans l'ordre
  const theses = of('these').concat(of('thèse')).filter(isPublic);
  const bySlug = new Map<string, Note[]>();
  for (const t of theses) bySlug.set(str(t.meta.article_slug), [...(bySlug.get(str(t.meta.article_slug)) ?? []), t]);
  const usedMechanisms = new Set<string>();
  let resolved = 0;

  for (const [slug, list] of bySlug) {
    const post = postBy.get(slug);
    if (!post || !articleId.has(notes.find((n) => n.meta.type === 'article' && n.meta.slug === slug)?.file ?? '')) {
      problems.push(`${list.length} thèse(s) pour « ${slug} », article absent ou non publié — ignorées`);
      continue;
    }
    const paras = paragraphs(post);
    list.sort((a, b) => Number(a.meta.ordre) - Number(b.meta.ordre));
    const anchors = list.map((t) => {
      const q = normalize(str(t.meta.citation));
      const i = q ? paras.findIndex((p) => normalize(p.text).includes(q)) : -1;
      if (i === -1) problems.push(`${t.file} : citation introuvable dans « ${slug} » → le nœud renverra à l'article`);
      else resolved++;
      return i;
    });
    // Ordre du texte : une thèse ancrée avant la précédente signale une citation mal choisie.
    anchors.forEach((i, k) => {
      const prev = anchors.slice(0, k).filter((x) => x >= 0).pop();
      if (i >= 0 && prev !== undefined && i < prev) problems.push(`${list[k].file} : ancrée avant la thèse précédente (vérifier la citation)`);
    });

    list.forEach((t, k) => {
      const i = anchors[k];
      const nextAnchor = anchors.slice(k + 1).find((x) => x > i) ?? paras.length;
      const id = `t:${slug}:${Number(t.meta.ordre)}`;
      nodes.push({
        id,
        kind: 'thesis',
        label: str(t.meta.verdict),
        article: `a:${slug}`,
        order: Number(t.meta.ordre),
        quote: str(t.meta.citation),
        anchor: i >= 0 ? paras[i].key : null,
        covers: i >= 0 ? paras.slice(i, nextAnchor).map((p) => p.key) : [],
        print: i >= 0 ? fingerprint(paras[i].text) : null,
        section: i >= 0 ? paras[i].section : null,
        x: 0,
        y: 0,
      });
      edges.push({ source: `a:${slug}`, target: id, kind: 'part' });
      if (k > 0) edges.push({ source: `t:${slug}:${Number(list[k - 1].meta.ordre)}`, target: id, kind: 'next' });
      for (const m of (t.meta.mecanismes as unknown[]) ?? []) {
        const file = target(m);
        const note = byFile.get(file);
        if (!note) problems.push(`${t.file} : mécanisme « ${file} » sans note`);
        else if (isPublic(note)) {
          usedMechanisms.add(file);
          edges.push({ source: id, target: `m:${file}`, kind: 'uses' });
        }
      }
    });
    report.push(`  ${slug.padEnd(38)} ${list.length} thèses, ${anchors.filter((x) => x >= 0).length} ancrées`);
  }

  // Mécanismes et rimes
  for (const file of usedMechanisms) {
    const n = byFile.get(file)!;
    const qa = str(n.meta.citation_article);
    const q = normalize(str(n.meta.citation));
    const para = postBy.has(qa) ? paragraphs(postBy.get(qa)!).find((p) => normalize(p.text).includes(q)) : undefined;
    if (q && !para) problems.push(`Mécanisme ${file} : citation introuvable dans « ${qa} »`);
    nodes.push({
      id: `m:${file}`,
      kind: 'mechanism',
      label: n.title,
      definition: str(n.meta.definition),
      quote: str(n.meta.citation),
      quoteArticle: qa,
      anchor: para?.key ?? null,
      section: para?.section ?? null,
      x: 0,
      y: 0,
    });
  }
  const rhymes = { written: 0, validated: 0, proposed: 0 };
  for (const file of usedMechanisms) {
    for (const r of (byFile.get(file)!.meta.rimes as Record<string, unknown>[]) ?? []) {
      const statut = str(r.statut);
      if (statut === 'proposée') {
        rhymes.proposed++;
        continue;
      }
      const other = target(r.avec);
      if (!usedMechanisms.has(other)) continue;
      if (statut === 'écrite') rhymes.written++;
      else if (statut === 'validée') rhymes.validated++;
      else {
        problems.push(`Mécanisme ${file} : rime vers « ${other} » au statut inconnu « ${statut} » — ignorée`);
        continue;
      }
      edges.push({ source: `m:${file}`, target: `m:${other}`, kind: 'rhyme', why: str(r.pourquoi) });
    }
  }

  // Mise en page
  // Positions de départ : le dernier export local, sinon la carte publiée
  // (un autre poste, un clone neuf) — jamais un tirage neuf si une carte existe.
  const local = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as { nodes: MapNode[] }) : null;
  const published = local ? null : await client.withConfig({ perspective: 'published' }).fetch<JournalMapDoc | null>(JOURNAL_MAP_QUERY);
  const previous = local?.nodes.length ? local.nodes : published?.nodes?.length ? published.nodes.map((n) => ({ ...n, id: n.nodeId })) : null;
  const prevPos = new Map((previous ?? []).map((n) => [n.id, { x: n.x, y: n.y }]));
  const graph = new Graph({ type: 'undirected', multi: false });
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 200 - 100;
  for (const n of nodes) graph.addNode(n.id, prevPos.get(n.id) ?? { x: rand(), y: rand() });
  for (const e of edges) if (!graph.hasEdge(e.source, e.target)) graph.addEdge(e.source, e.target, { weight: e.kind === 'part' ? 2 : 1 });
  forceAtlas2.assign(graph, {
    iterations: previous ? 200 : 800,
    settings: { ...forceAtlas2.inferSettings(graph), gravity: 1, scalingRatio: 12, strongGravityMode: true, edgeWeightInfluence: 1 },
  });
  for (const n of nodes) {
    const a = graph.getNodeAttributes(n.id);
    n.x = Math.round(a.x * 10) / 10;
    n.y = Math.round(a.y * 10) / 10;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const exportedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify({ exportedAt, nodes, edges }, null, 1));

  const count = (k: MapNode['kind']) => nodes.filter((n) => n.kind === k).length;
  const lines = [
    `# Concept Map — export du ${exportedAt.slice(0, 16).replace('T', ' ')}`,
    '',
    `Vault : ${VAULT}`,
    '',
    `- ${count('article')} articles, ${count('thesis')} thèses (${resolved} ancrées), ${count('mechanism')} mécanismes`,
    `- ${edges.length} liens, dont ${rhymes.written} rimes écrites et ${rhymes.validated} validées ; ${rhymes.proposed} rimes proposées non publiées`,
    '',
    '## Par article',
    ...report,
    '',
    `## À reprendre (${problems.length})`,
    ...(problems.length ? problems.map((p) => `- ${p}`) : ['- rien']),
  ];
  writeFileSync(path.join(OUT_DIR, 'rapport.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  console.log(`\n→ ${path.relative(process.cwd(), OUT)}`);
  if (STRICT && problems.length) process.exit(1);

  if (WRITE) {
    // Brouillon seulement : la carte publique change au Publish d'Alexandre.
    // Lecture seule dans le Studio — on la corrige dans le vault.
    const key = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);
    const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length)));
    await client.createOrReplace({
      _id: `drafts.${JOURNAL_MAP_ID}`,
      _type: 'journalMap',
      exportedAt,
      nodes: nodes.map(({ id, ...n }) => ({ _key: key(id), _type: 'journalMapNode', nodeId: id, ...clean(n) })),
      edges: edges.map((e) => ({ _key: key(`${e.kind}|${e.source}|${e.target}`), _type: 'journalMapEdge', ...clean(e) })),
    });
    console.log(`\n✓ Brouillon drafts.${JOURNAL_MAP_ID} écrit : à relire et publier dans le Studio (Journal ▸ Concept Map).`);
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
