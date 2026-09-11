import type { SanityClient } from 'sanity';

/**
 * L'interrupteur « Masquée du site » (`photo.hidden`), côté écriture — partagé
 * par l'action document (`ToggleVisibilityAction`) et par le menu de ligne
 * (`PhotoRowSubtitle`), pour qu'un seul chemin écrive cette valeur.
 *
 * **Patch direct, pas une édition de formulaire.** Masquer est un état
 * d'exposition, pas une retouche à relire : passer par le brouillon obligerait
 * à un Publish, qui emporterait au passage tout ce qui traîne dans ce brouillon.
 * La valeur est donc écrite sur la version publiée ET sur le brouillon s'il
 * existe, en une transaction — les deux ne peuvent pas diverger sur ce champ
 * (sinon un Publish ultérieur remettrait l'ancien état). Même choix que
 * `PhotoOrderItem` et les suppressions qui détachent (skill sanity-studio
 * §11.17).
 */

export const HIDE_LABEL = 'Masquer du site';
export const SHOW_LABEL = 'Montrer sur le site';

export function visibilityLabel(hidden: boolean) {
  return hidden ? SHOW_LABEL : HIDE_LABEL;
}

export function publishedId(id: string) {
  return id.replace(/^drafts\./, '');
}

export type VisibilityWrite = {
  /** Ids réellement patchés — publié, brouillon, ou les deux. */
  patched: string[];
  /** Vrai si seule une version brouillon existait (photo jamais publiée). */
  draftOnly: boolean;
};

/**
 * Écrit `hidden` sur toutes les variantes existantes de la photo.
 * `client` doit être en perspective `raw` : sans elle, le brouillon est
 * invisible à la requête et ne serait pas patché.
 */
export async function setPhotoHidden(
  client: SanityClient,
  id: string,
  hidden: boolean
): Promise<VisibilityWrite> {
  const pubId = publishedId(id);
  const draftId = `drafts.${pubId}`;
  const ids = await client.fetch<string[]>(`*[_id in [$pubId, $draftId]]._id`, {
    pubId,
    draftId,
  });
  if (ids.length === 0) {
    throw new Error('Photo introuvable — a-t-elle été supprimée entre-temps ?');
  }
  let tx = client.transaction();
  for (const target of ids) {
    tx = tx.patch(target, (p) => p.set({ hidden }));
  }
  await tx.commit({ visibility: 'sync' });
  return { patched: ids, draftOnly: !ids.includes(pubId) };
}

/** Texte du toast après écriture — même phrase partout. */
export function visibilityToast(
  title: string,
  hidden: boolean,
  write: VisibilityWrite
) {
  return {
    title: hidden
      ? `${title} est masquée du site`
      : `${title} est de retour sur le site`,
    description: write.draftOnly
      ? 'Photo jamais publiée : la valeur partira avec son premier Publish.'
      : 'Enregistré tout de suite, sans Publish. Le site en ligne suivra au prochain déploiement.',
  };
}
