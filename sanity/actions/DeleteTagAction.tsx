import { createDetachingDeleteAction } from './detachingDeleteAction';

/**
 * Remplace l'action Delete NATIVE sur les thématiques du journal (cf.
 * `detachingDeleteAction.tsx` pour la mécanique et le pourquoi).
 *
 * Détache : `post.tags[]`. Aucun article n'est supprimé.
 */
export const DeleteTagAction = createDetachingDeleteAction({
  header: 'Supprimer la thématique',
  fallbackTitle: 'cette thématique',
  introWithRefs:
    'est encore posée sur des articles. Elle en sera retirée, puis supprimée définitivement :',
  introWithoutRefs: 'n’est posée sur aucun article. Supprimer définitivement ?',
  note: 'Aucun article n’est supprimé : ils perdent seulement cette thématique. Le journal reflétera le changement au prochain déploiement.',
});
