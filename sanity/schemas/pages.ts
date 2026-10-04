import { defineField, defineType } from 'sanity';
import {
  editorialBlockType,
  editorialBodyDescription,
  heroImageField,
} from './pageFields';

/**
 * Un document PAR PAGE du site (2026-10-05), rangés dans la rubrique « Pages »
 * du Studio. Ils vivaient auparavant tous dans `siteSettings` : un seul
 * brouillon, un seul Publish, si bien qu'une coquille corrigée dans About
 * publiait aussi des mentions légales à moitié réécrites.
 *
 * Chaque page est un singleton : `_id` === `_type` (même garde que
 * `siteSettings`, cf. SINGLETON_TYPES dans studio.config.ts). Le site les lit
 * en une seule requête (`getSiteSettings`, lib/sanity/queries.ts).
 *
 * Ajouter une page = une entrée dans PAGE_DOCS, puis la plomberie côté site
 * (CLAUDE.md §8.5). Les pages à photos (series, archives) n'en ont pas : leur
 * contenu, ce sont les documents `photo` et `series`.
 */
export type PageDoc = {
  /** `_type` ET `_id` du document. */
  type: string;
  /** Libellé dans la rubrique « Pages » et en tête du formulaire. */
  title: string;
  /** Chemin sur le site — bouton « Open preview » du Studio. */
  path: string;
};

export const HOME_PAGE: PageDoc = { type: 'homePage', title: 'Accueil', path: '/' };

/** Pages éditoriales : un seul champ `body`, tout le texte de la page. */
const BODY_PAGES: (PageDoc & { intro: string })[] = [
  {
    type: 'aboutPage',
    title: 'About',
    path: '/about/',
    intro:
      'Le texte complet de la page /about — c’est cette liste qui EST la page, il n’y a pas de texte en dur ailleurs.',
  },
  {
    type: 'digitalAgencyPage',
    title: 'Digital Agency',
    path: '/about/digital-agency/',
    intro: 'Le texte complet de la page /about/digital-agency.',
  },
  {
    type: 'contactPage',
    title: 'Contact',
    path: '/contact/',
    intro:
      'Le texte complet de la page /contact — titre « CONTACT » mis à part, tout ce qui s’affiche vient d’ici.',
  },
  {
    type: 'socialsPage',
    title: 'Socials',
    path: '/socials/',
    intro:
      'Le texte complet de la page /socials — les liens vers les plateformes s’écrivent ici, en annotations de lien.',
  },
  {
    type: 'legalPage',
    title: 'Mentions légales',
    path: '/legal/',
    intro:
      'Le texte complet de la page /legal (éditeur, hébergeur, propriété intellectuelle et conditions de licence des photos).',
  },
  {
    type: 'privacyPage',
    title: 'Confidentialité',
    path: '/privacy/',
    intro:
      'Le texte complet de la page /privacy (données personnelles, droits RGPD, droit à l’image des personnes photographiées).',
  },
];

/** Toutes les pages, dans l'ordre de la rubrique « Pages ». */
export const PAGE_DOCS: PageDoc[] = [HOME_PAGE, ...BODY_PAGES];

const PUBLISH_HINT =
  'ℹ️ Après « Publish », le site en ligne se met à jour tout seul en 3 à 4 minutes.';

const homePageSchema = defineType({
  name: HOME_PAGE.type,
  title: HOME_PAGE.title,
  type: 'document',
  fields: [
    defineField({
      name: 'hero',
      title: 'Hero',
      type: 'object',
      description:
        'Les deux images du hero de la page d’accueil. La 1ʳᵉ est affichée par défaut au centre ; la 2ᵈᵉ se révèle sous le curseur (effet loupe). Conseils : images carrées, ≥ 1000 × 1000 px, et ≤ 300 Ko chacune. Le site génère automatiquement une version optimisée (WebP/AVIF, ~768 px). ' +
        PUBLISH_HINT,
      options: { collapsible: false },
      validation: (Rule) => Rule.required(),
      fields: [
        heroImageField(
          'defaultImage',
          'Image par défaut',
          'Affichée au centre du hero, toujours visible. Carrée idéalement (≥ 1000 × 1000 px). Poids max conseillé : 300 Ko — le site l’optimise automatiquement pour le visiteur.',
          { altRequired: true }
        ),
        heroImageField(
          'revealImage',
          'Image au survol (révélée à la loupe)',
          'Révélée sous le curseur dans un cercle qui suit le pointeur. Idéalement le même cadrage carré que l’image par défaut pour un fondu cohérent. Poids max conseillé : 300 Ko.',
          { altRequired: false }
        ),
      ],
      preview: {
        select: { media: 'defaultImage' },
        prepare: ({ media }) => ({ title: 'Hero', media }),
      },
    }),
    defineField({
      name: 'intro',
      title: 'Phrase d’auteur',
      type: 'text',
      rows: 3,
      description:
        'Une ou deux phrases affichées sur la home, juste au-dessus de « Selected Works » : qui tu es, où, ce que tu photographies. C’est aussi ce que Google lit en premier sur ta page d’accueil. Vise 25 à 40 mots, ton nom en toutes lettres. Laisse vide pour ne rien afficher. ' +
        PUBLISH_HINT,
      validation: (Rule) => Rule.max(300),
    }),
  ],
  preview: { prepare: () => ({ title: HOME_PAGE.title }) },
});

const bodyPageSchemas = BODY_PAGES.map((page) =>
  defineType({
    name: page.type,
    title: page.title,
    type: 'document',
    fields: [
      defineField({
        name: 'body',
        title: 'Texte de la page',
        type: 'array',
        of: [editorialBlockType],
        description: editorialBodyDescription(page.intro),
      }),
    ],
    preview: { prepare: () => ({ title: page.title }) },
  })
);

export const pageSchemas = [homePageSchema, ...bodyPageSchemas];
