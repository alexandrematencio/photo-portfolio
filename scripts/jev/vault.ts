/**
 * Lecture et écriture du vault Obsidian du journal (`JOURNAL_VAULT`).
 *
 * Les dossiers qui commencent par `.` ou `_` (`_archive`, `_dump`, `_jev`)
 * ne sont jamais lus : rien de ce qu'ils contiennent ne peut atteindre la
 * Concept Map publique.
 *
 * L'écriture ne touche que les propriétés (frontmatter) demandées, et garde la
 * mise en forme du générateur (chaînes entre guillemets doubles).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parse as parseYaml, parseDocument } from 'yaml';

export const VAULT = process.env.JOURNAL_VAULT ?? path.join(homedir(), 'Documents/ALEX-PERSO/BLOG/Graphe-du-journal');

export type Note = { file: string; folder: string; meta: Record<string, unknown>; title: string; path: string };

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

export function readVault(dir = VAULT, rel = ''): Note[] {
  const notes: Note[] = [];
  for (const entry of readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
    const r = path.join(rel, entry.name);
    if (entry.isDirectory()) notes.push(...readVault(dir, r));
    else if (entry.name.endsWith('.md')) {
      const raw = readFileSync(path.join(dir, r), 'utf8');
      const m = raw.match(FRONTMATTER);
      const meta = (m ? parseYaml(m[1]) : {}) ?? {};
      const h1 = raw.match(/^# (.+)$/m)?.[1]?.trim();
      const file = entry.name.slice(0, -3);
      notes.push({ file, folder: rel.split(path.sep)[0], meta, title: h1 ?? file, path: path.join(dir, r) });
    }
  }
  return notes;
}

/** `[[fichier|alias]]` → `fichier`. */
export const target = (link: unknown) => String(link).replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
export const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
export const isPublic = (n: Note) => n.meta.public !== false;
export const link = (file: string) => `[[${file}]]`;

/** Remplace (ou retire, avec `undefined`) des propriétés d'une note, sans toucher à son corps. */
export function setProperties(notePath: string, props: Record<string, unknown>) {
  const raw = readFileSync(notePath, 'utf8');
  const m = raw.match(FRONTMATTER);
  if (!m && Object.values(props).every((v) => v === undefined)) return;
  const doc = parseDocument(m ? m[1] : '');
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) doc.delete(k);
    else doc.set(k, doc.createNode(v));
  }
  const yaml = doc.toString({ defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN', lineWidth: 0 }).trimEnd();
  writeFileSync(notePath, `---\n${yaml}\n---\n` + (m ? raw.slice(m[0].length) : raw));
}
