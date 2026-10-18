/**
 * Identité de l'auteur, source unique. Consommée par les données structurées
 * (lib/seo/jsonld.ts), par la signature des fichiers déposés dans Sanity
 * (scripts/image-rights.ts) et par l'image de partage. Le pied de page et les
 * textes de repli des pages légales portent le nom en clair, mais ce sont des
 * textes, pas des identifiants : c'est ici que change le nom s'il doit changer.
 */
export const AUTHOR_NAME = 'Alexandre Matencio';
export const AUTHOR_SHORT = 'A. Matencio';

/** Signature des articles du journal quand le Studio n'en donne pas
 *  (`journalSettings.signature` et ses traductions) — filet de sécurité, pas
 *  la source. Une par langue du journal (lib/journal/i18n.ts). */
export const AUTHOR_JOURNAL_SIGNATURE = {
  fr: 'designer produit, fondateur de Zalem et cofondateur d’OpenCNFT. J’écris sur les marchés de collection et sur la façon dont on décide.',
  en: 'product designer, founder of Zalem and co-founder of OpenCNFT. I write about collectible markets and about how we decide.',
  ru: 'продуктовый дизайнер, основатель Zalem и сооснователь OpenCNFT. Пишу о коллекционных рынках и о том, как мы принимаем решения.',
} as const;

/** Profils publics de l'auteur — alimentent `sameAs` du Person (jsonld.ts), qui
 *  est ce qui relie le nom aux comptes pour Google. Les mêmes que /socials. */
export const AUTHOR_SAME_AS = [
  'https://www.instagram.com/alxmtc',
  'https://www.instagram.com/alxmtnc',
];

/** Avis de copyright, tel qu'il est écrit dans les fichiers ET dans le JSON-LD. */
export function copyrightNotice(year: number = new Date().getFullYear()): string {
  return `© ${year} ${AUTHOR_NAME}. All rights reserved.`;
}
