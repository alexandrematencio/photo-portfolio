import { DICT, headingSeparator } from '@/lib/journal/i18n';
import type { Article } from '@/lib/journal/types';

/**
 * Les SECTIONS d'un article — ses H2, plus la bibliographie quand il en a une.
 * Calculées une seule fois, ici, pour les deux qui en ont besoin : le corps
 * (`ArticleBody`) pose l'`id` sur chaque H2, le sommaire (`TableOfContents`)
 * y pointe. Deux calculs séparés finiraient par ne plus tomber d'accord, et un
 * lien de sommaire mort ne se voit qu'au clic.
 *
 * L'étiquette est le SUJET de l'intertitre, sans son verdict (« La douleur
 * fabriquée : convergence nette » → « La douleur fabriquée ») : c'est la dalle
 * en capitales que le lecteur voit dans le texte (cf. `ArticleH2`).
 *
 * L'`id` est lisible (« la-douleur-fabriquee ») : un lien vers une section se
 * partage. Les doublons prennent un suffixe, dans l'ordre du texte.
 */
export type ArticleSection = { id: string; label: string };

/** L'ancre de la bibliographie. Les entrées, elles, sont des `ref-<clé>` : pas de collision possible. */
export const REFERENCES_ID = 'references';

export function headingSubject(text: string, lang: Article['lang']): string {
  const sep = headingSeparator(lang);
  const cut = text.indexOf(sep);
  return cut === -1 ? text : text.slice(0, cut);
}

function slug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

export function articleSections(article: Article): {
  sections: ArticleSection[];
  /** L'`id` du H2 posé par le bloc d'index `i` de `article.blocks`. */
  idByBlock: Map<number, string>;
} {
  const used = new Set<string>([REFERENCES_ID]);
  const unique = (base: string) => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  const sections: ArticleSection[] = [];
  const idByBlock = new Map<number, string>();
  article.blocks.forEach((block, i) => {
    if (block.type !== 'h2') return;
    const label = headingSubject(block.text, article.lang);
    const id = unique(slug(label));
    idByBlock.set(i, id);
    sections.push({ id, label });
  });
  if (article.referenceCount > 0) sections.push({ id: REFERENCES_ID, label: DICT[article.lang].referencesTitle });
  return { sections, idByBlock };
}
