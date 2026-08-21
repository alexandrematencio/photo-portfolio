import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from '@/sanity/schemas';
import { buildStructure } from '@/sanity/structure';
import { dashboardTool } from '@/sanity/tools';
import { AssignToSeriesAction } from '@/sanity/actions';
// PhotoPreviewView / SiteSettingsPreviewView volontairement non importés (désactivés
// — voir le commentaire `defaultDocumentNode` ci-dessous). Les fichiers restent dans
// `sanity/preview/` pour réactivation rapide.
import { apiVersion, dataset, projectId, siteUrl } from '@/lib/sanity/env';

const SINGLETON_TYPES = new Set(['siteSettings']);
const SINGLETON_FORBIDDEN_ACTIONS = new Set([
  'duplicate',
  'delete',
  'unpublish',
]);

/**
 * Templates de création contextuels, consommés par le structure builder via
 * `S.initialValueTemplateItem(<id>, <params>)` (cf. sanity/structure/index.ts).
 *
 * Pourquoi : sans eux, le bouton « + » d'une liste filtrée (« Photos de cette
 * série », « Par boîtier », …) crée une photo VIDE, qui n'appartient donc pas
 * au groupe depuis lequel on vient — le bouton ment sur ce qu'il fait. Avec le
 * template, la photo naît déjà rattachée au contexte courant.
 */
const PHOTO_AXIS_TEMPLATES = [
  {
    id: 'photo-by-series',
    title: 'Photo dans cette série',
    schemaType: 'photo',
    parameters: [{ name: 'seriesId', type: 'string' }],
    // `series` est un TABLEAU depuis le 2026-08-21 (une photo peut appartenir
    // à plusieurs séries) : le template doit produire un tableau, sinon la
    // photo créée depuis « Par série » naît avec un conflit de type.
    value: ({ seriesId }: { seriesId: string }) => ({
      series: [{ _type: 'reference', _ref: seriesId, _key: seriesId }],
    }),
  },
  {
    id: 'photo-by-style',
    title: 'Photo dans ce style',
    schemaType: 'photo',
    parameters: [{ name: 'styleId', type: 'string' }],
    value: ({ styleId }: { styleId: string }) => ({
      styles: [{ _type: 'reference', _ref: styleId, _key: styleId }],
    }),
  },
  {
    id: 'photo-by-camera',
    title: 'Photo avec ce boîtier',
    schemaType: 'photo',
    parameters: [{ name: 'cameraId', type: 'string' }],
    value: ({ cameraId }: { cameraId: string }) => ({
      camera: { _type: 'reference', _ref: cameraId },
    }),
  },
  {
    id: 'photo-by-lens',
    title: 'Photo avec cet objectif',
    schemaType: 'photo',
    parameters: [{ name: 'lensId', type: 'string' }],
    value: ({ lensId }: { lensId: string }) => ({
      lens: { _type: 'reference', _ref: lensId },
    }),
  },
  {
    id: 'photo-by-year',
    title: 'Photo de cette année',
    schemaType: 'photo',
    parameters: [{ name: 'year', type: 'number' }],
    value: ({ year }: { year: number }) => ({ year }),
  },
  {
    id: 'photo-by-location',
    title: 'Photo de ce lieu',
    schemaType: 'photo',
    parameters: [{ name: 'location', type: 'string' }],
    value: ({ location }: { location: string }) => ({ location }),
  },
  {
    id: 'series-by-year',
    title: 'Série de cette année',
    schemaType: 'series',
    parameters: [{ name: 'year', type: 'number' }],
    value: ({ year }: { year: number }) => ({ year }),
  },
];

export const studioConfig = defineConfig({
  name: 'amatencio-photo',
  title: 'A. Matencio — Studio',
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [
    structureTool({
      structure: (S, context) => buildStructure(S, context),
      // Preview panes désactivés volontairement (2026-05-28) — éviter le double-render
      // (l'iframe localhost:3010/archives fait tourner une seconde instance complète
      // du site avec GSAP+Lenis → coût thermique notable en dev).
      //
      // Pour réactiver : remettre la version multi-views ci-dessous.
      //   defaultDocumentNode: (S, { schemaType }) => {
      //     if (schemaType === 'photo')        return S.document().views([S.view.form(), S.view.component(PhotoPreviewView).title('Aperçu').id('preview')]);
      //     if (schemaType === 'siteSettings') return S.document().views([S.view.form(), S.view.component(SiteSettingsPreviewView).title('Aperçu').id('preview')]);
      //     return S.document().views([S.view.form()]);
      //   },
    }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
  // Dashboard registered first → becomes the default landing route in /studio.
  tools: (prev) => [dashboardTool, ...prev],
  schema: {
    types: schemaTypes,
    templates: (prev) => [
      // Hide singleton from global "create new" menu.
      ...prev.filter(({ schemaType }) => !SINGLETON_TYPES.has(schemaType)),
      // Contextual templates : paramétrés, donc absents du menu « create »
      // global (Sanity ne peut pas les résoudre sans paramètres) et joignables
      // uniquement depuis les listes filtrées du structure builder.
      ...PHOTO_AXIS_TEMPLATES,
    ],
  },
  document: {
    actions: (prev, { schemaType }) => {
      // Strip duplicate/delete/unpublish actions on singleton docs.
      if (SINGLETON_TYPES.has(schemaType)) {
        return prev.filter(
          ({ action }) => !action || !SINGLETON_FORBIDDEN_ACTIONS.has(action)
        );
      }
      // « Ajouter à une série » : disponible sur toute photo ouverte, quel que
      // soit l'onglet de Photos d'où l'on vient (une action document ne dépend
      // pas du panneau). Complète le champ `series` du formulaire, qui reste
      // utilisable directement.
      if (schemaType === 'photo') {
        return [...prev, AssignToSeriesAction];
      }
      return prev;
    },
    // "Open preview" link in the document menu — same URL pattern as the
    // preview pane, hash-based for static-export compatibility.
    productionUrl: async (prev, { document }) => {
      const base = siteUrl;
      if (!base) return prev;
      const slug = (document.slug as { current?: string } | undefined)?.current;
      switch (document._type) {
        case 'photo':
          return slug ? `${base}/archives/#photo-${slug}` : prev;
        case 'series':
          return slug ? `${base}/archives/#series-${slug}` : prev;
        case 'siteSettings':
          return `${base}/`;
        default:
          return prev;
      }
    },
  },
});
