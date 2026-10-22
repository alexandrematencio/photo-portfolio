/**
 * Les titres et descriptions par défaut de ce que Google montre — repris par
 * le site quand le champ « Référencement (Google) » du Studio est vide, et
 * affichés dans l'aide de ce champ (sanity/schemas/pageFields.ts, seoField).
 *
 * `hub` est la page d'accueil d'amatencio.com, construite par DESIGN-FOLIO :
 * ce dépôt n'en a besoin que pour l'aide du Studio, et DESIGN-FOLIO garde sa
 * propre copie de repli (tools/hub-seo.mjs). Changer l'un, c'est changer
 * l'autre — ou mieux, remplir le champ dans le Studio, qui gagne sur les deux.
 *
 * Sans import : le Studio et le site lisent ce fichier tous les deux.
 */
export const SEO_DEFAULTS = {
  hub: {
    title: 'Alexandre Xavier Matencio — Designer & Photographer',
    description:
      'Alexandre Xavier Matencio, art director, designer and photographer near Paris. His photography portfolio, his journal and his digital agency.',
  },
  about: {
    title: 'About Alexandre Xavier Matencio',
    description:
      'Alexandre Xavier Matencio: French art director, product designer and photographer in Villejuif, near Paris. Background, agency, gear and contact.',
  },
  photoHome: {
    title: 'Alexandre Matencio — Street, Landscape & Portrait Photographer',
    description:
      'Alexandre Matencio, photographer near Paris. Author photography — street, landscape and portrait — from Paris, Moscow, Djerba and Vietnam.',
  },
} as const;
