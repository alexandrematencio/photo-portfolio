import { defineArrayMember, defineField, defineType } from 'sanity';
import {
  NormalBlock,
  H2Block,
  H3Block,
  H4Block,
} from '../components/EditorBlocks';
import { SeriesOrderInput } from '../inputs/SeriesOrderInput';

// ─── Budget poids des images du hero ────────────────────────────────────────
// Cible : ≤ 300 Ko par image pour un chargement rapide sur une connexion
// moyenne en Europe / Ouest. Le site recompresse de toute façon chaque image
// (Sanity CDN → WebP/AVIF, ~768 px), donc le poids livré au visiteur est bien
// plus petit ; ce plafond protège surtout contre des originaux énormes et garde
// l'upload + le store Sanity légers. Appliqué en AVERTISSEMENT (non bloquant).
const MAX_HERO_IMAGE_BYTES = 300 * 1024; // 300 Ko

/**
 * Champ image du hero (image par défaut OU image au survol).
 *
 * - `alt` : texte alternatif. Requis sur l'image par défaut (portrait visible,
 *   compte pour l'accessibilité + le SEO), optionnel sur l'image au survol
 *   (purement décorative, rendue `aria-hidden` côté site).
 * - Validation poids : lit la taille réelle de l'asset uploadé et affiche un
 *   AVERTISSEMENT jaune (non bloquant) si > 300 Ko, avec le poids constaté.
 */
function heroImageField(
  name: string,
  title: string,
  description: string,
  opts: { altRequired: boolean }
) {
  return defineField({
    name,
    title,
    type: 'image',
    description,
    options: { hotspot: true },
    fields: [
      defineField({
        name: 'alt',
        title: 'Texte alternatif',
        type: 'string',
        description:
          'Décrit l’image (accessibilité + SEO). Affiché au public si l’image ne charge pas.',
        validation: (Rule) => {
          const base = Rule.min(3).max(120);
          return opts.altRequired ? base.required() : base;
        },
      }),
    ],
    validation: (Rule) => [
      Rule.required().error('Cette image est obligatoire.'),
      Rule.custom(async (value, context) => {
        const ref = (value as { asset?: { _ref?: string } } | undefined)?.asset
          ?._ref;
        if (!ref) return true; // l'absence est gérée par Rule.required() ci-dessus
        const client = context.getClient({ apiVersion: '2026-01-01' });
        const size = await client.fetch<number | null>(
          '*[_id == $id][0].size',
          { id: ref }
        );
        if (typeof size === 'number' && size > MAX_HERO_IMAGE_BYTES) {
          const ko = Math.round(size / 1024);
          return `Image lourde : ${ko} Ko. Vise ≤ 300 Ko pour un chargement rapide sur une connexion moyenne en Europe/Ouest. Le site la recompresse automatiquement (WebP/AVIF), mais un original léger reste préférable.`;
        }
        return true;
      }).warning(),
    ],
  });
}

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
        'La sélection affichée sur la page d’accueil, dans cet ordre (glisser-déposer pour réordonner). Les photos hors de cette liste restent visibles dans Archives. ⚠️ Site statique : les changements n’apparaissent en ligne qu’après « Publish » + redéploiement.',
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
        'L’ordre des piles sur la page Series : la 1ʳᵉ de cette liste est la 1ʳᵉ à gauche de la rangée, la dernière est tout à droite. Facultatif : les séries absentes de la liste s’affichent après celles qui y sont. Une série créée après coup arrive donc en fin de rangée, à toi de la remonter. ⚠️ Site statique : les changements n’apparaissent en ligne qu’après « Publish » + redéploiement.',
      validation: (Rule) => Rule.unique(),
      components: { input: SeriesOrderInput },
    }),
    defineField({
      name: 'hero',
      title: 'Hero (page d’accueil)',
      type: 'object',
      description:
        'Les deux images du hero de la page d’accueil. La 1ʳᵉ est affichée par défaut au centre ; la 2ᵈᵉ se révèle sous le curseur (effet loupe). Conseils : images carrées, ≥ 1000 × 1000 px, et ≤ 300 Ko chacune pour un chargement rapide sur une connexion moyenne en Europe/Ouest. Le site génère automatiquement une version optimisée (WebP/AVIF, ~768 px), donc un original léger n’est pas strictement obligatoire — mais reste fortement recommandé. ⚠️ Le site étant exporté en statique, un changement d’image n’apparaît en ligne qu’après un nouveau déploiement.',
      options: { collapsible: false },
      validation: (Rule) => Rule.required(),
      fields: [
        heroImageField(
          'defaultImage',
          'Image par défaut',
          'Affichée au centre du hero, toujours visible. Carrée idéalement (≥ 1000 × 1000 px). Poids max conseillé : 300 Ko — le site l’optimise automatiquement pour le visiteur.',
          { altRequired: true }
        ),
        heroImageField(
          'revealImage',
          'Image au survol (révélée à la loupe)',
          'Révélée sous le curseur dans un cercle qui suit le pointeur. Idéalement le même cadrage carré que l’image par défaut pour un fondu cohérent. Poids max conseillé : 300 Ko.',
          { altRequired: false }
        ),
      ],
      preview: {
        select: { media: 'defaultImage' },
        prepare: ({ media }) => ({ title: 'Hero (page d’accueil)', media }),
      },
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
    // Champ `socials` (array plateforme/URL) supprimé le 2026-08-20 : aucun
    // rendu ne le consommait et il était vide en base — schéma orphelin,
    // exactement ce que CLAUDE.md §8.5 interdit. La page /socials est du
    // Portable Text libre (`socialsBody`) : liens et jeton @EMAIL suffisent.
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
