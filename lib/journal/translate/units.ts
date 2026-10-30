/**
 * UN ARTICLE ⇄ DES UNITÉS DE TRADUCTION (2026-10-18).
 *
 * `extractUnits` réduit un article français à une liste plate
 * `{ id, text }` : tout ce qui se lit, rien d'autre. `applyUnits` remet chaque
 * texte traduit à sa place dans une COPIE de l'article. Tout ce qui n'est pas
 * du texte — clés, figures, familles de verdicts, ordre des blocs, clés des
 * références que le corps appelle — ne passe jamais par le modèle et ne peut
 * donc pas être abîmé.
 *
 * Identifiants : un chemin lisible (`title`, `body.k2j`, `body.k2j.rows.r1.idea`,
 * `ref.baars.k0`). Le modèle les recopie, il ne les invente pas : `applyUnits`
 * refuse une réponse où il en manque un.
 */
import { blockToMarkup, parseMarkup, type PTBlock } from './markup';

export type Unit = { id: string; text: string };

type Obj = Record<string, unknown> & { _key: string; _type: string };
type Row = Record<string, unknown> & { _key: string };

/** Les champs simples d'un article, traduits tels quels. */
const PLAIN_FIELDS = ['title', 'dek', 'seoTitle', 'seoDescription', 'referencesNote'] as const;

export type SourcePost = {
  _id: string;
  title?: string;
  dek?: string;
  seoTitle?: string;
  seoDescription?: string;
  referencesNote?: string;
  body?: Obj[];
  references?: { _key: string; _type: string; citation?: PTBlock[] }[];
  aiNote?: PTBlock[];
};

const blocks = (v: unknown) => (Array.isArray(v) ? (v as Obj[]) : []);

export function extractUnits(post: SourcePost): Unit[] {
  const units: Unit[] = [];
  const add = (id: string, text: unknown) => {
    if (typeof text === 'string' && text.trim()) units.push({ id, text });
  };

  for (const f of PLAIN_FIELDS) add(f, post[f]);

  for (const b of blocks(post.body)) {
    const id = `body.${b._key}`;
    switch (b._type) {
      case 'block': {
        const block = b as unknown as PTBlock;
        add(id, blockToMarkup(block));
        for (const c of block.children ?? []) if (c._type === 'journalDraftNote') add(`${id}.note.${c._key}`, (c as Obj).text);
        break;
      }
      case 'journalPullQuote':
      case 'journalDraftBlock':
        add(`${id}.text`, b.text);
        break;
      case 'journalTable':
        ((b.head as string[] | undefined) ?? []).forEach((cell, i) => add(`${id}.head.${i}`, cell));
        for (const row of (b.rows as Row[] | undefined) ?? [])
          ((row.cells as string[] | undefined) ?? []).forEach((cell, i) => add(`${id}.rows.${row._key}.${i}`, cell));
        break;
      case 'journalVerdicts':
        for (const row of (b.rows as Row[] | undefined) ?? [])
          for (const f of ['idea', 'prior', 'verdict']) add(`${id}.rows.${row._key}.${f}`, row[f]);
        break;
      case 'journalImage':
        add(`${id}.alt`, b.alt);
        add(`${id}.caption`, b.caption);
        break;
      // journalFigure : une figure dessinée, choisie dans une liste — rien à traduire.
    }
  }

  for (const ref of post.references ?? [])
    for (const c of ref.citation ?? []) add(`ref.${ref._key}.${c._key}`, blockToMarkup(c));

  for (const c of post.aiNote ?? []) add(`ai.${c._key}`, blockToMarkup(c));

  return units;
}

/** Le champ de la version traduite d'une image (`journalImage`), par langue. */
const IMAGE_FIELD = { en: 'imageEn', ru: 'imageRu' } as const;

/**
 * Le corps d'une traduction, images comprises (2026-10-20) : une image qui a
 * sa version dans la langue (un schéma aux libellés traduits) la prend à la
 * place de l'image française. Les versions des autres langues n'ont rien à
 * faire dans la traduction : elles en sont retirées.
 */
export function localizeImages(body: Obj[], lang: keyof typeof IMAGE_FIELD): Obj[] {
  return body.map((b) => {
    if (b._type !== 'journalImage') return b;
    const { imageEn: _en, imageRu: _ru, ...rest } = b;
    const localized = b[IMAGE_FIELD[lang]];
    return localized ? { ...rest, image: localized } : rest;
  });
}

export type TranslatedFields = {
  title: string;
  dek: string;
  seoTitle?: string;
  seoDescription?: string;
  referencesNote?: string;
  body: Obj[];
  references?: SourcePost['references'];
  aiNote?: PTBlock[];
};

/**
 * Les champs traduits d'un article. Lève une exception si une unité manque,
 * ou si une ligne balisée perd un appel de référence (`parseMarkup`).
 */
export function applyUnits(post: SourcePost, translated: Unit[]): TranslatedFields {
  const expected = extractUnits(post).map((u) => u.id);
  const map = new Map(translated.map((u) => [u.id, u.text]));
  const missing = expected.filter((id) => !map.get(id)?.trim());
  if (missing.length) throw new Error(`Unités non traduites : ${missing.join(', ')}`);

  const t = (id: string) => map.get(id)!;
  const tIf = (id: string, original: unknown) => (typeof original === 'string' && original.trim() ? t(id) : original);

  const body = blocks(post.body).map((b) => {
    const id = `body.${b._key}`;
    const copy = structuredClone(b);
    switch (b._type) {
      case 'block': {
        const block = copy as unknown as PTBlock;
        // Paragraphe vide (une ligne laissée blanche dans le Studio) : rien à traduire.
        if (!map.has(id)) return copy;
        block.children = parseMarkup(t(id), b as unknown as PTBlock).map((c) =>
          c._type === 'journalDraftNote' ? { ...c, text: tIf(`${id}.note.${c._key}`, (c as Obj).text) } : c,
        );
        return block as unknown as Obj;
      }
      case 'journalPullQuote':
      case 'journalDraftBlock':
        return { ...copy, text: tIf(`${id}.text`, b.text) };
      case 'journalImage':
        return { ...copy, alt: tIf(`${id}.alt`, b.alt), caption: tIf(`${id}.caption`, b.caption) };
      case 'journalTable':
        return {
          ...copy,
          head: ((b.head as string[] | undefined) ?? []).map((cell, i) => tIf(`${id}.head.${i}`, cell)),
          rows: ((b.rows as Row[] | undefined) ?? []).map((row) => ({
            ...row,
            cells: ((row.cells as string[] | undefined) ?? []).map((cell, i) => tIf(`${id}.rows.${row._key}.${i}`, cell)),
          })),
        };
      case 'journalVerdicts':
        return {
          ...copy,
          rows: ((b.rows as Row[] | undefined) ?? []).map((row) => ({
            ...row,
            idea: tIf(`${id}.rows.${row._key}.idea`, row.idea),
            prior: tIf(`${id}.rows.${row._key}.prior`, row.prior),
            verdict: tIf(`${id}.rows.${row._key}.verdict`, row.verdict),
          })),
        };
      default:
        return copy;
    }
  });

  const references = post.references?.map((ref) => ({
    ...ref,
    citation: ref.citation?.map((c) => {
      const markup = map.get(`ref.${ref._key}.${c._key}`);
      return markup === undefined ? c : { ...c, children: parseMarkup(markup, c) };
    }),
  }));

  const aiNote = post.aiNote?.map((c) => {
    const markup = map.get(`ai.${c._key}`);
    return markup === undefined ? c : { ...c, children: parseMarkup(markup, c) };
  });

  return {
    title: t('title'),
    dek: t('dek'),
    seoTitle: tIf('seoTitle', post.seoTitle) as string | undefined,
    seoDescription: tIf('seoDescription', post.seoDescription) as string | undefined,
    referencesNote: tIf('referencesNote', post.referencesNote) as string | undefined,
    body,
    references,
    aiNote,
  };
}
