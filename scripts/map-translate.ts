/**
 * TRADUCTION DE LA CONCEPT MAP en anglais et en russe (phase 5,
 * docs/superpowers/plans/2026-10-28-journal-map.md ; le modèle :
 * lib/journal/conceptMapI18n.ts).
 *
 *   npm run map:translate                          → bilan par langue : à jour, repris d'office, à traduire
 *   npm run map:translate -- --export <fichier>    → écrit les textes à traduire, avec leur contexte
 *   npm run map:translate -- --import <fichier>    → vérifie les traductions et montre le bilan
 *   npm run map:translate -- --import <f> --write  → les écrit dans le BROUILLON `drafts.journalMap`
 *   npm run map:translate -- --out <fichier>       → écrit aussi toutes les traductions (essai local :
 *                                                     MAP_TRANSLATIONS=<fichier> npm run dev:blog)
 *   --lang en | ru                                 → une seule langue
 *
 * INCRÉMENTAL : une traduction dont le français n'a pas changé (même
 * empreinte) est reprise telle quelle ; seuls les textes nouveaux ou repris
 * dans le vault sont à traduire. Une citation se reprend d'office dans
 * l'article traduit quand c'est sans ambiguïté (`alignQuote`).
 *
 * Qui traduit : Claude, dans la session qui exporte la carte (le fichier de
 * `--export` est le cahier, celui d'`--import` la copie rendue :
 * `[{ "lang", "id", "field", "text" }]`). Une citation importée doit être
 * recopiée du paragraphe traduit, sinon elle est refusée.
 *
 * Lit le brouillon de la carte s'il existe (c'est lui qu'on publiera), sinon
 * la carte publiée. `--write` ne touche que `translations` : Publish dans le
 * Studio (Journal ▸ Concept Map), comme après `map:build`.
 */
import { createClient } from '@sanity/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { JOURNAL_MAP_ID, MAP_POSTS_QUERY, type JournalMapDoc, type MapPosts } from '../lib/journal/conceptMap';
import {
  alignQuote,
  hashText,
  MAP_LANGS,
  mapUnits,
  quoteFits,
  textKey,
  type MapLang,
  type MapUnit,
  type StoredMapText,
} from '../lib/journal/conceptMapI18n';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const WRITE = args.includes('--write');
const EXPORT = flag('--export');
const IMPORT = flag('--import');
const OUT = flag('--out');
const LANGS = (flag('--lang')?.split(',') ?? MAP_LANGS) as MapLang[];
if (LANGS.some((l) => !MAP_LANGS.includes(l))) throw new Error(`--lang : ${MAP_LANGS.join(', ')}`);

const CYRILLIC = /[а-яё]/i;

async function main() {
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (WRITE && !token) throw new Error('SANITY_API_WRITE_TOKEN manquant (.env.local) pour --write');
  const client = createClient({ projectId: 'yh5i5diw', dataset: 'production', apiVersion: '2026-01-01', useCdn: false, token, perspective: 'raw' });
  const docs = await client.fetch<(JournalMapDoc & { _id: string })[]>(
    `*[_id in ["drafts.${JOURNAL_MAP_ID}", "${JOURNAL_MAP_ID}"]]{ _id, exportedAt, nodes, edges, translations }`,
  );
  const map = docs.find((d) => d._id.startsWith('drafts.')) ?? docs.find((d) => d._id === JOURNAL_MAP_ID);
  if (!map?.nodes?.length) throw new Error('Aucune carte (npm run map:build -- --write)');
  const posts = await client.fetch<MapPosts>(MAP_POSTS_QUERY);
  console.log(`Concept Map ${map._id.startsWith('drafts.') ? 'en brouillon' : 'publiée'}, exportée le ${map.exportedAt?.slice(0, 16).replace('T', ' ') ?? '?'}`);

  const stored = new Map((map.translations ?? []).map((t) => [textKey(t), t]));
  const imported = IMPORT ? (JSON.parse(readFileSync(IMPORT, 'utf8')) as Pick<StoredMapText, 'lang' | 'id' | 'field' | 'text'>[]) : [];
  const given = new Map(imported.map((t) => [textKey(t), t.text.trim()]));

  const kept: StoredMapText[] = [];
  const pending: MapUnit[] = [];
  const refused: string[] = [];
  for (const lang of LANGS) {
    const units = mapUnits(map, posts, lang);
    const n = { same: 0, auto: 0, imported: 0, todo: 0 };
    for (const u of units) {
      const key = textKey(u);
      const old = stored.get(key);
      const text = given.get(key);
      if (text) {
        const why =
          u.field === 'quote' && !quoteFits(text, u.paragraph)
            ? 'citation absente du paragraphe traduit'
            : lang === 'ru' && !CYRILLIC.test(text)
              ? 'pas de russe'
              : null;
        if (!why) {
          kept.push({ lang, id: u.id, field: u.field, src: u.src, text });
          n.imported++;
          continue;
        }
        refused.push(`${key} — ${why} : « ${text} »`);
      }
      if (old?.src === u.src) {
        kept.push(old);
        n.same++;
        continue;
      }
      const auto = u.field === 'quote' ? alignQuote(u.fr, u.frParagraph, u.paragraph) : null;
      if (auto) {
        kept.push({ lang, id: u.id, field: u.field, src: u.src, text: auto, auto: true });
        n.auto++;
        continue;
      }
      pending.push(u);
      n.todo++;
      // Périmée mais présente : on la garde en attendant mieux, le site l'affiche plutôt que le français.
      if (old) kept.push(old);
    }
    console.log(`  ${lang} : ${units.length} textes — ${n.same} à jour, ${n.auto} citations reprises d'office, ${n.imported} importés, ${n.todo} à traduire`);
  }
  // Les autres langues (hors --lang) restent telles quelles.
  for (const t of map.translations ?? []) if (!LANGS.includes(t.lang)) kept.push(t);
  for (const r of refused) console.log(`  ✗ ${r}`);

  if (EXPORT) {
    writeFileSync(
      EXPORT,
      JSON.stringify(
        pending.map(({ lang, id, field, fr, paragraph }) => ({ lang, id, field, fr, ...(paragraph ? { paragraph } : {}), text: '' })),
        null,
        1,
      ) + '\n',
    );
    console.log(`→ ${pending.length} textes à traduire dans ${EXPORT}`);
  }
  if (OUT) {
    writeFileSync(OUT, JSON.stringify(kept, null, 1) + '\n');
    console.log(`→ ${kept.length} traductions dans ${OUT}`);
  }
  if (WRITE) {
    if (refused.length) throw new Error(`${refused.length} traduction(s) refusée(s) : rien n'est écrit`);
    const translations = kept.map((t) => ({ _key: hashText(textKey(t)) + t.lang, _type: 'journalMapText', ...t }));
    const draftId = `drafts.${JOURNAL_MAP_ID}`;
    const { _id, ...content } = map;
    void _id;
    await client
      .transaction()
      // Pas encore de brouillon : il part de la carte publiée.
      .createIfNotExists({ ...content, _id: draftId, _type: 'journalMap' })
      .patch(draftId, (p) => p.set({ translations }))
      .commit();
    console.log(`\n✓ ${translations.length} traductions écrites dans ${draftId} : Publish dans le Studio (Journal ▸ Concept Map).`);
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
