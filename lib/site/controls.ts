/**
 * GÉOMÉTRIE DES COMMANDES — le rayon des marques d'état, en un seul endroit.
 *
 * **Le problème qu'il règle.** Le fond plein `--color-active-bg` veut dire une
 * seule chose sur tout le site — « c'est celui-là » — et il se dessinait avec
 * trois géométries différentes : rectangle à rayon 0 (onglets de groupement
 * d'`/archives`), rectangle à rayon 1 (nav-bar), disque de 44 px (boutons de
 * densité). Le brand book, lui, écrit que « le rayon de 1 px est le seul coin
 * arrondi du système d'état » — donc deux des trois le contredisaient, et rien
 * ne disait laquelle des règles était la vraie.
 *
 * **La règle, une fois pour toutes** : le PLAN décide de la forme.
 *
 * - Sur le papier et sur la plaque (nav-bar, tiroir mobile, onglets de
 *   groupement, pastilles de filtre) → `CONTROL_RADIUS`. Juste assez pour que
 *   le bloc ne se lise pas comme un rectangle brut, pas assez pour qu'il se
 *   lise comme un bouton.
 * - Sur le module sombre encastré (boutons de densité) → le disque plein, et
 *   lui seul. Ce n'est pas une exception esthétique : le module est un autre
 *   plan, physiquement en creux, et ses commandes sont des boutons de matériel
 *   là où les autres sont des surlignages de texte. Une différence de plan
 *   justifie une différence de forme ; deux formes sur le MÊME plan, non.
 *
 * ⚠️ Le rayon se pose en style INLINE, jamais en utility Tailwind — même piège
 * que le padding : le reset `* { padding: 0 }` d'`app/globals.css` vit hors
 * `@layer`. Le rayon, lui, n'est pas mangé, mais le padding qui l'accompagne
 * l'est : autant que les deux voyagent ensemble, dans le même objet de style.
 */
export const CONTROL_RADIUS = 1;

/**
 * PADDING DU SURLIGNAGE de la page courante, famille NAVIGATION (nav-bar
 * desktop + tiroir mobile). Le bas est 2 px plus profond que le haut : les
 * libellés sont en hauteur de capitale seule (« About », « Series »,
 * « Archives » n'ont aucun jambage), un padding égal se lit donc lourd du bas.
 *
 * ⚠️ Les onglets de groupement d'`/archives` ne partagent PAS ce padding (ils
 * ont le leur, 4/24, arbitré sur capture). Ce qu'ils partagent, c'est le rayon
 * et la couleur — c'est-à-dire la grammaire, pas la mesure.
 *
 * ⚠️ Dans la nav-bar DESKTOP, ce padding n'est posé que sur l'item ACTIF : la
 * rangée doit atterrir au pixel près sur l'état final du morph du hero de la
 * home, qui n'a aucun item actif (CLAUDE.md §3.6 invariant 6). Partout
 * ailleurs, il se pose sur TOUS les items et seul le fond bascule — sinon la
 * rangée ou la colonne se décale sous les yeux de l'utilisateur à chaque clic
 * (CLAUDE.md §7.7).
 */
export const ACTIVE_FILL_PADDING = '4px 12px 6px 12px';

/** Retrait horizontal de `ACTIVE_FILL_PADDING`, à soustraire de la gouttière
 *  du conteneur quand le padding est posé sur TOUS les items : sans ça, la
 *  colonne entière se décale de 12 px et le texte quitte la gouttière de 32.
 *  Dérivé du padding lui-même, jamais réécrit à la main. */
export const ACTIVE_FILL_INSET = 12;
