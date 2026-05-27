import { createClient } from 'next-sanity';
import { apiVersion, dataset, projectId, isSanityConfigured } from './env';

// useCdn: false — le site est en `output: 'export'` (static export), donc TOUS
// les fetchs Sanity ont lieu au BUILD TIME. Le CDN Sanity (qui sert à amortir
// des requêtes runtime fréquentes) n'a aucun bénéfice ici et peut ajouter 5-15
// min de cache stale entre une modif dans Studio et son apparition dans le build.
// Avec useCdn: false, chaque `npm run build` voit l'état Sanity réel à l'instant
// du build — pas de surprise "j'ai modifié l'ordre il y a 2 min et le build a
// pris la version d'avant".
// Workflow : toute modif dans Sanity Studio → re-deploy (`npm run deploy`) pour
// que les changements arrivent en prod. Pas de webhook automatique branché.
export const sanityClient = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false,
      perspective: 'published',
    })
  : null;
