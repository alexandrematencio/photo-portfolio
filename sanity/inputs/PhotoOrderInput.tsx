import { createOrderedRefsInput } from './orderedRefsInput';

const plural = (n: number, s: string, p: string) => (n > 1 ? p : s);

/**
 * Input du champ `series.photoOrder` (cf. CLAUDE.md §11.15) : les photos de la
 * série, chargeables dans l'ordre de repli du site (année desc) puis rangées
 * au glisser-déposer. Toute la mécanique vit dans `createOrderedRefsInput`.
 */
export const PhotoOrderInput = createOrderedRefsInput({
  // Ordre de repli du site (année desc, titre asc) — cf. seriesWithPhotosQuery.
  query: `
    *[_type == "photo" && $seriesId in series[]._ref] | order(year desc, title asc) {
      _id,
      title
    }
  `,
  // Pas de fetch tant que le document n'a pas d'id (série jamais persistée).
  params: (seriesId) => (seriesId ? { seriesId } : null),
  labels: {
    loading: 'Lecture des photos de la série…',
    complete: (n) =>
      `Les ${n} photo${plural(n, '', 's')} de la série sont rangées. Glisse-les pour changer l’ordre.`,
    empty: (n) =>
      `${n} photo${plural(n, '', 's')} dans cette série. Charge-les pour pouvoir les ranger.`,
    missing: (n) =>
      `${n} photo${plural(n, '', 's')} de la série ${plural(n, 'n’est', 'ne sont')} pas encore dans l’ordre — ${plural(n, 'elle s’affiche', 'elles s’affichent')} à la fin sur le site.`,
    stale: (n) =>
      `${n} photo${plural(n, '', 's')} listée${plural(n, '', 's')} ici ${plural(n, 'ne fait', 'ne font')} plus partie de la série. Le site ${plural(n, 'l’', 'les ')}ignore déjà.`,
    loadButton: 'Charger les photos',
    addButton: (n) => `Ajouter les ${n} manquantes`,
    removeButton: (n) =>
      `Retirer ${n} entrée${plural(n, '', 's')} obsolète${plural(n, '', 's')}`,
  },
});
