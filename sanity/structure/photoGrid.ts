import type { StructureBuilder } from 'sanity/structure';

import { PhotoGridPane, type PhotoGridOptions } from '../panes/PhotoGridPane';

export type PhotoGridNode = Omit<PhotoGridOptions, 'create'> & {
  id: string;
  title: string;
  /**
   * Création depuis ce panneau : `null` = pas de bouton (les vues qui sont
   * des FENÊTRES sur le catalogue, pas des dossiers — curation, masquées,
   * récentes) ; `{}` = photo vierge ; `{ template, params }` = photo née
   * rattachée au contexte courant (`PHOTO_AXIS_TEMPLATES`, studio.config.ts).
   */
  create: { template?: string; params?: Record<string, unknown> } | null;
};

/**
 * Une liste de photos de Structure rendue par `PhotoGridPane` — planche-contact
 * quand rien n'est ouvert, colonne dès qu'une photo l'est (§11.21).
 *
 * Remplace `S.documentList().filter('_type == "photo" && …')` : la condition
 * se donne SANS le `_type`, posé par le panneau. Les paramètres de template ne
 * voyagent pas dans l'URL : le panneau ne marque que `template` sur le lien
 * de création, et le résolveur d'enfant, qui a les paramètres sous la main,
 * les applique.
 *
 * ⚠️ Un panneau composant ne répond à AUCUN intent (`canHandleIntent` n'existe
 * que sur les listes) : une photo ouverte depuis le Tableau de bord ou la
 * recherche globale s'ouvre dans l'éditeur de repli de Sanity, à la racine,
 * et non sous « Photos → Toutes ». Assumé — voir la skill.
 */
export function photoGridPane(S: StructureBuilder, node: PhotoGridNode) {
  const { id, title, create, ...rest } = node;
  const options: PhotoGridOptions = {
    ...rest,
    create: create ? { template: create.template } : null,
  };
  return S.component({
    id,
    title,
    component: PhotoGridPane,
    options,
    child: (childId, context) => {
      const doc = S.document().documentId(childId).schemaType('photo');
      return create?.template && context.params.template === create.template
        ? doc.initialValueTemplate(create.template, create.params)
        : doc;
    },
  });
}
