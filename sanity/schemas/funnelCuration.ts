import { defineArrayMember, defineField, defineType } from 'sanity';

/**
 * La « funnel curation » — la sélection de photos du tunnel de DESIGN-FOLIO
 * (`tools/curation.mjs` là-bas), hébergée ici parce que c'est ici que vivent
 * les photos.
 *
 * **Invisible sur amatencio-photo PAR CONSTRUCTION** : c'est un type de
 * document à part, qu'aucune requête du site ne lit (`lib/sanity/queries.ts`).
 * Ni une série avec un drapeau, ni un champ de `siteSettings` : une série
 * « spéciale » aurait dû être exclue de CHAQUE lecture des séries (/series,
 * `seriesLinks` de la home, Dashboard, parser d'import, « Ajouter à une
 * série »…), et le premier oubli l'aurait publiée. Ici, il n'y a rien à exclure.
 *
 * Corollaire : l'appartenance vit sur CE document, jamais sur la photo — rien
 * dans `photo` ne dit qu'elle est dans le tunnel.
 *
 * Singleton, id figé `funnelCuration` (structure + `SINGLETON_TYPES`).
 */
export const funnelCurationSchema = defineType({
  name: 'funnelCuration',
  title: 'Funnel curation',
  type: 'document',
  fields: [
    defineField({
      name: 'photos',
      title: 'Photos du tunnel (design-folio)',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'photo' }],
        }),
      ],
      description:
        'La galerie du tunnel de design-folio, dans cet ordre (glisser-déposer pour réordonner). Invisible sur amatencio-photo : aucune page du site ne lit cette liste, et rien sur une photo ne dit qu’elle en fait partie. Indépendante de « Masquer du site » : une photo masquée reste dans le tunnel. Pour ajouter vite, ouvre une photo n’importe où et utilise « Ajouter à la funnel curation » dans son menu « ⋯ » — enregistré tout de suite, sans Publish. Ici en revanche, comme partout dans un formulaire, il faut « Publish ».',
      validation: (Rule) => Rule.unique(),
    }),
  ],
  preview: {
    select: { photos: 'photos' },
    prepare: ({ photos }) => ({
      title: 'Funnel curation',
      subtitle: `${Array.isArray(photos) ? photos.length : 0} photo(s) — tunnel design-folio`,
    }),
  },
});
