import { defineArrayMember, defineField, defineType } from 'sanity';
import { NoteRefInput } from '../inputs/NoteRefInput';
import { assetWithinCap } from '../validation/assetWithinCap';
import { editorialBlockType, editorialBodyDescription } from './pageFields';
import type { FigureName } from '@/lib/journal/types';

/**
 * LE JOURNAL — articles et séries d'articles (2026-10-17). Rubrique à part
 * dans le Studio, séparée de tout ce qui touche à la photo ; elle deviendra
 * son propre espace (« workspace ») quand le Studio partira sur
 * studio.amatencio.com.
 *
 * Le rendu de chaque bloc est décrit dans le brand book §14. Ce fichier ne
 * fixe que ce que l'auteur peut écrire.
 *
 * Deux règles qui tiennent tout le reste :
 * - **Les références vivent sur l'ARTICLE** (champ `references`), et le
 *   corps ne fait que les APPELER (`journalNoteRef`, qui pointe le `_key`
 *   d'une entrée). L'auteur choisit dans une liste, il ne tape jamais une clé.
 *   Le site numérote dans l'ordre du premier appel.
 * - **Les notes « à trancher »** (`journalDraftNote`, `journalDraftBlock`)
 *   sont les crochets d'un brouillon. Le site les affiche, lettrées ; un
 *   article prêt à paraître n'en a plus.
 */

/** Toute citation d'une phrase par l'auteur — comparée au texte sans casse ni ponctuation finale. */
function plain(s: string) {
  return s.toLowerCase().replace(/[\s  ]+/g, ' ').replace(/[.…]+$/, '').trim();
}

type PTBlock = { _type: string; children?: { _type: string; text?: string }[] };

function bodyText(body: unknown): string {
  if (!Array.isArray(body)) return '';
  return (body as PTBlock[])
    .filter((b) => b._type === 'block')
    .map((b) => (b.children ?? []).map((c) => c.text ?? '').join(''))
    .join(' ');
}

// ── Langues (2026-10-18, lib/journal/i18n.ts) ──────────────────────────────

const LANGUAGE_OPTIONS = [
  { title: 'Français', value: 'fr' },
  { title: 'English', value: 'en' },
  { title: 'Русский', value: 'ru' },
];

/** Une traduction (anglais, russe) hérite de son original : date, série, partie. */
const isTranslation = (document: Record<string, unknown> | undefined) =>
  Boolean(document?.language && document.language !== 'fr');

/**
 * Les traductions d'une série ou de la signature : un objet par langue, les
 * mêmes champs que l'original. Le français reste dans les champs du document.
 */
function translationsField(fields: (lang: 'en' | 'ru') => ReturnType<typeof defineField>[]) {
  return defineField({
    name: 'translations',
    title: 'Traductions',
    description: 'Les versions anglaise et russe. Vides : le site affiche le français.',
    type: 'object',
    options: { collapsible: true, collapsed: true },
    fields: (['en', 'ru'] as const).map((lang) =>
      defineField({
        name: lang,
        title: lang === 'en' ? 'English' : 'Русский',
        type: 'object',
        fields: fields(lang),
      }),
    ),
  });
}

// ── Objets en ligne (dans un paragraphe) ──────────────────────────────────

export const journalNoteRef = defineType({
  name: 'journalNoteRef',
  title: 'Appel de référence',
  type: 'object',
  fields: [
    defineField({
      name: 'refKey',
      title: 'Référence appelée',
      description: 'Choisie parmi les références de l’article (champ « Références », en bas du formulaire).',
      type: 'string',
      components: { input: NoteRefInput },
      validation: (Rule) =>
        Rule.required().custom((value, context) => {
          const refs = (context.document?.references ?? []) as { _key: string }[];
          if (value && !refs.some((r) => r._key === value)) {
            return 'Cette référence n’existe plus dans la liste de l’article.';
          }
          return true;
        }),
    }),
  ],
  preview: {
    select: { refKey: 'refKey' },
    prepare: ({ refKey }) => ({ title: refKey ? `Réf. ${refKey}` : 'Réf. à choisir' }),
  },
});

export const journalDraftNote = defineType({
  name: 'journalDraftNote',
  title: 'Note à trancher',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Question à trancher',
      description: 'Ce qui reste à décider ou vérifier à cet endroit. S’affiche en marge, lettrée (a, b, c), avec l’étiquette « À TRANCHER ». À retirer avant de publier pour de bon.',
      type: 'text',
      rows: 2,
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { text: 'text' },
    prepare: ({ text }) => ({ title: `À trancher : ${text ?? ''}` }),
  },
});

// ── Blocs (entre deux paragraphes) ─────────────────────────────────────────

export const journalPullQuote = defineType({
  name: 'journalPullQuote',
  title: 'Citation en exergue',
  type: 'object',
  fields: [
    defineField({
      name: 'text',
      title: 'Phrase reprise',
      description: 'Une phrase du texte, MOT POUR MOT, posée juste après le paragraphe d’où elle vient. Deux ou trois par article, jamais deux de suite. Les guillemets sont ajoutés par le site.',
      type: 'text',
      rows: 3,
      validation: (Rule) => [
        Rule.required().max(220),
        Rule.custom((value: string | undefined, context) =>
          !value || plain(bodyText(context.document?.body)).includes(plain(value))
            ? true
            : 'Cette phrase ne se retrouve pas telle quelle dans le texte de l’article.',
        ).warning(),
      ],
    }),
  ],
  preview: {
    select: { text: 'text' },
    prepare: ({ text }) => ({ title: `« ${text ?? ''} »`, subtitle: 'Citation en exergue' }),
  },
});

/**
 * Les figures dessinées, préfixées par l'article qui les porte : la liste est
 * commune à tous les articles, et elle grandit.
 */
const FIGURE_OPTIONS: { title: string; value: FigureName }[] = [
  { title: 'Ni maître ni esclave — La boucle corps-cerveau et le décalage', value: 'loop' },
  { title: 'Ni maître ni esclave — La cascade intérieure du samedi matin', value: 'cascade' },
  { title: 'Ni maître ni esclave — Maître, esclave ou pont', value: 'bridge' },
  { title: 'Protéger tout le monde — La bulle et le retour du réel', value: 'bubble' },
  { title: 'Protéger tout le monde — Deux façons de se perdre', value: 'drift' },
  { title: 'Protéger tout le monde — Protégés contre exposés (LEAP, Amish)', value: 'exposure' },
  { title: 'Protéger tout le monde — Les quatre générations d’Ibn Khaldoun', value: 'generations' },
  { title: 'Protéger tout le monde — Les couches, jusqu’au vote', value: 'layers' },
  { title: 'Protéger tout le monde — L’épreuve traverse les couches', value: 'shock' },
];

export const journalFigure = defineType({
  name: 'journalFigure',
  title: 'Figure',
  type: 'object',
  fields: [
    defineField({
      name: 'figure',
      title: 'Figure dessinée',
      description: 'Les figures sont dessinées une à une (SVG), et numérotées toutes seules dans l’ordre de l’article (Fig. 1, Fig. 2…). Pour en ajouter une, la demander : elle apparaîtra dans cette liste.',
      type: 'string',
      options: {
        list: FIGURE_OPTIONS,
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { figure: 'figure' },
    prepare: ({ figure }) => ({
      title:
        FIGURE_OPTIONS.find((o) => o.value === figure)?.title ??
        'Figure à choisir',
      subtitle: 'Figure',
    }),
  },
});

/**
 * Une image dans le texte (2026-10-18). Même plafond que les photos
 * (`assetWithinCap`, 2048 px) : une photo d'auteur glissée ici ne doit pas
 * rester récupérable en pleine résolution (CLAUDE.md §11.12).
 */
export const journalImage = defineType({
  name: 'journalImage',
  title: 'Image',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      validation: (Rule) => Rule.required().custom(assetWithinCap),
    }),
    defineField({
      name: 'alt',
      title: 'Description (texte alternatif)',
      description: 'Ce que l’image montre, en une phrase courte, pour ceux qui ne la voient pas (lecteurs d’écran, Google).',
      type: 'string',
      validation: (Rule) => Rule.required().max(200),
    }),
    defineField({
      name: 'caption',
      title: 'Légende',
      description: 'Facultative, sous l’image.',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'wide',
      title: 'Toute la largeur de la colonne',
      description: 'Éteint : l’image a la largeur du texte. Allumé : celle de la colonne, plus large.',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: { media: 'image', alt: 'alt', caption: 'caption' },
    prepare: ({ media, alt, caption }) => ({ title: caption || alt || 'Image', subtitle: 'Image', media }),
  },
});

export const journalTable = defineType({
  name: 'journalTable',
  title: 'Tableau',
  type: 'object',
  fields: [
    defineField({
      name: 'head',
      title: 'En-têtes de colonnes',
      type: 'array',
      of: [defineArrayMember({ type: 'string' })],
      validation: (Rule) => Rule.required().min(2),
    }),
    defineField({
      name: 'rows',
      title: 'Lignes',
      description: 'Une ligne = autant de cases que d’en-têtes, dans le même ordre. La première case sert de titre de fiche sur téléphone.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'journalTableRow',
          title: 'Ligne',
          fields: [defineField({ name: 'cells', title: 'Cases', type: 'array', of: [defineArrayMember({ type: 'string' })] })],
          preview: {
            select: { cells: 'cells' },
            prepare: ({ cells }) => ({ title: (cells as string[] | undefined)?.join('  ·  ') ?? '' }),
          },
        }),
      ],
      validation: (Rule) =>
        Rule.custom((rows, context) => {
          const n = ((context.parent as { head?: string[] } | undefined)?.head ?? []).length;
          const bad = ((rows ?? []) as { cells?: string[] }[]).findIndex((r) => (r.cells ?? []).length !== n);
          return bad === -1 ? true : `La ligne ${bad + 1} n’a pas ${n} cases.`;
        }),
    }),
  ],
  preview: {
    select: { head: 'head', rows: 'rows' },
    prepare: ({ head, rows }) => ({
      title: `Tableau — ${(head as string[] | undefined)?.join(', ') ?? ''}`,
      subtitle: `${(rows as unknown[] | undefined)?.length ?? 0} lignes`,
    }),
  },
});

export const journalVerdicts = defineType({
  name: 'journalVerdicts',
  title: 'Bilan de verdicts',
  type: 'object',
  fields: [
    defineField({
      name: 'rows',
      title: 'Idées',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'journalVerdict',
          title: 'Idée',
          fields: [
            defineField({ name: 'idea', title: 'Ce que j’ai déduit', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'prior', title: 'Ce qui existait', type: 'string' }),
            defineField({ name: 'verdict', title: 'Verdict (mes mots)', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({
              name: 'kind',
              title: 'Famille',
              description: 'Décide de la marque dessinée : disque plein, demi-disque, anneau, anneau barré.',
              type: 'string',
              options: {
                list: [
                  { title: 'Converge', value: 'converge' },
                  { title: 'Converge avec réserve', value: 'nuance' },
                  { title: 'Ouvert, à tester', value: 'open' },
                  { title: 'Ne tient pas', value: 'fails' },
                ],
                layout: 'radio',
              },
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: { select: { title: 'idea', subtitle: 'verdict' } },
        }),
      ],
    }),
  ],
  preview: {
    select: { rows: 'rows' },
    prepare: ({ rows }) => ({ title: 'Bilan de verdicts', subtitle: `${(rows as unknown[] | undefined)?.length ?? 0} idées` }),
  },
});

export const journalDraftBlock = defineType({
  name: 'journalDraftBlock',
  title: 'Paragraphe à trancher',
  type: 'object',
  fields: [
    defineField({ name: 'text', title: 'Question à trancher', type: 'text', rows: 2, validation: (Rule) => Rule.required() }),
  ],
  preview: {
    select: { text: 'text' },
    prepare: ({ text }) => ({ title: `À trancher : ${text ?? ''}` }),
  },
});

// ── Documents ──────────────────────────────────────────────────────────────

export const journalSeries = defineType({
  name: 'journalSeries',
  title: 'Série d’articles',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Titre', type: 'string', validation: (Rule) => Rule.required() }),
    defineField({
      name: 'slug',
      title: 'Identifiant',
      type: 'slug',
      description: 'L’adresse de la page de la série : blog.amatencio.com/serie/<identifiant>. Ne plus la changer une fois la page partagée.',
      options: { source: 'title' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Présentation',
      description:
        'Deux ou trois phrases : de quoi parle la série, pour qui. Affichée en tête de sa page, et reprise par Google sous le titre (les 160 premiers signes). Vide : une phrase générée à partir des titres.',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(400).warning('Au-delà de 400 signes, la présentation devient un article.'),
    }),
    translationsField((lang) => [
      defineField({ name: 'title', title: 'Titre', type: 'string' }),
      defineField({
        name: 'slug',
        title: 'Identifiant',
        description: `L’adresse de la page : blog.amatencio.com/${lang}/${lang === 'en' ? 'series' : 'seriya'}/<identifiant>. En caractères latins.`,
        type: 'slug',
        options: { source: `translations.${lang}.title` },
      }),
      defineField({ name: 'description', title: 'Présentation', type: 'text', rows: 3 }),
    ]),
  ],
});

/**
 * Une thématique du journal (2026-10-19) : un sujet transversal, qui croise
 * les séries — un article a une série au plus, mais autant de thématiques
 * que de sujets. Document à part plutôt qu'une liste de mots libres : une
 * thématique a UN nom, et ses traductions, quel que soit l'article qui la
 * pose. Elle se crée depuis l'article même (« Create new » du champ).
 */
export const journalTag = defineType({
  name: 'journalTag',
  title: 'Thématique',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Nom',
      description: 'Un ou deux mots, au singulier de préférence (« Mémoire », « Ville »).',
      type: 'string',
      validation: (Rule) => Rule.required().max(40),
    }),
    defineField({
      name: 'slug',
      title: 'Identifiant',
      description: 'L’adresse de l’accueil filtré sur cette thématique : blog.amatencio.com/?theme=<identifiant>. Ne plus la changer une fois partagée.',
      type: 'slug',
      options: { source: 'title' },
      validation: (Rule) => Rule.required(),
    }),
    translationsField(() => [defineField({ name: 'title', title: 'Nom', type: 'string' })]),
  ],
  preview: {
    select: { title: 'title', en: 'translations.en.title', ru: 'translations.ru.title' },
    prepare: ({ title, en, ru }) => ({ title, subtitle: [en, ru].filter(Boolean).join(' · ') || 'Pas encore traduite' }),
  },
});

export const post = defineType({
  name: 'post',
  title: 'Article',
  type: 'document',
  fields: [
    defineField({
      name: 'language',
      title: 'Langue',
      description: 'Une traduction est un article à part, qui pointe son original français.',
      type: 'string',
      options: { list: LANGUAGE_OPTIONS, layout: 'radio', direction: 'horizontal' },
      initialValue: 'fr',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'translationOf',
      title: 'Traduction de',
      description: 'L’article français dont celui-ci est la traduction. Date, série et partie viennent de lui.',
      type: 'reference',
      to: [{ type: 'post' }],
      options: { filter: '!defined(language) || language == "fr"' },
      hidden: ({ document }) => !isTranslation(document),
      validation: (Rule) =>
        Rule.custom((value, context) =>
          isTranslation(context.document) && !value ? 'Une traduction doit pointer son original français.' : true,
        ),
    }),
    // Traduction incrémentale (lib/journal/translate/incremental.ts) : le
    // français de chaque unité tel qu'il était quand la traduction a été
    // écrite. Écrit par le traducteur, jamais à la main — d'où `hidden`.
    defineField({
      name: 'translationSource',
      title: 'Source de la traduction',
      type: 'text',
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: 'title',
      title: 'Titre',
      description: 'Une phrase courte. Si le titre est « X : Y », mettre X ici et Y en sous-titre.',
      type: 'string',
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: 'dek',
      title: 'Sous-titre',
      description: 'Sous le titre, et dans la liste du journal quand on déplie un article.',
      type: 'string',
      validation: (Rule) => Rule.required().max(200),
    }),
    defineField({
      name: 'slug',
      title: 'Adresse',
      description: 'La fin de l’adresse de l’article : blog.amatencio.com/<adresse>. Ne plus la changer une fois l’article partagé : les liens et Google la gardent.',
      type: 'slug',
      options: { source: 'title' },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'date',
      title: 'Date',
      type: 'date',
      initialValue: () => new Date().toISOString().slice(0, 10),
      hidden: ({ document }) => isTranslation(document),
      validation: (Rule) =>
        Rule.custom((value, context) => (isTranslation(context.document) || value ? true : 'La date est obligatoire.')),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Première publication',
      description: 'Posée seule au premier Publish, jamais modifiée ensuite. Départage deux articles du même jour : le dernier publié passe devant.',
      type: 'datetime',
      readOnly: true,
      hidden: ({ document }) => isTranslation(document) || !document?.publishedAt,
    }),
    defineField({
      name: 'series',
      title: 'Série',
      type: 'reference',
      to: [{ type: 'journalSeries' }],
      hidden: ({ document }) => isTranslation(document),
    }),
    defineField({
      name: 'part',
      title: 'Partie',
      description: 'Le rang de l’article dans sa série (1, 2, 3…).',
      type: 'number',
      hidden: ({ document }) => !document?.series || isTranslation(document),
      validation: (Rule) => Rule.integer().min(1),
    }),
    defineField({
      name: 'tags',
      title: 'Thématiques',
      description:
        'Les sujets de l’article : ils trient l’accueil du journal. Taper pour retrouver une thématique existante ; « Create new » en crée une sans quitter l’article — la publier aussi, sinon elle n’apparaît pas. Les traductions reprennent celles-ci.',
      type: 'array',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'journalTag' }] })],
      hidden: ({ document }) => isTranslation(document),
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: 'cover',
      title: 'Image de couverture',
      description:
        'Révélée au survol de l’article, sur la page d’accueil du journal. Recadrée en portrait (4:5) : placer le point d’intérêt avec le bouton de recadrage. Les traductions reprennent celle-ci.',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ document }) => isTranslation(document),
      fields: [
        defineField({
          name: 'alt',
          title: 'Description (texte alternatif)',
          description: 'Ce que l’image montre, en une phrase courte.',
          type: 'string',
        }),
      ],
      validation: (Rule) => [
        Rule.custom(assetWithinCap),
        Rule.custom((value, context) =>
          isTranslation(context.document) || value ? true : 'Sans image de couverture, rien n’apparaît au survol de l’article sur l’accueil.',
        ).warning(),
      ],
    }),
    defineField({
      name: 'body',
      title: 'Texte',
      description:
        'Le premier paragraphe devient le chapô (plus grand, en gras). Le menu « + » insère une citation en exergue, une figure, une image, un tableau, un bilan ou une question à trancher ; dans une phrase, le bouton d’objet en ligne insère un appel de référence ou une note à trancher.',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            { title: 'Paragraphe', value: 'normal' },
            { title: 'Intertitre', value: 'h2' },
          ],
          lists: [],
          marks: {
            decorators: [
              { title: 'Gras', value: 'strong' },
              { title: 'Emphase', value: 'em' },
              { title: 'Titre d’œuvre', value: 'cite' },
            ],
            annotations: [],
          },
          of: [defineArrayMember({ type: 'journalNoteRef' }), defineArrayMember({ type: 'journalDraftNote' })],
        }),
        defineArrayMember({ type: 'journalPullQuote' }),
        defineArrayMember({ type: 'journalFigure' }),
        defineArrayMember({ type: 'journalImage' }),
        defineArrayMember({ type: 'journalTable' }),
        defineArrayMember({ type: 'journalVerdicts' }),
        defineArrayMember({ type: 'journalDraftBlock' }),
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'references',
      title: 'Références',
      description: 'La bibliographie, dans l’ordre où elle doit s’afficher. Le texte les appelle par le bouton « Appel de référence ».',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'journalReference',
          title: 'Référence',
          fields: [
            defineField({
              name: 'citation',
              title: 'Référence',
              description: 'Auteur, année, titre, revue. Sélectionner un titre d’œuvre et le marquer « Titre d’œuvre ».',
              type: 'array',
              of: [
                defineArrayMember({
                  type: 'block',
                  styles: [{ title: 'Paragraphe', value: 'normal' }],
                  lists: [],
                  marks: { decorators: [{ title: 'Titre d’œuvre', value: 'cite' }], annotations: [] },
                }),
              ],
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: { citation: 'citation' },
            prepare: ({ citation }) => ({ title: bodyText(citation) || 'Référence vide' }),
          },
        }),
      ],
    }),
    defineField({
      name: 'referencesNote',
      title: 'Note sur les références',
      description: 'Facultative, sous le titre « Références » (date de vérification, réserves).',
      type: 'text',
      rows: 2,
    }),
    // Référencement (2026-10-17). Facultatifs : à défaut, Google reçoit le
    // titre et le sous-titre. Utiles quand le titre est une formule (« Ni
    // maître ni esclave ») et ne contient pas les mots que les gens cherchent.
    defineField({
      name: 'seoTitle',
      title: 'Titre pour Google',
      description:
        'Facultatif. Le titre affiché dans les résultats de recherche, s’il doit différer du titre : y mettre les mots qu’un lecteur taperait. ~60 signes au plus, au-delà Google le coupe.',
      type: 'string',
      group: 'seo',
      validation: (Rule) => Rule.max(70).warning('Au-delà de ~60 signes, Google coupe le titre.'),
    }),
    defineField({
      name: 'seoDescription',
      title: 'Description pour Google',
      description:
        'Facultative. Les deux lignes sous le titre dans les résultats. À défaut, le sous-titre. 120 à 160 signes : dire de quoi parle l’article et ce que le lecteur y trouvera.',
      type: 'text',
      rows: 3,
      group: 'seo',
      validation: (Rule) => Rule.max(170).warning('Au-delà de ~160 signes, Google coupe la description.'),
    }),
  ],
  // Un seul groupe : l'onglet par défaut reste « Tous les champs », et
  // « Référencement » isole les deux champs pour Google. Un groupe `default`
  // masquerait tous les champs qui n'en déclarent pas.
  groups: [{ name: 'seo', title: 'Référencement' }],
  orderings: [{ title: 'Date, récent d’abord', name: 'dateDesc', by: [{ field: 'date', direction: 'desc' }] }],
  preview: {
    select: {
      title: 'title',
      language: 'language',
      date: 'date',
      series: 'series.title',
      part: 'part',
      originalDate: 'translationOf.date',
      originalSeries: 'translationOf.series.title',
      originalPart: 'translationOf.part',
    },
    prepare: ({ title, language, date, series, part, originalDate, originalSeries, originalPart }) => {
      const s = series ?? originalSeries;
      const p = part ?? originalPart;
      return {
        title,
        subtitle: [
          String(language ?? 'fr').toUpperCase(),
          date ?? originalDate,
          s ? `${s}${p ? ` ${p}` : ''}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      };
    },
  },
});

/**
 * Ce que le journal dit de son auteur, au pied de chaque article. Singleton
 * (`_id` === `_type`, cf. SINGLETON_TYPES dans studio.config.ts). Vide : la
 * phrase de repli de `lib/site/author.ts`.
 */
export const journalSettings = defineType({
  name: 'journalSettings',
  title: 'Signature des articles',
  type: 'document',
  fields: [
    defineField({
      name: 'signature',
      title: 'Signature',
      description:
        'Une ou deux phrases sous ton nom, à la fin de chaque article : ce que tu fais, ce sur quoi tu écris. Ton nom s’ajoute tout seul devant. Vide : la phrase par défaut. ℹ️ Après « Publish », le journal se met à jour au prochain déploiement.',
      type: 'text',
      rows: 3,
      validation: (Rule) => Rule.max(300),
    }),
    translationsField(() => [defineField({ name: 'signature', title: 'Signature', type: 'text', rows: 3 })]),
  ],
  preview: { prepare: () => ({ title: 'Signature des articles' }) },
});

/**
 * La page « À propos de ce journal » (`blog.amatencio.com/a-propos/`, et ses
 * traductions), liée sous le titre de l'accueil du journal (2026-10-19).
 * Singleton (`_id` === `_type`). Vide : la description du journal
 * (`DICT.siteDescription`) en un paragraphe — filet de sécurité, pas source.
 */
export const journalAboutPage = defineType({
  name: 'journalAboutPage',
  title: 'À propos du journal',
  type: 'document',
  fields: [
    defineField({
      name: 'body',
      title: 'Texte',
      description: editorialBodyDescription(
        'Le texte de la page « À propos de ce journal », sous le titre « À propos » : pourquoi ce journal, ce qu’on y lit, à quel rythme, comment il est écrit et sourcé.',
      ),
      type: 'array',
      of: [editorialBlockType],
    }),
    translationsField(() => [
      defineField({ name: 'body', title: 'Texte', type: 'array', of: [editorialBlockType] }),
    ]),
  ],
  preview: { prepare: () => ({ title: 'À propos du journal' }) },
});

export const journalSchemas = [
  journalAboutPage,
  post,
  journalSettings,
  journalSeries,
  journalTag,
  journalNoteRef,
  journalDraftNote,
  journalPullQuote,
  journalFigure,
  journalImage,
  journalTable,
  journalVerdicts,
  journalDraftBlock,
];
