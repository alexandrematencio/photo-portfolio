import { defineField, defineType } from 'sanity';

export const siteSettingsSchema = defineType({
  name: 'siteSettings',
  title: 'Réglages du site',
  type: 'document',
  // Singleton : un seul document de ce type
  fields: [
    defineField({
      name: 'profileImage',
      title: 'Photo de profil (homepage)',
      type: 'image',
      description: 'Affichée au centre du hero. Carrée idéalement.',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Texte alternatif',
          type: 'string',
          validation: (Rule) => Rule.required().min(3).max(120),
        }),
      ],
    }),
    defineField({
      name: 'aboutBody',
      title: 'Page « About »',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'contactBody',
      title: 'Page « Contact »',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'hireBody',
      title: 'Page « Hire Me »',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'socials',
      title: 'Réseaux sociaux',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({ name: 'platform', type: 'string', title: 'Plateforme' }),
            defineField({ name: 'url', type: 'url', title: 'URL' }),
          ],
        },
      ],
    }),
    defineField({
      name: 'motion',
      title: 'Réglages motion (scroll-physics)',
      type: 'object',
      description:
        'Bornes de distorsion de la home. Adoucies par défaut. À ajuster pour intensifier ou atténuer.',
      fields: [
        defineField({
          name: 'scaleMin',
          title: 'Échelle min (vélocité élevée)',
          type: 'number',
          initialValue: 0.94,
          validation: (Rule) => Rule.min(0.7).max(1),
        }),
        defineField({
          name: 'skewMax',
          title: 'Inclinaison max (°)',
          type: 'number',
          initialValue: 10,
          validation: (Rule) => Rule.min(0).max(30),
        }),
        defineField({
          name: 'rotXMax',
          title: 'Rotation X max (°)',
          type: 'number',
          initialValue: 15,
          validation: (Rule) => Rule.min(0).max(40),
        }),
        defineField({
          name: 'velocityDivisorScale',
          title: 'Diviseur vélocité — scale',
          type: 'number',
          initialValue: 20000,
        }),
        defineField({
          name: 'velocityDivisorSkew',
          title: 'Diviseur vélocité — skew',
          type: 'number',
          initialValue: -200,
        }),
        defineField({
          name: 'velocityDivisorRotX',
          title: 'Diviseur vélocité — rotateX',
          type: 'number',
          initialValue: -80,
        }),
      ],
    }),
  ],
  preview: { prepare: () => ({ title: 'Réglages du site' }) },
});
