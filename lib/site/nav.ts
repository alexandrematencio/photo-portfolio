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

import { CONCEPT_MAP_PATH } from '@/lib/journal/i18n';
import { ABOUT_URL, HUB_URL, IS_BLOG, blogHref, photoHref } from './sites';

export type NavLink = {
  href: string;
  label: string;
  /**
   * `'sites'` : le déclencheur du menu « All sites » (`SitesMenu`). Elle
   * garde sa place dans la liste — le morph du hero et `measureNavBar`
   * comptent les entrées par leur rang. Le menu s'ouvre au SURVOL ; le clic
   * suit `href`, le hub `amatencio.com` (2026-10-22) — une adresse d'un autre
   * site, donc jamais active.
   *
   * `'journal'` : le menu « Journal » de blog.amatencio.com — tous les
   * articles, puis chaque série. Toujours ACTIF sur le blog : on y est dans
   * le journal, quelle que soit la page.
   */
  menu?: 'sites' | 'journal';
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
      // Le journal (blog.amatencio.com) : « All sites », puis « Journal » —
      // un menu, surligné comme page active —, puis la page About du
      // portfolio, qui porte le contact (ordre demandé par Alexandre le
      // 2026-10-18). La Concept Map entre entre les deux (2026-10-29,
      // demande Alexandre) ; en français seulement jusqu'à la phase 5.
      { href: HUB_URL, label: 'All sites', menu: 'sites' },
      { href: '/', label: 'Journal', menu: 'journal' },
      { href: CONCEPT_MAP_PATH, label: 'Concept Map' },
      { href: ABOUT_URL, label: 'About' },
    ]
  : [
      { href: '/series', label: 'Series' },
      { href: '/archives', label: 'Archives' },
      // LA page About vit sur le hub (2026-10-22) : adresse absolue.
      { href: ABOUT_URL, label: 'About' },
      { href: blogHref('/'), label: 'Journal' },
      { href: HUB_URL, label: 'All sites', menu: 'sites' },
    ];

/**
 * Le menu des pages du HUB construites ici (About, `isHubPage`) : le glyph
 * ramène à amatencio.com, puis « All sites », puis About — actif. Ni Series ni
 * Archives : on n'est plus dans le portfolio (demande Alexandre, 2026-10-22).
 * Pas de morph sur ces pages : la rangée se cale à gauche, comme le journal.
 */
export const HUB_NAV_LINKS: NavLink[] = [
  { href: HUB_URL, label: 'All sites', menu: 'sites' },
  { href: ABOUT_URL, label: 'About' },
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

/**
 * « Journal » est surligné sur tout le blog, SAUF sur la Concept Map : elle a
 * sa propre entrée, et deux pages actives ne disent plus où l'on est.
 */
export function journalIsActive(pathname: string): boolean {
  return !isSamePage(CONCEPT_MAP_PATH, pathname);
}

export function isSamePage(href: string, pathname: string): boolean {
  // About est une adresse absolue (le hub), mais sa page est construite ICI,
  // sous /about : c'est ce chemin qui la désigne pour le surlignage.
  if (href === ABOUT_URL) return stripSlash(pathname) === '/about';
  return stripSlash(href) === stripSlash(pathname);
}

export function notifySamePageNav(href: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(SAME_PAGE_NAV_EVENT, { detail: { href: stripSlash(href) } })
  );
}
