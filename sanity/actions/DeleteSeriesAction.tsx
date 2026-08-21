import { createDetachingDeleteAction } from './detachingDeleteAction';

/**
 * Remplace l'action Delete NATIVE sur les documents `series` (cf.
 * `detachingDeleteAction.tsx` pour la mécanique et le pourquoi).
 *
 * Détache : `photo.series[]` et `siteSettings.seriesOrder`.
 *
 * ⚠️ AUCUNE photo n'est supprimée. `photoOrder` et `coverPhoto` vivent SUR la
 * série : ils disparaissent avec elle sans toucher aux photos qu'ils pointent
 * (Sanity ne cascade pas les suppressions). Une photo qui n'appartenait qu'à
 * cette série se retrouve avec `series: []`, donc dans « Sans série » — et
 * toujours dans « Toutes » et dans `/archives`.
 */
export const DeleteSeriesAction = createDetachingDeleteAction({
  header: 'Supprimer la série',
  fallbackTitle: 'cette série',
  introWithRefs:
    'est encore utilisée. Les liens ci-dessous seront détachés, puis la série sera supprimée définitivement :',
  introWithoutRefs:
    'ne contient aucune photo et n’est rangée nulle part. Supprimer définitivement ?',
  note: 'Aucune photo n’est supprimée : elles restent dans « Toutes » et dans leurs autres séries. Celles qui n’appartenaient qu’à cette série basculent dans « Sans série ». Le site déployé reflétera le changement au prochain deploy.',
});
