import { defineArrayMember, defineField, defineType } from 'sanity';
import { PhotoOrderInput } from '../inputs/PhotoOrderInput';
import { PhotoOrderItem } from '../inputs/PhotoOrderItem';

export const seriesSchema = defineType({
  name: 'series',
  title: 'Série ou album Work',
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
    // OÙ la série s'affiche. Une seule décision, prise ICI, sur le document :
    // avant le 2026-11-28 l'appartenance à /work se lisait dans un AUTRE document
    // (`workPage.collections`) et la série disparaissait de /series sans aucun
    // signe sur elle. `workPage.collections` n'est plus que l'ORDRE des onglets
    // (clé de tri, CLAUDE.md §11.12). Absent = « series » : les documents d'avant
    // la migration restent valides, sans erreur à l'ouverture.
    defineField({
      name: 'destination',
      title: 'Où s’affiche-t-elle ?',
      type: 'string',
      options: {
        list: [
          { title: 'Série — page /series (un récit, une pile à ouvrir)', value: 'series' },
          { title: 'Album Work — page /work (une collection par genre, un onglet)', value: 'work' },
        ],
        layout: 'radio',
      },
      initialValue: 'series',
      description:
        'Une série s’affiche sur /series, un album Work sur /work — jamais les deux. L’adresse /series/<slug> reste en ligne dans les deux cas (elle est déjà indexée). Les photos, leur ordre et la couverture se règlent ici, comme avant ; l’ordre des onglets de /work, lui, se règle dans Work → Ordre des albums.',
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
        'Glisser-déposer pour choisir l’ordre d’affichage des photos de la série sur le site. Facultatif : les photos que tu n’ajoutes pas ici s’affichent APRÈS celles qui y sont, de la plus récente à la plus ancienne — une photo nouvellement rattachée à la série arrive donc en dernier, à toi de la remonter si tu veux. La 1ʳᵉ photo de cette liste sert aussi de couverture quand « Photo de couverture » est vide. « Remove » sur une photo la retire DE LA SÉRIE, pas seulement de l’ordre : elle reste dans « Toutes » et dans ses autres séries. ℹ️ Après « Publish », le site en ligne se met à jour tout seul en 3 à 4 minutes.',
      validation: (Rule) => Rule.unique(),
      components: { input: PhotoOrderInput },
    }),
    defineField({
      name: 'subtitle',
      title: 'Sous-titre (SEO)',
      type: 'string',
      description:
        'Description de la page /series/<slug> dans Google (et dans les aperçus de partage). 140–160 caractères idéalement.',
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
      year: 'year',
      destination: 'destination',
      media: 'coverPhoto.image',
    },
    prepare({ title, year, destination, media }) {
      // Le libellé de destination figure partout où la série est listée ou
      // choisie (recherche, champ « Séries » d'une photo) : on voit toujours
      // de quelle page il s'agit.
      const where = destination === 'work' ? 'Album Work' : 'Série';
      return {
        title,
        subtitle: year ? `${where} · ${year}` : where,
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
