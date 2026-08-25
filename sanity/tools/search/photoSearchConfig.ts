import type { SearchConfig } from '@/lib/search';

import type { PhotoRecord } from './photoIndexQuery';

/**
 * TOUT ce que le moteur sait des photos tient dans ce fichier.
 *
 * Pour une autre affaire — une épicerie, une boutique — on écrit un fichier
 * frère (`shopSearchConfig.ts`) et le noyau ne change pas d'une ligne. C'est la
 * doctrine déjà en vigueur pour `orderedRefsInput` et `quickRefInput` : une
 * fabrique, des instances qui n'apportent que leur requête et leurs libellés.
 *
 * Poids : spec §4.4. `image.alt` est ABSENTE, et c'est délibéré.
 */
export const photoSearchConfig: SearchConfig<PhotoRecord> = {
  id: (photo) => photo.id,
  fields: [
    { key: 'title', weight: 3, get: (p) => p.title },
    { key: 'series', weight: 2, get: (p) => p.series },
    { key: 'location', weight: 2, get: (p) => p.location },
    { key: 'styles', weight: 1.5, get: (p) => p.styles },
    { key: 'camera', weight: 1, get: (p) => p.camera },
    { key: 'lens', weight: 1, get: (p) => p.lens },
    { key: 'caption', weight: 1, get: (p) => p.caption },
    { key: 'year', weight: 1, get: (p) => (p.year == null ? null : String(p.year)) },
    { key: 'slug', weight: 0.5, get: (p) => p.slug },
  ],
  facets: [
    { key: 'year', label: 'Année', kind: 'term', get: (p) => p.year, sort: 'value-desc' },
    { key: 'location', label: 'Lieu', kind: 'term', get: (p) => p.location, sort: 'count' },
    { key: 'series', label: 'Série', kind: 'term', get: (p) => p.series, sort: 'count' },
    { key: 'styles', label: 'Style', kind: 'term', get: (p) => p.styles, sort: 'count' },
    { key: 'camera', label: 'Boîtier', kind: 'term', get: (p) => p.camera, sort: 'count' },
    { key: 'lens', label: 'Objectif', kind: 'term', get: (p) => p.lens, sort: 'count' },
  ],
  // En back-office, ce qu'on vient d'éditer est ce qu'on cherche.
  tiebreak: (a, b) => b._updatedAt.localeCompare(a._updatedAt),
};
