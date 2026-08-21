import { useCallback, useMemo, useState } from 'react';
import { useToast } from '@sanity/ui';
import {
  useClient,
  useFormValue,
  type ObjectItem,
  type ObjectItemProps,
  type Reference,
} from 'sanity';

/**
 * Item du champ `series.photoOrder` (`components.item` du membre de tableau).
 *
 * **Ce qu'il change** : l'entrée « Remove » du menu « ⋯ » d'une photo retire
 * désormais la photo DE LA SÉRIE, pas seulement de l'ordre d'affichage.
 *
 * **Pourquoi.** L'appartenance vit sur `photo.series[]`, l'ordre sur
 * `series.photoOrder` (CLAUDE.md §11.12 — le tableau est une CLÉ DE TRI, jamais
 * une liste d'appartenance). Conséquence : le « Remove » natif ne retirait la
 * photo que de l'ordre… et le site la ré-affichait aussitôt À LA FIN de la
 * série, puisqu'une photo absente du tableau est ajoutée en queue à la lecture
 * (`applyPhotoOrder`). Le geste avait donc l'air de ne rien faire, et il fallait
 * ouvrir la photo, la détacher de la série, puis revenir retirer l'entrée
 * devenue obsolète. Deux gestes dans deux documents pour une seule intention.
 *
 * Ce composant garde le modèle intact — il fait juste les deux écritures que
 * l'intention implique, dans le bon ordre :
 * 1. `photo.series[_ref=="<série>"]` détaché (publié ET brouillon de la photo) ;
 * 2. `series.coverPhoto` vidé s'il pointait justement cette photo — sinon la
 *    pile de `/series` afficherait une couverture qui n'est plus dans la série ;
 * 3. l'entrée retirée de `photoOrder`, via le `onRemove` natif.
 *
 * ⚠️ Asymétrie assumée, dite à l'écran : (1) et (2) sont des patches directs,
 * appliqués IMMÉDIATEMENT (une photo est un autre document que celui ouvert —
 * il n'y a pas de brouillon commun où les mettre en attente) ; (3) est une
 * édition de formulaire, donc en brouillon jusqu'au Publish de la série. Même
 * choix que `DeletePhotoAction` / `DeleteSeriesAction`, qui détachent aussi en
 * direct. Si l'ordre n'est jamais publié, aucune incohérence : le site lit
 * l'appartenance publiée, et une entrée d'ordre orpheline est ignorée.
 *
 * Rien n'est retiré automatiquement par ailleurs : c'est un clic de l'éditeur,
 * pas une resynchronisation (§11.12).
 */

const API_VERSION = '2026-01-01';

/** Variantes réellement concernées — on ne patche que ce qui existe. */
const TARGETS_QUERY = /* groq */ `{
  "photoTitle": *[_id == $photoId][0].title,
  "photoIds": *[_id in [$photoId, $photoDraftId] && $seriesId in series[]._ref]._id,
  "coverIds": *[_id in [$seriesId, $seriesDraftId] && coverPhoto._ref == $photoId]._id
}`;

type Targets = {
  photoTitle: string | null;
  photoIds: string[];
  coverIds: string[];
};

export function PhotoOrderItem(props: ObjectItemProps<Reference & ObjectItem>) {
  const baseClient = useClient({ apiVersion: API_VERSION });
  // Perspective `raw` : les brouillons de la photo doivent être détachés eux
  // aussi, sinon un Publish ultérieur la remettrait dans la série.
  const client = useMemo(
    () => baseClient.withConfig({ perspective: 'raw' }),
    [baseClient]
  );
  const toast = useToast();

  const rawId = useFormValue(['_id']);
  // Sur un brouillon `_id` vaut `drafts.<id>` alors que les photos référencent
  // l'id publié — d'où le strip.
  const seriesId =
    typeof rawId === 'string' ? rawId.replace(/^drafts\./, '') : '';
  const photoId = props.value?._ref;

  const [busy, setBusy] = useState(false);
  const { onRemove } = props;

  const handleRemove = useCallback(async () => {
    if (busy) return;
    // Entrée sans référence, ou série jamais persistée : rien à détacher, on
    // retombe sur le comportement natif.
    if (!photoId || !seriesId) {
      onRemove();
      return;
    }
    setBusy(true);
    try {
      const targets = await client.fetch<Targets>(TARGETS_QUERY, {
        photoId,
        photoDraftId: `drafts.${photoId}`,
        seriesId,
        seriesDraftId: `drafts.${seriesId}`,
      });

      if (targets.photoIds.length > 0 || targets.coverIds.length > 0) {
        // UNE transaction : jamais une photo détachée avec une couverture
        // restée en place, ou l'inverse.
        let tx = client.transaction();
        for (const id of targets.photoIds) {
          tx = tx.patch(id, (p) => p.unset([`series[_ref=="${seriesId}"]`]));
        }
        for (const id of targets.coverIds) {
          tx = tx.patch(id, (p) => p.unset(['coverPhoto']));
        }
        await tx.commit({ visibility: 'sync' });
      }

      // Le retrait de l'ordre ne part qu'une fois le détachement confirmé :
      // en cas d'échec réseau, l'entrée reste à l'écran plutôt que de laisser
      // croire que la photo a quitté la série.
      onRemove();

      const label = targets.photoTitle ?? 'La photo';
      const wasCover = targets.coverIds.length > 0;
      const wasMember = targets.photoIds.length > 0;
      toast.push({
        status: 'success',
        title: wasMember
          ? `${label} ne fait plus partie de la série`
          : 'Entrée retirée de l’ordre',
        description: wasMember
          ? [
              wasCover
                ? 'La photo de couverture a été vidée — le site retombe sur la première photo de la série.'
                : null,
              'Elle reste dans « Toutes » et dans ses autres séries. Retrait appliqué immédiatement ; l’ordre, lui, part au prochain Publish de la série.',
            ]
              .filter(Boolean)
              .join(' ')
          : 'Cette photo n’était déjà plus rattachée à la série.',
      });
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Retrait impossible',
        description:
          err instanceof Error ? err.message : 'Erreur réseau inconnue.',
      });
    } finally {
      setBusy(false);
    }
  }, [busy, client, onRemove, photoId, seriesId, toast]);

  return props.renderDefault({
    ...props,
    onRemove: () => {
      void handleRemove();
    },
  });
}
