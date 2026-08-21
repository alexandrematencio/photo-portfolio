import { urlFor } from '@/lib/sanity/image';
import type { Photo } from '@/lib/sanity/queries';

/**
 * URL de l'image CENTRALE (1600 px) d'une photo en vue ouverte de /series —
 * source UNIQUE de cette adresse. La même URL sert à l'affichage
 * (OpenSeriesView), au préchargement des voisines et à l'affinage des clones
 * (DesktopSeries) : c'est ce qui garantit le cache hit navigateur — une
 * variante d'un seul paramètre (width, quality) serait un fichier DIFFÉRENT
 * sur le CDN, donc un préchargement pour rien.
 */
export function centerSrcFor(photo: Photo): string {
  return photo.image
    ? (urlFor(photo.image)?.width(1600).quality(82).auto('format').url() ?? '')
    : '';
}
