import { defineField, defineType } from 'sanity';

export const photoSchema = defineType({
  name: 'photo',
  title: 'Photo',
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
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Texte alternatif (accessibilité + SEO)',
          type: 'string',
          description:
            'Description sensorielle courte : lieu, sujet, ambiance. Pas de bourrage de mots-clés.',
          validation: (Rule) => Rule.required().min(5).max(200),
        }),
      ],
    }),
    defineField({
      name: 'caption',
      title: 'Légende',
      type: 'text',
      rows: 2,
    }),
    defineField({
      name: 'series',
      title: 'Série',
      type: 'reference',
      to: [{ type: 'series' }],
      description:
        'Optionnel. Une photo sans série apparaît dans la vue « Sans série » du Studio.',
      validation: (Rule) =>
        Rule.custom((value) => {
          if (!value) return 'Photo sans série — pense à la rattacher.';
          return true;
        }).warning(),
    }),
    defineField({
      name: 'category',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { title: 'Paysage', value: 'landscape' },
          { title: 'Architecture', value: 'architecture' },
          { title: 'Portrait', value: 'portrait' },
          { title: 'Photo de rue', value: 'streetphotography' },
        ],
        layout: 'radio',
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'year',
      title: 'Année',
      type: 'number',
      validation: (Rule) => Rule.required().min(1900).max(new Date().getFullYear()),
    }),
    defineField({
      name: 'location',
      title: 'Lieu',
      type: 'string',
      description: 'Ex : « Paris, France »',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'dateTaken',
      title: 'Date de prise de vue',
      type: 'date',
    }),
    defineField({
      name: 'onHomepage',
      title: 'Afficher sur la home',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'order',
      title: 'Ordre (sur la home)',
      type: 'number',
      description: 'Plus le nombre est bas, plus la photo apparaît tôt.',
      initialValue: 100,
    }),
    defineField({
      name: 'parallaxSpeed',
      title: 'Vitesse parallaxe',
      type: 'number',
      description:
        'Entre -0.5 et 0.5. Valeurs positives = monte plus vite. Default 0.1.',
      initialValue: 0.1,
      validation: (Rule) => Rule.min(-0.5).max(0.5),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'location',
      media: 'image',
    },
  },
  orderings: [
    {
      title: 'Ordre home',
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
