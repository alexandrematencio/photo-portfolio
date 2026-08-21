/**
 * Helpers partagés par les scripts de contenu (upload-photos, migrate-taxonomy).
 * Pas d'import Sanity ici : uniquement de la manipulation de chaînes + le seed
 * des styles par défaut.
 */

/** "Pas de vin à la fête" → "pas-de-vin-a-la-fete" (accents strippés). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "paris, france" → "Paris, France". */
export function titleCase(input: string): string {
  return input.replace(/\p{L}+/gu, (word) =>
    word.charAt(0).toUpperCase() + word.slice(1)
  );
}

/** Normalisation pour le matching d'alias (casse + accents + espaces). */
export function normalizeForMatch(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Titre de série dérivé d'un lieu. Partagé par `upload-photos --auto-series`
 * et `assign-series-by-location` : les deux DOIVENT produire le même titre,
 * sinon un import automatique créerait une série parallèle à celle du
 * rattachement en masse.
 *
 * « Paris, France » → « Paris » (ou le lieu entier si `full`).
 */
export function seriesTitleForLocation(location: string, full = false): string {
  const trimmed = location.trim();
  return full ? trimmed : (trimmed.split(',')[0] ?? trimmed).trim();
}

/**
 * Styles seed — créés par `npm run migrate-taxonomy` (createIfNotExists,
 * n'écrase jamais des styles édités dans le Studio). Les alias alimentent le
 * parser de noms de fichiers d'upload-photos.
 */
export const DEFAULT_STYLES: {
  id: string;
  title: string;
  slug: string;
  aliases: string[];
  /** Ancienne valeur du champ `category` correspondante (migration). */
  legacyCategory: string;
}[] = [
  {
    id: 'style-street',
    title: 'Street',
    slug: 'street',
    aliases: ['sp', 'street', 'rue', 'streetphotography'],
    legacyCategory: 'streetphotography',
  },
  {
    id: 'style-landscape',
    title: 'Landscape',
    slug: 'landscape',
    aliases: ['paysage', 'ls', 'landscape'],
    legacyCategory: 'landscape',
  },
  {
    id: 'style-portrait',
    title: 'Portrait',
    slug: 'portrait',
    aliases: ['pt', 'portrait'],
    legacyCategory: 'portrait',
  },
  {
    id: 'style-architecture',
    title: 'Architecture',
    slug: 'architecture',
    aliases: ['archi', 'ar', 'architecture'],
    legacyCategory: 'architecture',
  },
];
