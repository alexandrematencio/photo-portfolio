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
