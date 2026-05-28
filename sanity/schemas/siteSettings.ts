import { defineArrayMember, defineField, defineType } from 'sanity';
import {
  NormalBlock,
  H2Block,
  H3Block,
  H4Block,
} from '../components/EditorBlocks';

/**
 * Shared block-type for editorial PT bodies (about, contact, digital-agency).
 * Custom `styles` use the EditorBlocks components so the Studio preview
 * matches the proportional typography rendered by `PortableBody` (editorial
 * variant). Default Sanity sizing made h2/h3/h4 look identical or absurdly
 * large relative to body — editors couldn't tell what the site would do.
 */
const editorialBlockType = defineArrayMember({
  type: 'block',
  styles: [
    { title: 'Normal', value: 'normal', component: NormalBlock },
    { title: 'Heading 2', value: 'h2', component: H2Block },
    { title: 'Heading 3', value: 'h3', component: H3Block },
    { title: 'Heading 4', value: 'h4', component: H4Block },
  ],
  // Lists kept as default — site doesn't render them in editorial variant
  // yet (cf. PortableBody.tsx), so editors should avoid them for these bodies.
});

export const siteSettingsSchema = defineType({
  name: 'siteSettings',
  title: 'Réglages du site',
  type: 'document',
  // Singleton : un seul document de ce type. La structure pointe sur un ID
  // fixe ('siteSettings'). Les actions create/duplicate/delete/unpublish sont
  // filtrées via document.actions dans sanity/studio.config.ts.
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
      of: [editorialBlockType],
    }),
    defineField({
      name: 'contactBody',
      title: 'Page « Contact »',
      type: 'array',
      of: [editorialBlockType],
    }),
    defineField({
      name: 'digitalAgencyBody',
      title: 'Page « Digital Agency »',
      type: 'array',
      of: [editorialBlockType],
    }),
    defineField({
      name: 'socialsBody',
      title: 'Page « Socials »',
      type: 'array',
      of: [editorialBlockType],
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
