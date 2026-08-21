'use client';

import { useEffect } from 'react';

/**
 * Décourage la récupération des photos au geste : clic droit → « Enregistrer
 * l'image sous » et glisser-déposer vers le bureau.
 *
 * ⚠️ CE N'EST PAS UNE PROTECTION, et il ne faut pas le vendre comme telle. Les
 * outils de développement, l'onglet réseau, `view-source`, une extension ou une
 * simple capture d'écran contournent tout ça en quelques secondes, et **aucun
 * site ne peut l'empêcher** : le navigateur doit décoder l'image pour
 * l'afficher, donc elle est forcément à portée de qui sait la chercher. Ce qui
 * protège réellement le travail, c'est le plafond de résolution posé à l'import
 * (`MAX_EDGE` dans `scripts/upload-photos.ts`) : on ne peut pas voler mieux que
 * ce qui est servi. Le geste bloqué ici sert surtout de signal — « ces images
 * ne sont pas libres de droits » — au visiteur de passage.
 *
 * Écouteurs au niveau du DOCUMENT plutôt qu'un `onContextMenu` par image :
 * les photos sont rendues par une demi-douzaine de composants (PhotoCard,
 * PhotoBlock, PhotoLightbox, OriginalViewer, FolderStack, les deux branches de
 * /series…), et une seule oubliée rouvrirait la porte. Une garde par composant
 * est une garde qu'on oublie d'ajouter à la prochaine page.
 *
 * Monté dans le layout du groupe `(site)` UNIQUEMENT : /studio vit hors de ce
 * groupe et garde son clic droit, dont l'édition a besoin.
 */
export function PhotoGuard() {
  useEffect(() => {
    // On ne bloque que sur une IMAGE : ailleurs, le menu contextuel reste
    // disponible (copier un texte, ouvrir un lien dans un onglet, inspecter une
    // page). Le désactiver partout punirait l'usage normal sans rien protéger
    // de plus — les photos sont le seul contenu qu'on cherche à couvrir.
    const isImage = (target: EventTarget | null) =>
      target instanceof Element &&
      (target.tagName === 'IMG' || target.closest('picture') !== null);

    const onContextMenu = (e: MouseEvent) => {
      if (isImage(e.target)) e.preventDefault();
    };

    // `dragstart` en plus du CSS `-webkit-user-drag` : Firefox ignore cette
    // propriété (préfixée WebKit), l'image s'y glisserait donc vers le bureau
    // malgré la feuille de style.
    const onDragStart = (e: DragEvent) => {
      if (isImage(e.target)) e.preventDefault();
    };

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('dragstart', onDragStart);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('dragstart', onDragStart);
    };
  }, []);

  return null;
}
