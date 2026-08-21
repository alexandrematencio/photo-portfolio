import { defineField, defineType } from 'sanity';

/**
 * Taxonomies du catalogue : style, boîtier, objectif.
 *
 * Trois documents quasi identiques, générés par une factory pour éviter la
 * dérive. Chacun porte :
 * - `title`  : label affiché sur le site (EN) et dans le Studio.
 * - `slug`   : identifiant stable (groupes /archives, ids déterministes).
 * - `aliases`: variantes reconnues par le parser de nom de fichier
 *   (`npm run upload-photos`) et par le matching EXIF (Model / LensModel).
 *   Ex. style « Street » → aliases ["sp", "streetphotography"] ; boîtier
 *   « Fuji X-PRO2 » → alias "X-Pro2" (la chaîne EXIF exacte).
 *
 * Les scripts créent ces documents à la volée avec des _id déterministes
 * (`style-<slug>`, `camera-<slug>`, `lens-<slug>`) — voir scripts/upload-photos.ts.
 */
function taxonomySchema(opts: {
  name: 'style' | 'camera' | 'lens';
  title: string;
  titleFieldLabel: string;
  aliasDescription: string;
}) {
  return defineType({
    name: opts.name,
    title: opts.title,
    type: 'document',
    fields: [
      defineField({
        name: 'title',
        title: opts.titleFieldLabel,
        type: 'string',
        validation: (Rule) => Rule.required().min(2).max(80),
      }),
      defineField({
        name: 'slug',
        title: 'Slug',
        type: 'slug',
        options: { source: 'title', maxLength: 96 },
        validation: (Rule) => Rule.required(),
      }),
      defineField({
        name: 'aliases',
        title: 'Alias',
        type: 'array',
        of: [{ type: 'string' }],
        description: opts.aliasDescription,
      }),
    ],
    preview: {
      select: { title: 'title', aliases: 'aliases' },
      prepare: ({ title, aliases }) => ({
        title: title ?? '—',
        subtitle:
          Array.isArray(aliases) && aliases.length > 0
            ? `alias : ${aliases.join(', ')}`
            : undefined,
      }),
    },
  });
}

export const styleSchema = taxonomySchema({
  name: 'style',
  title: 'Style',
  titleFieldLabel: 'Nom du style',
  aliasDescription:
    'Variantes reconnues dans les noms de fichiers à l’upload (ex. « sp », « paysage »). Insensible à la casse.',
});

export const cameraSchema = taxonomySchema({
  name: 'camera',
  title: 'Boîtier',
  titleFieldLabel: 'Nom du boîtier',
  aliasDescription:
    'Variantes reconnues à l’upload, dont la chaîne EXIF exacte du boîtier (champ « Model », ex. « X-Pro2 »).',
});

export const lensSchema = taxonomySchema({
  name: 'lens',
  title: 'Objectif',
  titleFieldLabel: 'Nom de l’objectif',
  aliasDescription:
    'Variantes reconnues à l’upload, dont la chaîne EXIF exacte (champ « LensModel »). Les objectifs manuels (ex. Meike MF) n’écrivent pas d’EXIF : le nom de fichier est alors la seule source.',
});
