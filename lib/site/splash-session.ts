/**
 * Mémoire de session du splash de la home — UNE seule clé sessionStorage.
 *
 * Le splash joue une fois par session, comme le site AAXLO (2026-09-10).
 * Deux écrivains, un seul lecteur :
 *   - `SplashScreen` la pose au premier reveal (joué, sauté à Échap ou sauté
 *     par la gate) ;
 *   - `SiteSessionMarker` la pose dès que le visiteur change de page dans le
 *     site — arriver sur `/` depuis une autre page ne doit pas jouer l'intro.
 *   - La gate de `SplashScreen` ne lit qu'elle.
 *
 * Pourquoi une seule clé : il y en a eu deux (`splashSeen` + `siteVisited`).
 * Effacer `splashSeen` dans les DevTools ne rejouait rien — `siteVisited`
 * suffisait à sauter, et le saut réécrivait `splashSeen` aussitôt. Une clé,
 * c'est un seul geste pour rejouer l'intro : la supprimer, puis recharger.
 *
 * sessionStorage plutôt qu'un cookie comme AAXLO : export statique (aucun
 * SSR pour lire un cookie) et position « zéro cookie » (CLAUDE.md §6).
 * Revers assumé : sessionStorage est par onglet — un onglet neuf rejoue.
 */
export const SPLASH_SEEN_KEY = 'splashSeen';

export function hasSeenSplash(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) === 'true';
  } catch {
    return false; // storage bloqué → le splash joue, jamais une page coincée
  }
}

export function markSplashSeen(): void {
  try {
    sessionStorage.setItem(SPLASH_SEEN_KEY, 'true');
  } catch {
    // storage bloqué — le splash rejouera simplement la prochaine fois
  }
}
