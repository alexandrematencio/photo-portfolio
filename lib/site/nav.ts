/**
 * Source unique des entrées de navigation du site.
 *
 * Consommée par `SiteHeader`, `HomeHero`, `HomeHeroSplash` et `MobileMenu`.
 * Ces quatre composants redéclaraient chacun sa propre liste : ajouter une
 * page obligeait à quatre éditions, et rien n'empêchait qu'elles divergent —
 * ce qui était d'ailleurs déjà arrivé (le menu mobile portait un lien
 * Instagram absent des trois autres, retiré le 2026-08-24).
 *
 * ⚠️ `NAV_LINKS` est aussi l'état d'arrivée du morph du hero de la home
 * (cf. CLAUDE.md §3.6) : la nav-bar finale est composée des nav items morphés.
 * Ajouter ou retirer une entrée change la géométrie de ce morph. Après toute
 * modification de cette liste, revérifier l'atterrissage du hero sur `/`,
 * en chargement à froid ET au rechargement.
 */

import { IS_BLOG, blogHref, photoHref } from './sites';

export type NavLink = {
  href: string;
  label: string;
  /**
   * `'sites'` : l'entrée n'est pas un lien mais le déclencheur du menu
   * « All sites » (`SitesMenu`). Elle garde sa place dans la liste — le morph
   * du hero et `measureNavBar` comptent les entrées par leur rang — et son
   * `href` vide ne correspond à aucune page, donc jamais active.
   */
  menu?: 'sites';
};

/**
 * Navigation principale, identique sur toutes les pages publiques.
 *
 * 2026-08-20 : « Series » entre, « Digital Agency » sort — dans le même geste,
 * pour que le nombre d'entrées reste constant (5) et que la géométrie du morph
 * du hero ne soit touchée qu'une fois (spec /series §2). `/digital-agency`
 * reste en ligne à son adresse ; son contenu sera rattaché à /about (chantier C).
 *
 * 2026-08-24 : l'ordre passe à Series, Archives, About, Contact, Socials
 * (demande Alexandre) — le travail d'abord, la personne ensuite. Cet ordre est
 * celui de TOUTES les surfaces de nav ; il n'y a pas de variante par surface.
 * Le morph du hero mesure les largeurs rendues (`getBoundingClientRect`) et
 * répartit l'espace restant : il suit l'ordre sans rien à mettre à jour.
 *
 * 2026-10-17 : le journal ouvre au public. « Journal » prend la place de
 * « Contact », et « Socials » cède la sienne à « All sites », le menu des
 * sites d'amatencio.com. Contact et Socials ne font plus qu'une page,
 * `/contact`, accessible depuis /about (demande Alexandre). Cinq entrées,
 * comme avant : la géométrie du morph ne change que par les largeurs.
 */
export const NAV_LINKS: NavLink[] = IS_BLOG
  ? [
      // Le journal (blog.amatencio.com) : sa page d'accueil, puis la page
      // About du portfolio — qui porte le contact. Le portfolio lui-même se
      // rejoint par « All sites » (« Photography » retiré le 2026-10-18,
      // demande Alexandre).
      { href: '/', label: 'Journal' },
      { href: photoHref('/about/'), label: 'About' },
      { href: '', label: 'All sites', menu: 'sites' },
    ]
  : [
      { href: '/series', label: 'Series' },
      { href: '/archives', label: 'Archives' },
      { href: '/about', label: 'About' },
      { href: blogHref('/'), label: 'Journal' },
      { href: '', label: 'All sites', menu: 'sites' },
    ];

/**
 * Les sites d'amatencio.com, dans le menu « All sites ». `href: null` : site
 * annoncé mais pas encore en ligne — affiché grisé, avec « Soon », jamais un
 * lien mort. Adresses écrites par `photoHref` / `blogHref` : elles restent
 * justes depuis l'un comme l'autre site.
 */
export type SiteEntry = {
  label: string;
  host: string;
  href: string | null;
  external?: boolean;
  /** Le site que ce build produit (voyant « vous êtes ici »). */
  here?: boolean;
};

export const SITES: SiteEntry[] = [
  { label: 'Photography', host: 'photo.amatencio.com', href: photoHref('/'), here: !IS_BLOG },
  { label: 'Journal', host: 'blog.amatencio.com', href: blogHref('/'), here: IS_BLOG },
  { label: 'Agency', host: 'aaxlo.com', href: 'https://www.aaxlo.com/', external: true },
  { label: 'Design', host: 'design.amatencio.com', href: null },
];

/**
 * Liste complète affichée dans le drawer mobile : « Home » en tête, puis la
 * nav principale.
 *
 * Pourquoi « Home » n'existe QUE là : sur desktop, le glyph de la nav-bar EST
 * le retour à l'accueil, et une entrée `/` dans `NAV_LINKS` ferait tomber
 * l'invariant 6 du §3.6 (la home n'a par construction aucun item actif, c'est
 * ce qui autorise à ne padder que l'actif). Le drawer, lui, padde tous ses
 * items : il peut porter une entrée active sans toucher à aucune géométrie.
 */
export const MOBILE_NAV_LINKS: NavLink[] = IS_BLOG
  ? NAV_LINKS // « Journal » y est déjà l'accueil
  : [{ href: '/', label: 'Home' }, ...NAV_LINKS];

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
