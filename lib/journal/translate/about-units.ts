/**
 * UNE PAGE « À PROPOS » ⇄ DES UNITÉS DE TRADUCTION (2026-11-08).
 *
 * Même mécanique que `units.ts` pour les articles, appliquée aux deux
 * singletons en trois étages (`journalAboutPage`, `journalMapAboutPage`,
 * `sanity/schemas/journal.ts` → `aboutFields`). La traduction ne vit pas dans
 * un document à part : elle est rangée dans `translations.<langue>` du même
 * document, avec son instantané `translationSource` (traduction incrémentale).
 *
 * Identifiants : `questionsTitle`, `sectionsTitle`, `body.<clé>`,
 * `q.<clé>.question`, `q.<clé>.answer.<clé>`, `s.<clé>.title`,
 * `s.<clé>.body.<clé>`. La structure (ordre, clés, styles) est toujours
 * recopiée du français : les clés de la traduction sont donc celles du
 * français, ce qui permet de reprendre une unité inchangée à la demande
 * suivante.
 *
 * Aucune dépendance Node : testé hors ligne par `check-translate-markup`.
 */
import { blockToMarkup, parseMarkup, type PTBlock } from './markup';
import type { Unit } from './units';

export const ABOUT_TYPES = ['journalAboutPage', 'journalMapAboutPage'] as const;
export type AboutType = (typeof ABOUT_TYPES)[number];
export const isAboutType = (type: unknown): type is AboutType => ABOUT_TYPES.includes(type as AboutType);

type Question = { _key: string; _type?: string; question?: string; answer?: PTBlock[] };
type Section = { _key: string; _type?: string; title?: string; body?: PTBlock[] };

/** Les champs traduisibles d'une page « À propos » (français, ou une traduction). */
export type AboutContent = {
  body?: PTBlock[];
  questionsTitle?: string;
  questions?: Question[];
  sectionsTitle?: string;
  sections?: Section[];
};

const blocks = (v: unknown) => (Array.isArray(v) ? (v as PTBlock[]) : []);

export function extractAboutUnits(page: AboutContent): Unit[] {
  const units: Unit[] = [];
  const add = (id: string, text: unknown) => {
    if (typeof text === 'string' && text.trim()) units.push({ id, text });
  };
  const addBlocks = (prefix: string, list: unknown) => {
    for (const b of blocks(list)) if (b._type === 'block') add(`${prefix}.${b._key}`, blockToMarkup(b));
  };

  add('questionsTitle', page.questionsTitle);
  add('sectionsTitle', page.sectionsTitle);
  addBlocks('body', page.body);
  for (const q of page.questions ?? []) {
    add(`q.${q._key}.question`, q.question);
    addBlocks(`q.${q._key}.answer`, q.answer);
  }
  for (const s of page.sections ?? []) {
    add(`s.${s._key}.title`, s.title);
    addBlocks(`s.${s._key}.body`, s.body);
  }
  return units;
}

/**
 * La traduction d'une page « À propos », bâtie sur une COPIE du français.
 * Lève une exception si une unité manque, ou si une ligne balisée perd un
 * lien (`parseMarkup`).
 */
export function applyAboutUnits(page: AboutContent, translated: Unit[]): AboutContent {
  const expected = extractAboutUnits(page).map((u) => u.id);
  const map = new Map(translated.map((u) => [u.id, u.text]));
  const missing = expected.filter((id) => !map.get(id)?.trim());
  if (missing.length) throw new Error(`Unités non traduites : ${missing.join(', ')}`);

  const tIf = (id: string, original: string | undefined) => (original?.trim() ? map.get(id)! : original);
  const tBlocks = (prefix: string, list: PTBlock[] | undefined) =>
    list?.map((b) => {
      const copy = structuredClone(b);
      const id = `${prefix}.${b._key}`;
      // Paragraphe vide, ou bloc qui n'est pas du texte : recopié tel quel.
      if (b._type !== 'block' || !map.has(id)) return copy;
      return { ...copy, children: parseMarkup(map.get(id)!, b) };
    });

  return {
    body: tBlocks('body', page.body),
    questionsTitle: tIf('questionsTitle', page.questionsTitle),
    questions: page.questions?.map((q) => ({
      ...structuredClone(q),
      question: tIf(`q.${q._key}.question`, q.question),
      answer: tBlocks(`q.${q._key}.answer`, q.answer),
    })),
    sectionsTitle: tIf('sectionsTitle', page.sectionsTitle),
    sections: page.sections?.map((s) => ({
      ...structuredClone(s),
      title: tIf(`s.${s._key}.title`, s.title),
      body: tBlocks(`s.${s._key}.body`, s.body),
    })),
  };
}

/** Le texte français de chaque unité, tel que la traduction l'a lu. */
export const aboutSnapshotOf = (page: AboutContent) =>
  Object.fromEntries(extractAboutUnits(page).map((u) => [u.id, u.text]));
