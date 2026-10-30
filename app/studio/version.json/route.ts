/**
 * L'empreinte du build qui sert le Studio (2026-10-30). Un onglet ouvert
 * avant une mise en ligne la compare à la sienne (`StudioUpdateNotice`) :
 * différente, il tourne sur l'ancien schéma et doit être rechargé.
 */
export const dynamic = 'force-static';

export function GET() {
  return Response.json({ stamp: process.env.NEXT_PUBLIC_BUILD_STAMP ?? '' });
}
