import { defineArrayMember, defineField, defineType } from 'sanity';
import { NoteRefInput } from '../inputs/NoteRefInput';

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

export const journalFigure = defineType({
  name: 'journalFigure',
  title: 'Figure',
  type: 'object',
  fields: [
    defineField({
      name: 'figure',
      title: 'Figure dessinée',
      description: 'Les figures sont dessinées une à une (SVG). Pour en ajouter une, la demander : elle apparaîtra dans cette liste.',
      type: 'string',
      options: { list: [{ title: 'Fig. 1 — La boucle corps-cerveau et le décalage', value: 'loop' }], layout: 'radio' },
      validation: (Rule) => Rule.required(),
    }),
  ],
  preview: {
    select: { figure: 'figure' },
    prepare: ({ figure }) => ({ title: figure === 'loop' ? 'Fig. — La boucle corps-cerveau' : 'Figure', subtitle: 'Figure' }),
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
  ],
});

export const post = defineType({
  name: 'post',
  title: 'Article',
  type: 'document',
  fields: [
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
      validation: (Rule) => Rule.required(),
    }),
    defineField({ name: 'series', title: 'Série', type: 'reference', to: [{ type: 'journalSeries' }] }),
    defineField({
      name: 'part',
      title: 'Partie',
      description: 'Le rang de l’article dans sa série (1, 2, 3…).',
      type: 'number',
      hidden: ({ document }) => !document?.series,
      validation: (Rule) => Rule.integer().min(1),
    }),
    defineField({
      name: 'body',
      title: 'Texte',
      description:
        'Le premier paragraphe devient le chapô (plus grand, en gras). Le menu « + » insère une citation en exergue, une figure, un tableau, un bilan ou une question à trancher ; dans une phrase, le bouton d’objet en ligne insère un appel de référence ou une note à trancher.',
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
    select: { title: 'title', date: 'date', series: 'series.title', part: 'part' },
    prepare: ({ title, date, series, part }) => ({
      title,
      subtitle: [date, series ? `${series}${part ? ` ${part}` : ''}` : null].filter(Boolean).join(' · '),
    }),
  },
});

export const journalSchemas = [
  post,
  journalSeries,
  journalNoteRef,
  journalDraftNote,
  journalPullQuote,
  journalFigure,
  journalTable,
  journalVerdicts,
  journalDraftBlock,
];
