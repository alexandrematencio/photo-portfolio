/**
 * Studio Sanity monté à /studio.
 * Cf. doc : https://www.sanity.io/docs/next-app-router
 */
import { Studio } from './Studio';

// Le Studio Sanity gère son propre routing côté client (SPA).
// En export statique, seule la route `/studio` (root) est pré-rendue. Les sous-chemins
// (/studio/structure/photo;…) sont gérés dynamiquement par le Studio React une fois chargé.
// Pour un hard-reload sur un sous-chemin, GH Pages renvoie 404 — limitation acceptable
// puisque le Studio est destiné à l'édition locale (dev), pas aux testeurs publics.
export const dynamic = 'force-static';

// Avec `output: 'export'`, Next.js exige un generateStaticParams pour les catch-all.
// On ne pré-render que la racine `/studio/` ; le Studio React gère les sous-chemins en SPA.
export function generateStaticParams() {
  return [{ tool: [] }];
}

export const metadata = {
  title: 'Studio — A. Matencio',
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <Studio />;
}
