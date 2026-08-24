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
 *
 * **Les quatre champs savent créer ce qui manque** (`create`, cf. la doctrine
 * dans `quickRefInput.tsx`) : le remplacement de l'input natif avait emporté son
 * « Create new … », et ne plus pouvoir créer une série depuis la photo qu'on est
 * en train de ranger oblige à quitter le formulaire en cours. Le geste vaut pour
 * les quatre parce que c'est le même formulaire : découvrir qu'on peut créer un
 * style mais pas un boîtier, c'est un chemin à retenir de plus.
 *
 * Ce qui est créé n'a que son NOM. Les alias d'une taxonomie (matching EXIF et
 * noms de fichiers à l'upload) et la fiche d'une série se remplissent dans leur
 * propre panneau — le champ d'aide de chaque sélecteur le dit à l'écran.
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
    none: 'Aucun boîtier au catalogue.',
    empty: '— Aucun boîtier —',
    add: '',
    unknown: '⚠ Boîtier introuvable (référence cassée)',
  },
  create: {
    type: 'camera',
    button: 'Créer un nouveau boîtier',
    placeholder: 'Ex. Fuji X-Pro3',
    // L'alias EXIF est ce qui fait matcher les futurs imports : le dire ici,
    // c'est éviter un boîtier créé deux fois sous deux orthographes.
    help: 'Créé aussitôt et rattaché à cette photo. Ajoute-lui son alias EXIF dans Taxonomies → Boîtiers pour que les prochains imports le reconnaissent.',
    slugFallback: 'boitier',
    duplicate: '« %s » existait déjà au catalogue — c’est ce boîtier qui a été posé.',
  },
});

export const LensSelectInput = createQuickRefInput({
  query: publishedByTitle('lens'),
  labels: {
    loading: 'Lecture des objectifs…',
    none: 'Aucun objectif au catalogue.',
    empty: '— Aucun objectif —',
    add: '',
    unknown: '⚠ Objectif introuvable (référence cassée)',
  },
  create: {
    type: 'lens',
    button: 'Créer un nouvel objectif',
    placeholder: 'Ex. XF 35mm f/1.4 R',
    help: 'Créé aussitôt et rattaché à cette photo. Ajoute-lui son alias EXIF dans Taxonomies → Objectifs pour que les prochains imports le reconnaissent.',
    slugFallback: 'objectif',
    duplicate: '« %s » existait déjà au catalogue — c’est cet objectif qui a été posé.',
  },
});

export const StylesSelectInput = createQuickRefsArrayInput({
  query: publishedByTitle('style'),
  max: 3,
  labels: {
    loading: 'Lecture des styles…',
    none: 'Aucun style au catalogue.',
    empty: '',
    add: '+ Ajouter un style…',
    unknown: '⚠ Style introuvable (référence cassée)',
    max: '3 styles maximum — retires-en un pour en ajouter un autre.',
  },
  create: {
    type: 'style',
    button: 'Créer un nouveau style',
    placeholder: 'Ex. Nocturne',
    // Un style = un groupe sur /archives. La phrase le rappelle : c'est le
    // champ où une création de trop se voit le plus vite côté site.
    help: 'Créé aussitôt et ajouté à cette photo. Chaque style ouvre son propre groupe sur /archives — n’en crée un que si aucun ne convient.',
    slugFallback: 'style',
    duplicate: '« %s » existait déjà au catalogue — c’est ce style qui a été ajouté.',
  },
});

export const SeriesSelectInput = createQuickRefsArrayInput({
  // Alphabétique, comme le picker de l'action « Ajouter à une série » : c'est
  // l'ordre dans lequel on CHERCHE une série. L'ordre d'AFFICHAGE de la rangée
  // /series, lui, vit dans Réglages du site → Ordre des séries.
  query: publishedByTitle('series'),
  labels: {
    loading: 'Lecture des séries…',
    none: 'Aucune série au catalogue.',
    empty: '',
    add: '+ Rattacher à une série…',
    unknown: '⚠ Série introuvable (référence cassée)',
  },
  create: {
    type: 'series',
    button: 'Créer une nouvelle série',
    placeholder: 'Ex. Djerba 2024',
    // Une série neuve n'a ni couverture ni ordre : le site retombe sur la
    // première photo et sur l'ordre du catalogue, mais mieux vaut le savoir.
    help: 'Créée aussitôt et rattachée à cette photo. Couverture et ordre des photos se règlent ensuite dans Séries.',
    slugFallback: 'serie',
    duplicate: '« %s » existait déjà au catalogue — c’est cette série qui a été rattachée.',
  },
});
