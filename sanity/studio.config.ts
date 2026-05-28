import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from '@/sanity/schemas';
import { buildStructure } from '@/sanity/structure';
import { dashboardTool } from '@/sanity/tools';
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
    // Hide singleton from global "create new" menu.
    templates: (prev) =>
      prev.filter(({ schemaType }) => !SINGLETON_TYPES.has(schemaType)),
  },
  document: {
    // Strip duplicate/delete/unpublish actions on singleton docs.
    actions: (prev, { schemaType }) => {
      if (SINGLETON_TYPES.has(schemaType)) {
        return prev.filter(
          ({ action }) => !action || !SINGLETON_FORBIDDEN_ACTIONS.has(action)
        );
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
