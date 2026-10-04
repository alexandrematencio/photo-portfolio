import { defineArrayMember, defineField, defineType } from 'sanity';
import { SeriesOrderInput } from '../inputs/SeriesOrderInput';


export const siteSettingsSchema = defineType({
  name: 'siteSettings',
  title: 'Réglages du site',
  type: 'document',
  // Singleton : un seul document de ce type. La structure pointe sur un ID
  // fixe ('siteSettings'). Les actions create/duplicate/delete/unpublish sont
  // filtrées via document.actions dans sanity/studio.config.ts.
  fields: [
    defineField({
      name: 'curation',
      title: 'Curation — photos de la home',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'photo' }],
        }),
      ],
      description:
        'La sélection affichée sur la page d’accueil, dans cet ordre (glisser-déposer pour réordonner). Les photos hors de cette liste restent visibles dans Archives. ℹ️ Après « Publish », le site en ligne se met à jour tout seul en 3 à 4 minutes.',
      validation: (Rule) => Rule.unique(),
    }),
    defineField({
      name: 'seriesOrder',
      title: 'Ordre des séries (page Series)',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'series' }],
        }),
      ],
      description:
        'L’ordre des piles sur la page Series : la 1ʳᵉ de cette liste est la 1ʳᵉ à gauche de la rangée, la dernière est tout à droite. Facultatif : les séries absentes de la liste s’affichent après celles qui y sont. Une série créée après coup arrive donc en fin de rangée, à toi de la remonter. ℹ️ Après « Publish », le site en ligne se met à jour tout seul en 3 à 4 minutes.',
      validation: (Rule) => Rule.unique(),
      components: { input: SeriesOrderInput },
    }),
    // Hero, phrase d'auteur et textes des pages éditoriales : déplacés le
    // 2026-10-05 dans un document PAR PAGE (`pages.ts`, rubrique « Pages » du
    // Studio) — un brouillon et un Publish par page, au lieu d'un seul
    // brouillon qui embarquait toutes les pages à la fois.
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
          initialValue: 5,
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
          initialValue: -400,
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
