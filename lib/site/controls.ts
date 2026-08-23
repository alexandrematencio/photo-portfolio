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
 * ⚠️ Ce padding n'est posé que sur l'item ACTIF de la nav-bar : la rangée doit
 * atterrir au pixel près sur l'état final du morph du hero de la home, qui n'a
 * aucun item actif (CLAUDE.md §3.6 invariant 6). Partout ailleurs, il se pose
 * sur TOUS les items et seul le fond bascule — sinon la rangée ou la colonne
 * se décale sous les yeux de l'utilisateur à chaque clic (CLAUDE.md §7.7).
 *
 * ⚠️ Il ne vaut QUE pour la nav-bar desktop. Le tiroir mobile a le sien
 * ci-dessous : ses libellés font 48 px contre 14, la même boîte y colle au
 * texte. Ne pas les refusionner « pour n'avoir qu'un nombre » — c'est la
 * grammaire qui est commune (fond plein, rayon, libellé noir), pas la mesure.
 */
export const ACTIVE_FILL_PADDING = '4px 12px 6px 12px';

/**
 * Même surlignage, mesure du TIROIR MOBILE (demande Alexandre, 2026-08-23 :
 * « ça laisse le texte du bouton de menu respirer »). Les libellés y sont à
 * 48 px bold : le 12/4/6 de la nav-bar desktop, calibré sur du 14 px, s'y
 * lisait comme un liseré collé au texte. 16/6/8 lui rend de l'air. Le desktop,
 * lui, ne peut PAS suivre — sa géométrie est celle d'arrivée du morph du hero.
 *
 * Le bas reste 2 px plus profond que le haut, pour la même raison qu'en
 * desktop : « About », « Series », « Archives » n'ont aucun jambage.
 *
 * Les trois nombres vivent ICI et pas dans la chaîne, parce que deux autres
 * mesures du tiroir en dérivent et se décaleraient en silence sans eux :
 * la gouttière (`32 − inset` — c'est le TEXTE qui doit tomber sur les 32 px de
 * la page, pas la boîte qui le porte) et l'écart vertical (`32 − top − bottom`
 * — les paddings s'ajoutent sinon à l'écart, et la colonne s'aère d'autant par
 * item par rapport au mockup).
 */
export const ACTIVE_FILL_MOBILE = { top: 6, bottom: 8, inset: 16 } as const;

export const ACTIVE_FILL_PADDING_MOBILE = `${ACTIVE_FILL_MOBILE.top}px ${ACTIVE_FILL_MOBILE.inset}px ${ACTIVE_FILL_MOBILE.bottom}px ${ACTIVE_FILL_MOBILE.inset}px`;
