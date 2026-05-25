import imageUrlBuilder, { type SanityImageSource } from '@sanity/image-url';
import { dataset, projectId, isSanityConfigured } from './env';

const builder = isSanityConfigured
  ? imageUrlBuilder({ projectId, dataset })
  : null;

export function urlFor(source: SanityImageSource) {
  if (!builder) return null;
  return builder.image(source);
}
