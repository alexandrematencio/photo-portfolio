import { createOrderedRefsInput } from './orderedRefsInput';

const plural = (n: number, s: string, p: string) => (n > 1 ? p : s);

/**
 * Input du champ `workPage.collections` : l'ORDRE des onglets de /work. Même
 * contrat que `SeriesOrderInput` — clé de tri, jamais liste d'appartenance :
 * c'est `series.destination == "work"` qui fait d'une série un album.
 * Les albums absents de la liste passent après ceux qui y sont (cf.
 * `splitSeriesAndWork`, lib/site/series.ts).
 */
export const WorkOrderInput = createOrderedRefsInput({
  // Ordre de repli du site — celui de seriesWithPhotosQuery. Publiés
  // uniquement : une référence doit pointer un document publié.
  query: `
    *[_type == "series" && destination == "work" && !(_id in path('drafts.**'))] | order(order asc, title asc) {
      _id,
      title
    }
  `,
  labels: {
    loading: 'Lecture des albums Work…',
    complete: (n) =>
      `Les ${n} album${plural(n, '', 's')} Work ${plural(n, 'est rangé', 'sont rangés')}. Glisse-les pour changer l’ordre des onglets.`,
    empty: (n) =>
      `${n} album${plural(n, '', 's')} Work publié${plural(n, '', 's')}. Charge-les pour pouvoir les ranger.`,
    missing: (n) =>
      `${n} album${plural(n, '', 's')} ${plural(n, 'n’est', 'ne sont')} pas encore dans l’ordre — ${plural(n, 'il s’affiche', 'ils s’affichent')} après les autres sur /work.`,
    stale: (n) =>
      `${n} entrée${plural(n, '', 's')} pointe${plural(n, '', 'nt')} des albums supprimés ou repassés en série. Le site les ignore déjà.`,
    loadButton: 'Charger les albums',
    addButton: (n) => `Ajouter les ${n} manquants`,
    removeButton: (n) =>
      `Retirer ${n} entrée${plural(n, '', 's')} obsolète${plural(n, '', 's')}`,
  },
});
