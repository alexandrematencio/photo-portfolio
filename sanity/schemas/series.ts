import { defineArrayMember, defineField, defineType } from 'sanity';
import { PhotoOrderInput } from '../inputs/PhotoOrderInput';
import { PhotoOrderItem } from '../inputs/PhotoOrderItem';

export const seriesSchema = defineType({
  name: 'series',
  title: 'Série',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Titre',
      type: 'string',
      validation: (Rule) => Rule.required().min(2).max(120),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
        isUnique: async (slug, context) => {
          const { document, getClient } = context;
          const client = getClient({ apiVersion: '2026-01-01' });
          const id = document?._id.replace(/^drafts\./, '');
          const params = { draft: `drafts.${id}`, published: id, slug };
          const query = `!defined(*[_type == "series" && slug.current == $slug && !(_id in [$draft, $published])][0]._id)`;
          return client.fetch<boolean>(query, params);
        },
      },
      validation: (Rule) => Rule.required(),
    }),
    // Cover + ordre des photos AVANT les champs de texte : ce sont les deux
    // réglages que l'éditeur vient chercher, ils ne doivent pas se trouver
    // sous une Description potentiellement longue (elle poussait « Ordre des
    // photos » hors de l'écran — le champ existait sans être trouvable).
    defineField({
      name: 'coverPhoto',
      title: 'Photo de couverture',
      type: 'reference',
      to: [{ type: 'photo' }],
      description:
        'Optionnel. Si vide, le front-end retombera sur la première photo de la série.',
    }),
    defineField({
      name: 'photoOrder',
      title: 'Ordre des photos',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'photo' }],
          options: {
            // Ne proposer QUE les photos rattachées à cette série. Le champ est
            // une clé de tri, jamais une liste d'appartenance : on ne doit pas
            // pouvoir y glisser une photo qui n'est pas dans la série.
            // `document._id` vaut `drafts.<id>` sur un brouillon, alors que les
            // photos référencent l'id publié — d'où le strip.
            // Repli sur '' plutôt que de laisser passer une exception : une
            // erreur levée ici casserait toute la recherche de références.
            filter: ({ document }) => ({
              filter: '$seriesId in series[]._ref',
              params: {
                seriesId: (document?._id ?? '').replace(/^drafts\./, ''),
              },
            }),
          },
          // « Remove » retire la photo DE LA SÉRIE (et pas seulement de
          // l'ordre, ce qui ne changeait rien à l'écran). Cf. PhotoOrderItem.
          components: { item: PhotoOrderItem },
        }),
      ],
      description:
        'Glisser-déposer pour choisir l’ordre d’affichage des photos de la série sur le site. Facultatif : les photos que tu n’ajoutes pas ici s’affichent APRÈS celles qui y sont, de la plus récente à la plus ancienne — une photo nouvellement rattachée à la série arrive donc en dernier, à toi de la remonter si tu veux. La 1ʳᵉ photo de cette liste sert aussi de couverture quand « Photo de couverture » est vide. « Remove » sur une photo la retire DE LA SÉRIE, pas seulement de l’ordre : elle reste dans « Toutes » et dans ses autres séries. ⚠️ Site statique : les changements n’apparaissent en ligne qu’après « Publish » + redéploiement.',
      validation: (Rule) => Rule.unique(),
      components: { input: PhotoOrderInput },
    }),
    defineField({
      name: 'subtitle',
      title: 'Sous-titre (SEO)',
      type: 'string',
      description:
        'Sert de seed pour la meta description si une page /series/[slug] existe un jour. 140–160 caractères idéalement.',
      validation: (Rule) => Rule.max(160),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'year',
      title: 'Année',
      type: 'number',
      description: 'Année principale de la série (utilisée pour le regroupement Par année).',
      validation: (Rule) => Rule.min(1900).max(new Date().getFullYear()),
    }),
    defineField({
      name: 'order',
      title: 'Ordre (repli)',
      type: 'number',
      description:
        'Repli historique — l’ordre de la page Series se règle désormais au glisser-déposer dans Réglages du site → Ordre des séries, qui GAGNE sur ce nombre. Il ne sert plus qu’à trier les séries absentes de cette liste (plus bas = plus tôt).',
      initialValue: 100,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'year',
      media: 'coverPhoto.image',
    },
    prepare({ title, subtitle, media }) {
      return {
        title,
        subtitle: subtitle ? String(subtitle) : undefined,
        media,
      };
    },
  },
  orderings: [
    {
      title: 'Ordre',
      name: 'orderAsc',
      by: [{ field: 'order', direction: 'asc' }],
    },
    {
      title: 'Année (récent → ancien)',
      name: 'yearDesc',
      by: [{ field: 'year', direction: 'desc' }],
    },
  ],
});
