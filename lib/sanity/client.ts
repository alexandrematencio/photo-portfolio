import { createClient } from 'next-sanity';
import { apiVersion, dataset, projectId, isSanityConfigured } from './env';

export const sanityClient = isSanityConfigured
  ? createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      perspective: 'published',
    })
  : null;
