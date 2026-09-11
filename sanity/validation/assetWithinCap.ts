import type { CustomValidator } from 'sanity';

/**
 * Plafond du grand côté d'un asset image. Aligné sur `MAX_EDGE` de
 * scripts/prepare-image.ts (2048) — deux nombres, un seul sens : le site ne
 * doit JAMAIS stocker une photo dont l'original serait récupérable en pleine
 * résolution en retirant `?w=` de l'URL (audit du 2026-09-11).
 *
 * Pourquoi une validation et pas un redimensionnement : le Studio dépose
 * l'asset AVANT que le formulaire voie quoi que ce soit, et Sanity n'offre
 * aucun hook serveur. On ne peut donc pas réduire ; on peut refuser de publier.
 * Le message dit quoi faire.
 */
export const MAX_ASSET_EDGE = 2048;

type ImageValue = { asset?: { _ref?: string } } | undefined;

export const assetWithinCap: CustomValidator<ImageValue> = async (value, context) => {
  const ref = value?.asset?._ref;
  if (!ref) return true;
  const client = context.getClient({ apiVersion: '2026-01-01' });
  const dims = await client.fetch<{ width: number; height: number } | null>(
    '*[_id == $id][0].metadata.dimensions{ width, height }',
    { id: ref }
  );
  if (!dims) return true;
  if (Math.max(dims.width, dims.height) <= MAX_ASSET_EDGE) return true;
  return (
    `Image trop grande : ${dims.width} × ${dims.height} px. Le site plafonne à ` +
    `${MAX_ASSET_EDGE} px sur le grand côté, sinon l’original reste récupérable ` +
    `en pleine résolution par n’importe qui. Exporte-la à 2048 px (Lightroom : ` +
    `Redimensionner → Bord long → 2048) et remplace l’image, ou importe-la par ` +
    `« npm run upload-photos », qui la réduit tout seul.`
  );
};
