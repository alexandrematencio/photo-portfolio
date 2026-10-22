/**
 * Quel site ce build produit, et où vivent les autres — source UNIQUE.
 *
 * Un dépôt, une application Next, DEUX builds (2026-10-17) :
 * - `photo` — le portfolio, sur `amatencio.com` (puis `photo.` avec la page
 *   d'accueil) ;
 * - `blog` — le journal, sur `blog.amatencio.com`.
 *
 * `SITE_TARGET=blog` au build choisit le second (next.config.ts) : seules les
 * routes en `*.blog.tsx` / `*.blog.ts` y sont compilées, les routes `.tsx`
 * ordinaires seulement dans le premier. Les composants sont communs.
 *
 * Toute adresse qui traverse d'un site à l'autre passe par `photoHref` /
 * `blogHref` : un lien relatif écrit sur le blog vers `/about` ouvrirait
 * `blog.amatencio.com/about`, qui n'existe pas.
 */
export type SiteId = 'photo' | 'blog';

export const SITE_ID: SiteId = process.env.NEXT_PUBLIC_SITE_ID === 'blog' ? 'blog' : 'photo';
export const IS_BLOG = SITE_ID === 'blog';

const strip = (url: string) => url.replace(/\/+$/, '');

/** Origines publiques des deux sites (`.env.development` / `.env.production`). */
export const PHOTO_URL = strip(process.env.NEXT_PUBLIC_PHOTO_URL ?? 'https://photo.amatencio.com');
export const BLOG_URL = strip(process.env.NEXT_PUBLIC_BLOG_URL ?? 'https://blog.amatencio.com');

/**
 * Le HUB : `amatencio.com`, l'entrée principale de tous les sites — la cible
 * du clic sur « All sites » (demande Alexandre, 2026-10-22). La page
 * d'accueil est le projet am-home ; le portfolio vit sur `photo.`.
 *
 * Le hub porte aussi LA page About, la seule (hors celle du journal) :
 * construite par ce dépôt, servie par Caddy sous `amatencio.com/about/`
 * (bascule du 2026-10-22). Toute adresse vers elle passe par `hubHref`.
 */
const HUB_ORIGIN = strip(process.env.NEXT_PUBLIC_HUB_URL ?? 'https://amatencio.com');
export const HUB_URL = `${HUB_ORIGIN}/`;

/** Adresse d'une page du hub, valable depuis n'importe quel site. */
export function hubHref(path: string): string {
  return `${HUB_ORIGIN}${path}`;
}

/** La page About, sur le hub. */
export const ABOUT_URL = hubHref('/about/');

/**
 * Une page du HUB construite par ce dépôt — aujourd'hui About seule. Servie
 * sous `amatencio.com`, elle porte le menu du hub (`HUB_NAV_LINKS`), jamais
 * celui du portfolio : le glyph y ramène à la porte d'amatencio.com.
 */
export function isHubPage(pathname: string | null): boolean {
  return !IS_BLOG && !!pathname && /^\/about(\/|$)/.test(pathname);
}

/** Adresse d'une page du portfolio, valable depuis n'importe quel site. */
export function photoHref(path: string): string {
  return IS_BLOG ? `${PHOTO_URL}${path}` : path;
}

/** Adresse d'une page du journal, valable depuis n'importe quel site. */
export function blogHref(path: string): string {
  return IS_BLOG ? path : `${BLOG_URL}${path}`;
}

/** Chemins d'un article, d'une série, de l'accueil — dans une langue (lib/journal/i18n.ts). */
export { articlePath, seriesPath, homePath } from '@/lib/journal/i18n';

export function isExternal(href: string): boolean {
  return /^https?:\/\//.test(href);
}

/**
 * La home du PORTFOLIO — la page à hero, hors châssis (FramedScroll,
 * MainPadding, nav-bar…). Sur le journal, `/` est une page ordinaire : tout
 * composant qui traite `/` à part passe par ici, jamais par `pathname === '/'`.
 */
export function isPhotoHome(pathname: string | null): boolean {
  return !IS_BLOG && pathname === '/';
}
