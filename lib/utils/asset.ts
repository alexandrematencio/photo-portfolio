/**
 * Préfixe un asset du dossier `/public/` avec le `basePath` Next.js en prod.
 *
 * Next.js applique automatiquement le `basePath` aux URLs framework (`_next/*`,
 * navigation interne via `<Link>`, etc.) — MAIS PAS aux assets dans `/public/`
 * référencés directement par leur chemin (`<img src="/img/x.jpg">` ou
 * `<Image src="/img/x.jpg">` avec `images.unoptimized: true`).
 *
 * Cette fonction comble ce trou. La valeur vient de `NEXT_PUBLIC_BASE_PATH`
 * (`.env.development` → vide, `.env.production` → `/photo-portfolio`), la MÊME
 * que celle lue par `next.config.ts`. C'est le point à ne pas défaire : deux
 * littéraux à garder d'accord, c'est un jour de migration où l'un des deux est
 * oublié et où toutes les images de `/public/` tombent en 404. Passer le site
 * à la racine (domaine propre) = vider la variable, rien d'autre.
 *
 * ⚠️ `.env.local` passe DEVANT `.env.production` dans la précédence de Next :
 * ne jamais y poser cette variable, c'est le piège qui a déjà fait publier
 * `localhost` en canonical pendant trois mois (cf. `.env.production`).
 *
 * Usage:
 *   <img src={asset('/img/photo.jpg')} />
 *   <Image src={asset('/img/photo.jpg')} ... />
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
