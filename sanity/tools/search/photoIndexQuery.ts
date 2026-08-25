/**
 * L'index de recherche des photos : sa projection GROQ et le rebasage des
 * brouillons.
 *
 * Mesuré le 2026-08-24 sur le dataset de production : 200 photos, 81,5 Ko brut
 * / 13,8 Ko gzip, 36 ms. Le Tableau de bord charge DÉJÀ les 200 lignes d'axes
 * (`axisRows`) : cette projection grossit la requête existante, elle n'ajoute
 * pas d'aller-retour.
 *
 * ⚠️ `image.alt` n'est PAS projetée. Elle est auto-générée par l'import sous la
 * forme « Titre — Lieu » : l'indexer compterait le titre deux fois et fausserait
 * le classement (spec §4.4).
 */

export const SEARCH_INDEX_PROJECTION = /* groq */ `
  *[_type == "photo"] {
    _id, _updatedAt, title, "slug": slug.current, caption, year, location,
    "camera": camera->title,
    "lens": lens->title,
    "styles": styles[]->title,
    "series": series[]->title,
    image
  }
`;

export type PhotoIndexRow = {
  _id: string;
  _updatedAt: string;
  title: string | null;
  slug: string | null;
  caption: string | null;
  year: number | null;
  location: string | null;
  camera: string | null;
  lens: string | null;
  styles: string[] | null;
  series: string[] | null;
  image: { asset?: { _ref: string } } | null;
};

export type PhotoRecord = Omit<PhotoIndexRow, '_id'> & {
  id: string;
  hasDraft: boolean;
};

const DRAFT_PREFIX = 'drafts.';

/**
 * Fusionne `X` et `drafts.X` en UNE fiche.
 *
 * ⚠️ Le client du Tableau de bord (`useClient`) voit les brouillons : sans ce
 * rebasage, une photo publiée ET éditée remonterait DEUX FOIS dans les
 * résultats. C'est le bug déjà payé dans `orderedRefsInput` (skill
 * `sanity-studio` §11.15).
 *
 * On garde les valeurs du BROUILLON, pas du publié : c'est ce que l'éditeur
 * vient de taper, donc ce qu'il va chercher. L'id retenu est celui du publié,
 * parce que c'est lui que consomme l'intent `edit`. L'ordre d'arrivée des
 * lignes n'a aucune influence : le publié n'écrase jamais le brouillon.
 */
export function rebaseDrafts(rows: PhotoIndexRow[]): PhotoRecord[] {
  const byId = new Map<string, PhotoRecord>();

  for (const row of rows) {
    const isDraft = row._id.startsWith(DRAFT_PREFIX);
    const id = isDraft ? row._id.slice(DRAFT_PREFIX.length) : row._id;
    const existing = byId.get(id);

    if (!existing) {
      byId.set(id, { ...row, id, hasDraft: isDraft });
      continue;
    }
    if (isDraft) {
      // Le brouillon écrase le publié.
      byId.set(id, { ...row, id, hasDraft: true });
    } else if (!existing.hasDraft) {
      // Deux versions publiées ne devraient pas arriver, mais on reste stable.
      byId.set(id, { ...row, id, hasDraft: false });
    }
    // Publié rencontré APRÈS son brouillon : on ne touche à rien.
  }

  return Array.from(byId.values());
}
