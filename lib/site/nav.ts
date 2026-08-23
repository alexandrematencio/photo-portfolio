/**
 * Source unique des entrées de navigation du site.
 *
 * Consommée par `SiteHeader`, `HomeHero`, `HomeHeroSplash` et `MobileMenu`.
 * Ces quatre composants redéclaraient chacun sa propre liste : ajouter une
 * page obligeait à quatre éditions, et rien n'empêchait qu'elles divergent —
 * ce qui était d'ailleurs déjà arrivé (le menu mobile portait un lien
 * Instagram absent des trois autres, cf. `MOBILE_EXTRA_LINKS` ci-dessous).
 *
 * ⚠️ `NAV_LINKS` est aussi l'état d'arrivée du morph du hero de la home
 * (cf. CLAUDE.md §3.6) : la nav-bar finale est composée des nav items morphés.
 * Ajouter ou retirer une entrée change la géométrie de ce morph. Après toute
 * modification de cette liste, revérifier l'atterrissage du hero sur `/`,
 * en chargement à froid ET au rechargement.
 */

export type NavLink = {
  href: string;
  label: string;
  /** Lien sortant : nouvel onglet, jamais marqué comme page active. */
  external?: boolean;
};

/**
 * Navigation principale, identique sur toutes les pages publiques.
 *
 * 2026-08-20 : « Series » entre, « Digital Agency » sort — dans le même geste,
 * pour que le nombre d'entrées reste constant (5) et que la géométrie du morph
 * du hero ne soit touchée qu'une fois (spec /series §2). `/digital-agency`
 * reste en ligne à son adresse ; son contenu sera rattaché à /about (chantier C).
 */
export const NAV_LINKS: NavLink[] = [
  { href: '/about', label: 'About' },
  { href: '/series', label: 'Series' },
  { href: '/archives', label: 'Archives' },
  { href: '/contact', label: 'Contact' },
  { href: '/socials', label: 'Socials' },
];

/**
 * Entrées supplémentaires propres au menu mobile. Le drawer dispose de plus
 * de place verticale que la nav-bar desktop, d'où ce lien social en plus.
 */
export const MOBILE_EXTRA_LINKS: NavLink[] = [
  {
    href: 'https://www.instagram.com/alxmtc',
    label: 'Instagram',
    external: true,
  },
];

/** Liste complète affichée dans le drawer mobile. */
export const MOBILE_NAV_LINKS: NavLink[] = [
  ...NAV_LINKS,
  ...MOBILE_EXTRA_LINKS,
];

/**
 * Clic sur un lien de nav qui pointe vers la page DÉJÀ affichée.
 *
 * Next ne remonte pas la page dans ce cas — c'est voulu et c'est ce qui rend
 * la navigation instantanée — mais l'état interne de la page, lui, survit
 * intact. Sur `/series`, cliquer « Series » depuis une série ouverte ne
 * ramenait donc nulle part : la série restait ouverte. Aucun signal du routeur
 * ne permet de le détecter (le `pathname` ne change pas, `pushState` n'émet
 * pas de `popstate`), d'où cet événement, émis par les composants de nav et
 * écouté par la page qui a un état à remettre à zéro.
 */
export const SAME_PAGE_NAV_EVENT = 'nav:same-page';

/** Compare deux chemins sans se soucier du slash final (`trailingSlash: true`). */
function stripSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function isSamePage(href: string, pathname: string): boolean {
  return stripSlash(href) === stripSlash(pathname);
}

export function notifySamePageNav(href: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SAME_PAGE_NAV_EVENT, { detail: { href: stripSlash(href) } })
  );
}
