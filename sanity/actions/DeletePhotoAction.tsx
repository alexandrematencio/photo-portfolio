import { createDetachingDeleteAction } from './detachingDeleteAction';

/**
 * Remplace l'action Delete NATIVE sur les documents `photo` (cf.
 * `detachingDeleteAction.tsx` pour la mécanique et le pourquoi).
 *
 * Détache : `series.coverPhoto`, `series.photoOrder`, `siteSettings.curation`.
 */
export const DeletePhotoAction = createDetachingDeleteAction({
  header: 'Supprimer la photo',
  fallbackTitle: 'cette photo',
  introWithRefs:
    'est encore référencée. Les liens ci-dessous seront détachés, puis la photo sera supprimée définitivement :',
  introWithoutRefs:
    'ne figure dans aucune série ni dans la curation. Supprimer définitivement ?',
  note: 'Aucun de ces documents n’est supprimé — seule la référence vers cette photo est retirée. Le site déployé reflétera le changement au prochain deploy.',
});
