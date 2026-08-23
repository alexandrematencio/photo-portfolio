import {
  createQuickRefInput,
  createQuickRefsArrayInput,
} from './quickRefInput';

/**
 * Les quatre champs de référence du document `photo`, en listes déroulantes
 * directes (cf. `quickRefInput.tsx` pour le pourquoi et le périmètre).
 *
 * Un seul fichier plutôt qu'un par champ : ce sont quatre déclinaisons de la
 * même liste fermée, elles doivent se lire d'un coup d'œil pour ne pas diverger
 * (une seule est ordonnée autrement, une seule est plafonnée).
 *
 * Toutes les requêtes excluent les brouillons : une référence doit pointer un
 * document PUBLIÉ, sinon Sanity affiche un avertissement de référence-vers-draft.
 */

const publishedByTitle = (type: string) => /* groq */ `
  *[_type == "${type}" && !(_id in path('drafts.**'))] | order(title asc) {
    _id,
    "label": title
  }
`;

export const CameraSelectInput = createQuickRefInput({
  query: publishedByTitle('camera'),
  labels: {
    loading: 'Lecture des boîtiers…',
    none: 'Aucun boîtier au catalogue. Ils se créent dans Taxonomies → Boîtiers (ou à l’upload).',
    empty: '— Aucun boîtier —',
    add: '',
    unknown: '⚠ Boîtier introuvable (référence cassée)',
  },
});

export const LensSelectInput = createQuickRefInput({
  query: publishedByTitle('lens'),
  labels: {
    loading: 'Lecture des objectifs…',
    none: 'Aucun objectif au catalogue. Ils se créent dans Taxonomies → Objectifs (ou à l’upload).',
    empty: '— Aucun objectif —',
    add: '',
    unknown: '⚠ Objectif introuvable (référence cassée)',
  },
});

export const StylesSelectInput = createQuickRefsArrayInput({
  query: publishedByTitle('style'),
  max: 3,
  labels: {
    loading: 'Lecture des styles…',
    none: 'Aucun style au catalogue. Ils se créent dans Taxonomies → Styles.',
    empty: '',
    add: '+ Ajouter un style…',
    unknown: '⚠ Style introuvable (référence cassée)',
    max: '3 styles maximum — retires-en un pour en ajouter un autre.',
  },
});

export const SeriesSelectInput = createQuickRefsArrayInput({
  // Alphabétique, comme le picker de l'action « Ajouter à une série » : c'est
  // l'ordre dans lequel on CHERCHE une série. L'ordre d'AFFICHAGE de la rangée
  // /series, lui, vit dans Réglages du site → Ordre des séries.
  query: publishedByTitle('series'),
  labels: {
    loading: 'Lecture des séries…',
    none: 'Aucune série au catalogue. Elles se créent dans Séries → Toutes.',
    empty: '',
    add: '+ Rattacher à une série…',
    unknown: '⚠ Série introuvable (référence cassée)',
  },
});
