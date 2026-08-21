import { createOrderedRefsInput } from './orderedRefsInput';

const plural = (n: number, s: string, p: string) => (n > 1 ? p : s);

/**
 * Input du champ `siteSettings.seriesOrder` (cf. CLAUDE.md §11.15) : toutes
 * les séries publiées, chargeables dans l'ordre de repli du site (`order` asc,
 * titre asc) puis rangées au glisser-déposer. 1ʳᵉ de la liste = 1ʳᵉ pile à
 * gauche de la rangée sur /series.
 */
export const SeriesOrderInput = createOrderedRefsInput({
  // Ordre de repli du site — le même que seriesWithPhotosQuery. Publiées
  // uniquement : une référence doit pointer un document publié.
  query: `
    *[_type == "series" && !(_id in path('drafts.**'))] | order(order asc, title asc) {
      _id,
      title
    }
  `,
  labels: {
    loading: 'Lecture des séries…',
    complete: (n) =>
      `Les ${n} série${plural(n, '', 's')} sont rangées. Glisse-les pour changer l’ordre de la rangée.`,
    empty: (n) =>
      `${n} série${plural(n, '', 's')} publiée${plural(n, '', 's')}. Charge-les pour pouvoir les ranger.`,
    missing: (n) =>
      `${n} série${plural(n, '', 's')} ${plural(n, 'n’est', 'ne sont')} pas encore dans l’ordre — ${plural(n, 'elle s’affiche', 'elles s’affichent')} en fin de rangée sur le site.`,
    stale: (n) =>
      `${n} entrée${plural(n, '', 's')} pointe${plural(n, '', 'nt')} des séries supprimées. Le site les ignore déjà.`,
    loadButton: 'Charger les séries',
    addButton: (n) => `Ajouter les ${n} manquantes`,
    removeButton: (n) =>
      `Retirer ${n} entrée${plural(n, '', 's')} obsolète${plural(n, '', 's')}`,
  },
});
