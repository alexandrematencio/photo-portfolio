import type { SanityClient } from 'sanity';

/**
 * L'ordre de la curation (`siteSettings.curation`), côté écriture — pour la
 * carte « La curation (home) » du Tableau de bord, qui se réordonne au
 * glisser-déposer (skill sanity-studio §11.20).
 *
 * **Patch direct, publié ET brouillon, une transaction.** Même doctrine que
 * `photoVisibility.ts` : l'ordre de la home est un état d'exposition, pas une
 * retouche à relire, et passer par le brouillon des Réglages obligerait à un
 * Publish qui emporterait tout ce qui y traîne (textes des pages éditoriales
 * en cours, hero…). Écrire les deux versions empêche un Publish ultérieur de
 * rétablir l'ancien ordre.
 *
 * **Le brouillon n'est pas écrasé, il est RANGÉ.** Le Tableau de bord affiche
 * la curation PUBLIÉE (celle que le site lit). Si un brouillon des Réglages
 * contient des photos en plus ou en moins, on ne lui impose pas la liste
 * publiée : on trie ses entrées selon le nouvel ordre, et celles qu'il est seul
 * à connaître restent, à la fin, dans leur ordre relatif. L'ajout et le retrait
 * de photos restent l'affaire du formulaire des Réglages.
 */

type RefItem = { _key: string; _type?: string; _ref?: string };

export type CurationOrderWrite = {
  /** Ids réellement patchés — publié, brouillon, ou les deux. */
  patched: string[];
  /** Vrai si un brouillon des Réglages existait et a été rangé lui aussi. */
  draftAligned: boolean;
};

/**
 * Trie `items` selon le rang de leur `_ref` dans `orderedIds`. Une entrée
 * absente de l'ordre passe après les autres, sans perdre sa place relative
 * (tri stable par index d'origine).
 */
export function sortByRank(items: RefItem[], orderedIds: string[]): RefItem[] {
  const rank = new Map(orderedIds.map((id, i) => [id, i] as const));
  return items
    .map((item, i) => ({
      item,
      i,
      r: item._ref != null && rank.has(item._ref) ? (rank.get(item._ref) as number) : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ item }) => item);
}

/**
 * Écrit le nouvel ordre sur toutes les variantes existantes des Réglages.
 * `client` doit être en perspective `raw` : sans elle, le brouillon est
 * invisible à la requête et ne serait pas rangé.
 */
export async function reorderCuration(
  client: SanityClient,
  orderedIds: string[]
): Promise<CurationOrderWrite> {
  const docs = await client.fetch<{ _id: string; curation: RefItem[] | null }[]>(
    `*[_id in ["siteSettings", "drafts.siteSettings"]]{ _id, curation }`
  );
  if (docs.length === 0) {
    throw new Error('Réglages du site introuvables — le document a-t-il été supprimé ?');
  }
  let tx = client.transaction();
  for (const doc of docs) {
    tx = tx.patch(doc._id, (p) =>
      p.set({ curation: sortByRank(doc.curation ?? [], orderedIds) })
    );
  }
  await tx.commit({ visibility: 'sync' });
  return {
    patched: docs.map((d) => d._id),
    draftAligned: docs.some((d) => d._id.startsWith('drafts.')),
  };
}
