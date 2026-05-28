import { defineField, defineType } from 'sanity';

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
      name: 'coverPhoto',
      title: 'Photo de couverture',
      type: 'reference',
      to: [{ type: 'photo' }],
      description:
        'Optionnel. Si vide, le front-end retombera sur la première photo de la série.',
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
      title: 'Ordre',
      type: 'number',
      description: 'Plus le nombre est bas, plus la série apparaît tôt.',
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
