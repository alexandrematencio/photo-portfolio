import { defineArrayMember, defineField, defineType } from 'sanity';
import {
  editorialBlockType,
  editorialBodyDescription,
  heroImageField,
  seoField,
} from './pageFields';
import { SEO_DEFAULTS } from '../../lib/seo/defaults';
import { WorkOrderInput } from '../inputs/WorkOrderInput';

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
  /** Libellé dans le Studio, en tête du formulaire et dans la recherche. */
  title: string;
  /** Chemin sur le site — bouton « Open preview » du Studio. */
  path: string;
  /**
   * Le site dont la page relève, donc où le Studio la range (premier niveau de
   * Structure, sanity/structure/index.ts). `hub` = amatencio.com, `photo` =
   * photo.amatencio.com. Le journal n'a pas de PageDoc : ses pages sont des
   * singletons du journal (schemas/journal.ts). Ranger une nouvelle page, c'est
   * lui donner un site.
   */
  site: StudioSite;
  /**
   * Page valable pour TOUS les sites (contact, mentions légales,
   * confidentialité) : rangée sous « Pages communes » du hub. Son lien
   * « Open preview » pointe toujours là où elle est servie (`path`, base du
   * portfolio) — le rangement du Studio ne déplace rien sur le site.
   */
  common?: boolean;
};

/** Les sites qui portent des PageDoc (le journal et design n'en ont pas). */
export type StudioSite = 'hub' | 'photo';

export const HOME_PAGE: PageDoc = {
  type: 'homePage',
  title: 'Accueil du portfolio',
  path: '/',
  site: 'photo',
};

/**
 * La page d'accueil de `amatencio.com` (projet am-home, la porte vers
 * les sous-domaines). Elle n'a pas de texte à éditer : seulement ce que
 * Google en montre. am-home lit ce document à chaque build
 * (`tools/hub-seo.mjs` là-bas). `path` est relatif au HUB, pas au portfolio
 * (cf. productionUrl, studio.config.ts).
 */
export const HUB_PAGE: PageDoc = {
  type: 'hubPage',
  title: 'Accueil amatencio.com',
  path: '/',
  site: 'hub',
};

/** Pages éditoriales : un seul champ `body`, tout le texte de la page. */
const BODY_PAGES: (PageDoc & { intro: string })[] = [
  {
    type: 'aboutPage',
    title: 'About',
    path: '/about/',
    site: 'hub',
    intro:
      'Le texte complet de la page amatencio.com/about — c’est cette liste qui EST la page, il n’y a pas de texte en dur ailleurs. C’est la seule page About des sites (hors celle du journal) : le portfolio et le journal y renvoient. L’encart de questions et les compléments repliés se règlent plus bas, dans ce même document.',
  },
  {
    type: 'contactPage',
    title: 'Contact',
    path: '/contact/',
    site: 'hub',
    common: true,
    intro:
      'Le début de la page /contact — titre « CONTACT » mis à part. Les réseaux (document suivant) s’affichent à la suite. Le même texte sert l’encart Contact de /about.',
  },
  {
    // Socials a été fondue dans /contact le 2026-10-17 : le document reste
    // (un brouillon et un Publish à lui), affiché à la suite de `contactPage`.
    type: 'socialsPage',
    title: 'Contact — réseaux',
    path: '/contact/',
    site: 'hub',
    common: true,
    intro:
      'La fin de la page /contact, après le texte de Contact : les liens vers les plateformes, en annotations de lien. Aussi repris dans l’encart Contact de /about.',
  },
  {
    type: 'legalPage',
    title: 'Mentions légales',
    path: '/legal/',
    site: 'hub',
    common: true,
    intro:
      'Le texte complet de la page /legal (éditeur, hébergeur, propriété intellectuelle et conditions de licence des photos).',
  },
  {
    type: 'privacyPage',
    title: 'Confidentialité',
    path: '/privacy/',
    site: 'hub',
    common: true,
    intro:
      'Le texte complet de la page /privacy (données personnelles, droits RGPD, droit à l’image des personnes photographiées).',
  },
];

/**
 * La page /work (2026-11-15) : l'étage entre /series (des récits) et
 * /archives (le fonds complet). Elle CLASSE au lieu de raconter : une
 * collection par genre (Street, Portraits, Archi & Shapes…), un onglet chacune.
 *
 * Une collection EST un document `series` : appartenance (`photo.series`),
 * ordre (`photoOrder`), cover et page indexable `/series/[slug]` restent ceux
 * de la série — rien à dupliquer ni à migrer. Une série listée ici quitte la
 * rangée de /series ; la retirer de la liste l'y renvoie. C'est tout le geste.
 */
export const WORK_PAGE: PageDoc = { type: 'workPage', title: 'Work', path: '/work/', site: 'photo' };

/** Toutes les pages ; chacune est rangée par `site` (et `common`) dans Structure. */
export const PAGE_DOCS: PageDoc[] = [HUB_PAGE, HOME_PAGE, WORK_PAGE, ...BODY_PAGES];

/** Les pages servies sur le HUB plutôt que sur le portfolio (productionUrl). */
// `digitalAgencyPage` retiré le 2026-11-16 (doublait /about) : le document
// reste dans le dataset, plus aucun schéma ni page ne le lit.
export const HUB_PAGE_TYPES = new Set([HUB_PAGE.type, 'aboutPage']);

const hubPageSchema = defineType({
  name: HUB_PAGE.type,
  title: HUB_PAGE.title,
  type: 'document',
  fields: [seoField(SEO_DEFAULTS.hub, 'amatencio.com, la page d’accueil de tous tes sites')],
  preview: { prepare: () => ({ title: HUB_PAGE.title }) },
});

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
    seoField(SEO_DEFAULTS.photoHome, 'l’accueil du portfolio, photo.amatencio.com'),
  ],
  preview: { prepare: () => ({ title: HOME_PAGE.title }) },
});

/**
 * Les deux étages de /about qui suivent le texte principal (2026-11-16) : même
 * gabarit que « À propos de ce journal » (`aboutFields`, journal.ts) — un
 * encart de questions toujours ouvert, puis des compléments repliés. Mêmes
 * noms de champs, donc `AboutExtras` (components/journal/AboutPage.tsx) les
 * rend tels quels. Pas de traductions : le site du portfolio est en anglais.
 */
function aboutExtraFields() {
  return [
    defineField({
      name: 'questionsTitle',
      title: 'Titre de l’encart de questions',
      description: 'Ex. « Questions people ask first ». Vide : pas d’encart.',
      type: 'string',
    }),
    defineField({
      name: 'questions',
      title: 'Questions (encart, toujours visible)',
      description: 'Les questions qu’un lecteur se pose avant de lire. Réponses courtes : elles restent ouvertes.',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'aboutQuestion',
          title: 'Question',
          type: 'object',
          fields: [
            defineField({ name: 'question', title: 'Question', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'answer', title: 'Réponse', type: 'array', of: [editorialBlockType] }),
          ],
          preview: { select: { title: 'question' } },
        }),
      ],
    }),
    defineField({
      name: 'sectionsTitle',
      title: 'Titre des compléments',
      description: 'Ex. « More about me ». Vide : pas de titre au-dessus des sections.',
      type: 'string',
    }),
    defineField({
      name: 'sections',
      title: 'Compléments (repliés, se déplient au clic)',
      description: 'Une section par sujet : parcours, photographie, matériel. Le lecteur ne voit que le titre tant qu’il n’ouvre pas.',
      type: 'array',
      of: [
        defineArrayMember({
          name: 'aboutSection',
          title: 'Section',
          type: 'object',
          fields: [
            defineField({ name: 'title', title: 'Titre', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'body', title: 'Texte', type: 'array', of: [editorialBlockType] }),
          ],
          preview: { select: { title: 'title' } },
        }),
      ],
    }),
  ];
}

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
      ...(page.type === 'aboutPage' ? [...aboutExtraFields(), seoField(SEO_DEFAULTS.about, 'la page amatencio.com/about')] : []),
    ],
    preview: { prepare: () => ({ title: page.title }) },
  })
);

const workPageSchema = defineType({
  name: WORK_PAGE.type,
  title: WORK_PAGE.title,
  type: 'document',
  fields: [
    defineField({
      name: 'collections',
      title: 'Ordre des albums (onglets de la page Work)',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'series' }],
          // Albums Work seulement. Ce qui fait d'une série un album, c'est son
          // champ « Où s'affiche-t-elle ? » — pas sa présence ici.
          options: { filter: 'destination == "work"' },
        }),
      ],
      description:
        'L’ORDRE des onglets de /work, de gauche à droite (glisser-déposer). Cette liste ne décide plus de ce qui s’affiche : un album Work y figure dès que sa destination est « Album Work », et ceux que tu ne ranges pas ici passent après les autres. Pour créer un album : Photo → Albums Work → +. Pour envoyer une série sur /work (ou un album sur /series) : change « Où s’affiche-t-elle ? » dans le document. ' +
        PUBLISH_HINT,
      validation: (Rule) => Rule.unique(),
      components: { input: WorkOrderInput },
    }),
  ],
  preview: { prepare: () => ({ title: WORK_PAGE.title }) },
});

export const pageSchemas = [hubPageSchema, homePageSchema, workPageSchema, ...bodyPageSchemas];
