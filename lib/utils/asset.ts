/**
 * Préfixe un asset du dossier `/public/` avec le `basePath` Next.js en prod.
 *
 * Next.js applique automatiquement le `basePath` aux URLs framework (`_next/*`,
 * navigation interne via `<Link>`, etc.) — MAIS PAS aux assets dans `/public/`
 * référencés directement par leur chemin (`<img src="/img/x.jpg">` ou
 * `<Image src="/img/x.jpg">` avec `images.unoptimized: true`).
 *
 * Cette fonction comble ce trou en mode production. En dev (`npm run dev`),
 * le basePath est vide donc l'URL reste à la racine ; en prod (déploiement
 * gh-pages), le basePath `/photo-portfolio` est ajouté.
 *
 * Usage:
 *   <img src={asset('/img/photo.jpg')} />
 *   <Image src={asset('/img/photo.jpg')} ... />
 */
const BASE_PATH = process.env.NODE_ENV === 'production' ? '/photo-portfolio' : '';

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
