import { createClient } from 'next-sanity';
import {
  apiVersion,
  dataset,
  isSanityConfigured,
  projectId,
  readToken,
} from './env';

// In dev (NODE_ENV !== 'production') AND outside a Next production build phase,
// if a read token is configured, the site uses perspective:'previewDrafts' so
// drafts are visible. This makes the Studio's "Local" preview pane meaningful.
//
// Triple gate (NODE_ENV + NEXT_PHASE + token presence) ensures that a
// `next build` run with the token in env never bakes drafts into the static
// export — GH Pages must only ever serve published content.
//
// useCdn:false in both modes — the static export fetches at build time, no
// runtime CDN cache layer to amortize.
const isProductionBuild =
  process.env.NODE_ENV === 'production' ||
  process.env.NEXT_PHASE === 'phase-production-build';

const usePreviewDrafts = !isProductionBuild && readToken.length > 0;

if (isProductionBuild && readToken.length > 0) {
  // Defensive: the build phase ignores the token. Surface it so the developer
  // is not surprised if drafts don't show up later.
  // eslint-disable-next-line no-console
  console.warn(
    '[sanity] SANITY_API_READ_TOKEN set during production build — ignored. Drafts are NEVER baked into the static export.'
  );
}

export const sanityClient = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false,
      perspective: usePreviewDrafts ? 'previewDrafts' : 'published',
      ...(usePreviewDrafts ? { token: readToken } : {}),
    })
  : null;
