export const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '';
export const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-01-01';
export const readToken = process.env.SANITY_API_READ_TOKEN ?? '';

// Base URL of the deployed site (e.g. https://<user>.github.io/photo-portfolio).
// No trailing slash. Used by the Studio's productionUrl callback and preview pane.
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';

export const isSanityConfigured = projectId.length > 0;
