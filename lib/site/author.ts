/**
 * Identité de l'auteur, source unique. Consommée par les données structurées
 * (lib/seo/jsonld.ts), par la signature des fichiers déposés dans Sanity
 * (scripts/image-rights.ts) et par l'image de partage. Le pied de page et les
 * textes de repli des pages légales portent le nom en clair, mais ce sont des
 * textes, pas des identifiants : c'est ici que change le nom s'il doit changer.
 */
export const AUTHOR_NAME = 'Alexandre Matencio';
export const AUTHOR_SHORT = 'A. Matencio';
/** Le nom complet, deuxième prénom compris : celui qu'on doit retrouver en le
 *  cherchant tel quel (demande Alexandre, 2026-10-22). Porté par le Person et
 *  par le texte visible de la page d'accueil (am-home). */
export const AUTHOR_FULL_NAME = 'Alexandre Xavier Matencio';

/** Signature des articles du journal quand le Studio n'en donne pas
 *  (`journalSettings.signature` et ses traductions) — filet de sécurité, pas
 *  la source. Une par langue du journal (lib/journal/i18n.ts). */
export const AUTHOR_JOURNAL_SIGNATURE = {
  fr: 'directeur artistique, designer produit, photographe, fondateur de feu Zalem Industries et cofondateur de feu OpenCNFT.io. J’écris sur les dynamiques cognitives et les dynamiques de foule, à partir des mécanismes qui les produisent.',
  en: 'Art Director, Product Designer, Photographer, founder of the late Zalem Industries and cofounder of the late OpenCNFT.io. I write about cognitive and crowd dynamics, through the mechanisms that produce them.',
  ru: 'арт-директор, продуктовый дизайнер, фотограф, основатель ныне закрытой Zalem Industries и сооснователь ныне закрытого OpenCNFT.io. Пишу о когнитивной динамике и динамике толпы — через механизмы, которые их порождают.',
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
