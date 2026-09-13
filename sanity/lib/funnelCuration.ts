import type { SanityClient } from 'sanity';

/**
 * L'appartenance d'une photo à la funnel curation (`funnelCuration.photos`),
 * côté écriture — pour l'action document « Ajouter à la funnel curation ».
 *
 * **Patch direct, publié ET brouillon, une transaction.** Même doctrine que
 * `photoVisibility.ts` et `curationOrder.ts` : on remplit une liste d'une
 * centaine de photos depuis les photos elles-mêmes, un Publish du singleton à
 * chaque ajout serait absurde. Écrire les deux versions empêche un Publish
 * ultérieur du formulaire de rétablir l'ancienne liste.
 *
 * Le singleton est créé PUBLIÉ au premier ajout s'il n'existe pas encore :
 * design-folio lit la version publiée.
 */

export const FUNNEL_ID = 'funnelCuration';
const FUNNEL_DRAFT_ID = `drafts.${FUNNEL_ID}`;

export const ADD_LABEL = 'Ajouter à la funnel curation';
export const REMOVE_LABEL = 'Retirer de la funnel curation';

function publishedId(id: string) {
  return id.replace(/^drafts\./, '');
}

/**
 * Vrai si la photo est dans la version PUBLIÉE — celle que lit design-folio.
 * `client` en perspective `raw`.
 *
 * ⚠️ `coalesce(…, false)` n'est pas décoratif : tant que le singleton n'existe
 * pas, `$id in null` vaut `null` en GROQ, pas `false` — et l'action, qui crée
 * justement le document au premier ajout, restait grisée à vie (constaté sur
 * /studio-probe le 2026-09-13).
 */
export async function isInFunnel(client: SanityClient, photoId: string) {
  const result = await client.fetch<boolean | null>(
    `coalesce($id in *[_id == $funnelId][0].photos[]._ref, false)`,
    { id: publishedId(photoId), funnelId: FUNNEL_ID }
  );
  return result === true;
}

/**
 * Ajoute la photo EN FIN de liste, ou l'en retire, sur toutes les variantes
 * existantes du singleton. `client` doit être en perspective `raw` : sans elle,
 * le brouillon est invisible à la requête et ne serait pas patché.
 */
export async function setInFunnel(
  client: SanityClient,
  photoId: string,
  inFunnel: boolean
): Promise<void> {
  const ref = publishedId(photoId);
  const docs = await client.fetch<{ _id: string; has: boolean }[]>(
    `*[_id in [$pub, $draft]]{ _id, "has": $ref in photos[]._ref }`,
    { pub: FUNNEL_ID, draft: FUNNEL_DRAFT_ID, ref }
  );

  let tx = client.transaction();
  if (!docs.some((d) => d._id === FUNNEL_ID)) {
    tx = tx.createIfNotExists({ _id: FUNNEL_ID, _type: 'funnelCuration', photos: [] });
    docs.push({ _id: FUNNEL_ID, has: false });
  }
  for (const doc of docs) {
    if (inFunnel && !doc.has) {
      tx = tx.patch(doc._id, (p) =>
        p
          .setIfMissing({ photos: [] })
          .append('photos', [{ _type: 'reference', _ref: ref, _key: ref }])
      );
    } else if (!inFunnel && doc.has) {
      tx = tx.patch(doc._id, (p) => p.unset([`photos[_ref=="${ref}"]`]));
    }
  }
  await tx.commit({ visibility: 'sync' });
}
