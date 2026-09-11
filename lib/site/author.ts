/**
 * Identité de l'auteur, source unique. Consommée par les données structurées
 * (lib/seo/jsonld.ts), par la signature des fichiers déposés dans Sanity
 * (scripts/image-rights.ts) et par l'image de partage. Le pied de page et les
 * textes de repli des pages légales portent le nom en clair, mais ce sont des
 * textes, pas des identifiants : c'est ici que change le nom s'il doit changer.
 */
export const AUTHOR_NAME = 'Alexandre Matencio';
export const AUTHOR_SHORT = 'A. Matencio';

/** Avis de copyright, tel qu'il est écrit dans les fichiers ET dans le JSON-LD. */
export function copyrightNotice(year: number = new Date().getFullYear()): string {
  return `© ${year} ${AUTHOR_NAME}. All rights reserved.`;
}
