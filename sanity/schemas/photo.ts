import { createElement } from 'react';
import { defineArrayMember, defineField, defineType } from 'sanity';
import { PhotoRowMedia } from '../components/PhotoRowMedia';
import {
  CameraSelectInput,
  LensSelectInput,
  SeriesSelectInput,
  StylesSelectInput,
} from '../inputs/photoRefSelects';

export const photoSchema = defineType({
  name: 'photo',
  title: 'Photo',
  type: 'document',
  fields: [
    // En tête de formulaire : c'est l'interrupteur qu'on vient chercher.
    // Absent = visible — les photos importées avant ce champ (ou par
    // `upload-photos`, qui ne le pose pas) n'ont rien à migrer. Côté site,
    // toute requête de photo filtre `hidden != true` (lib/sanity/queries.ts).
    defineField({
      name: 'hidden',
      title: 'Masquée du site',
      type: 'boolean',
      initialValue: false,
      description:
        'Activée : la photo disparaît de la home, de /archives et de /series. Rien n’est perdu — séries, ordre et curation restent en place, et elle y revient telle quelle quand on la réaffiche. Même geste, sans Publish, depuis le menu « ⋯ » de la photo ou l’œil à droite de sa ligne dans n’importe quelle liste. Visible sur le site en ligne au prochain déploiement.',
    }),
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
      // 'exif' en plus des défauts : Sanity stocke Model/LensModel/date à
      // l'upload (pas 'location' → pas de GPS stocké, cf. RGPD §5.5).
      options: {
        hotspot: true,
        metadata: ['blurhash', 'lqip', 'palette', 'exif'],
      },
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
      title: 'Séries',
      type: 'array',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'series' }] })],
      description:
        'Optionnel, et multiple : une même photo peut appartenir à plusieurs séries. Chaque série garde son propre ordre d’affichage (champ « Ordre des photos » côté série). Une photo sans aucune série apparaît dans la vue « Sans série » du Studio.',
      validation: (Rule) => [
        Rule.unique().error('Cette série est déjà rattachée à la photo.'),
        Rule.custom((value) =>
          Array.isArray(value) && value.length > 0
            ? true
            : 'Photo sans série — pense à la rattacher.'
        ).warning(),
      ],
      // Liste déroulante directe : ouvrir + choisir. L'input natif enferme le
      // changement derrière « ⋯ → Replace » (cf. quickRefInput.tsx).
      components: { input: SeriesSelectInput },
    }),
    defineField({
      name: 'styles',
      title: 'Styles (1 à 3)',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'style' }] }],
      description:
        'Jusqu’à 3 styles. La photo apparaît dans chaque groupe de style sur /archives.',
      // AVERTISSEMENT, pas erreur : une photo peut être importée incomplète et
      // complétée plus tard. Une erreur bloquerait sa publication depuis le
      // Studio. Le manque remonte dans les alertes du Tableau de bord.
      validation: (Rule) => [
        Rule.max(3).unique().error('3 styles maximum.'),
        Rule.custom((value) =>
          Array.isArray(value) && value.length > 0
            ? true
            : 'Aucun style — pense à en ajouter au moins un.'
        ).warning(),
      ],
      components: { input: StylesSelectInput },
    }),
    defineField({
      name: 'camera',
      title: 'Boîtier',
      type: 'reference',
      to: [{ type: 'camera' }],
      description:
        'Rempli automatiquement à l’upload (nom de fichier ou EXIF). Optionnel.',
      components: { input: CameraSelectInput },
    }),
    defineField({
      name: 'lens',
      title: 'Objectif',
      type: 'reference',
      to: [{ type: 'lens' }],
      description:
        'Rempli automatiquement à l’upload (nom de fichier ou EXIF). Les objectifs manuels doivent être donnés dans le nom de fichier. Optionnel.',
      components: { input: LensSelectInput },
    }),
    defineField({
      name: 'year',
      title: 'Année',
      type: 'number',
      validation: (Rule) => [
        Rule.min(1900).max(new Date().getFullYear()),
        Rule.custom((value) =>
          typeof value === 'number' ? true : 'Année non renseignée.'
        ).warning(),
      ],
    }),
    defineField({
      name: 'location',
      title: 'Lieu',
      type: 'string',
      description:
        'Format « Ville, Pays » — ex. « Paris, France ». /archives groupe par égalité stricte de cette chaîne : « Paris » et « Paris, France » créeraient deux groupes distincts.',
      validation: (Rule) =>
        Rule.custom((value) =>
          typeof value === 'string' && value.trim().length > 0
            ? true
            : 'Lieu non renseigné.'
        ).warning(),
    }),
    defineField({
      name: 'dateTaken',
      title: 'Date de prise de vue',
      type: 'date',
    }),
    // La sélection home ne vit plus ici : c'est l'array ordonné
    // `siteSettings.curation` (drag & drop dans Réglages du site).
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
      id: '_id',
      title: 'title',
      location: 'location',
      media: 'image',
      hidden: 'hidden',
    },
    // L'aperçu sert PARTOUT où une photo est listée — listes de Structure,
    // ordre d'une série, curation, couverture. La VIGNETTE porte donc
    // l'interrupteur de visibilité (œil fermé si masquée, menu Masquer /
    // Montrer au survol) : `media` est le seul champ d'aperçu que Sanity ne
    // valide pas — `title`, `subtitle` et `description` doivent rester des
    // scalaires (cf. PhotoRowMedia).
    prepare({ id, title, location, media, hidden }) {
      return {
        title,
        subtitle: location,
        media: createElement(PhotoRowMedia, {
          id: String(id ?? ''),
          title: String(title ?? 'La photo'),
          image: media,
          hidden: hidden === true,
        }),
      };
    },
  },
  orderings: [
    {
      title: 'Année (récent → ancien)',
      name: 'yearDesc',
      by: [{ field: 'year', direction: 'desc' }],
    },
    {
      title: 'Titre (A → Z)',
      name: 'titleAsc',
      by: [{ field: 'title', direction: 'asc' }],
    },
  ],
});
