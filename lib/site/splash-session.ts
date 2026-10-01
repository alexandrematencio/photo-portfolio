/**
 * Mémoire du splash de la home — UNE seule clé, `splashSeen`.
 *
 * Le splash joue au plus une fois toutes les SPLASH_TTL_MS (12 h) : ni au
 * rechargement, ni au retour par le logo, ni dans un nouvel onglet — mais à
 * nouveau le lendemain (2026-10-01, demande d'Alexandre).
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
 * localStorage + date, et plus sessionStorage : Chrome et Safari gardent le
 * sessionStorage d'un onglet restauré au redémarrage, si bien que dans un
 * onglet resté ouvert le splash ne revenait jamais. Pas un cookie pour autant :
 * export statique (aucun SSR pour le lire) et position « zéro cookie »
 * (CLAUDE.md §6) — une préférence d'affichage stockée localement n'en est pas un.
 *
 * La valeur est l'instant où le splash a été vu (ms). La fenêtre est FIXE : la
 * reposer pendant qu'elle court ne la prolonge pas, sinon un visiteur qui
 * passe tous les jours ne reverrait jamais l'intro.
 */
export const SPLASH_SEEN_KEY = 'splashSeen';
export const SPLASH_TTL_MS = 12 * 60 * 60 * 1000;

function seenAt(): number | null {
  try {
    const at = Number(localStorage.getItem(SPLASH_SEEN_KEY));
    return at > 0 ? at : null; // absente, ou ancienne valeur 'true' → non vue
  } catch {
    return null; // storage bloqué → le splash joue, jamais une page coincée
  }
}

export function hasSeenSplash(): boolean {
  const at = seenAt();
  return at !== null && Date.now() - at < SPLASH_TTL_MS;
}

export function markSplashSeen(): void {
  if (hasSeenSplash()) return; // fenêtre fixe : ne pas la prolonger
  try {
    localStorage.setItem(SPLASH_SEEN_KEY, String(Date.now()));
  } catch {
    // storage bloqué — le splash rejouera simplement la prochaine fois
  }
}
