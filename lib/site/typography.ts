/**
 * Classes typographiques partagées des pages éditoriales.
 *
 * **Pourquoi une constante et pas une classe recopiée.** Le style du corps de
 * texte était dupliqué à l'identique dans 16 endroits (le rendu Portable Text,
 * les replis de chaque page, et les pages en dur `/contact`, `/legal`,
 * `/privacy`). Changer « la taille du corps de texte » demandait donc 16
 * modifications cohérentes entre elles — autant dire une dérive garantie, et
 * l'impossibilité de tenir la promesse « ça se règle au niveau du CMS ».
 * Ici, un seul endroit.
 *
 * ⚠️ Ne pas recopier ces chaînes ailleurs. Si un besoin voisin apparaît,
 * ajouter une constante à côté plutôt que de dupliquer celle-ci.
 */

/**
 * CORPS DE TEXTE éditorial — ce que rend un paragraphe écrit dans le Studio.
 *
 * 28 px desktop / 19 px mobile. Descendu d'un cran depuis 32/22 le 2026-08-21 :
 * le corps partage sa graisse ET son interlettrage avec le H4 (36/24), il ne
 * lui restait que la taille pour s'en distinguer — et 11 % d'écart en desktop,
 * 9 % en mobile, passent sous le seuil où l'œil lit une hiérarchie voulue
 * (~20 % à graisse égale). À 28/19, l'écart au H4 monte à 22 % / 21 % : le plus
 * petit pas qui règle vraiment le problème, sans en faire deux.
 *
 * `leading-[1.34]` inchangé volontairement. Point de vigilance si la taille
 * baisse encore : la mesure s'allonge mécaniquement (~74 caractères par ligne
 * à 28 px dans la colonne de 1107 px, soit le haut de la fourchette lisible).
 * Le cran suivant demanderait une largeur de colonne réduite, pas seulement
 * une taille réduite.
 */
export const EDITORIAL_BODY =
  'font-sans text-[19px] md:text-[28px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]';

/**
 * ⚠️ `font-sans` en tête : depuis le passage à deux familles (2026-08-22),
 * Helvetica est la fonte par défaut du site et Inter n'est PLUS héritée.
 * Cette constante est la SEULE frontière entre les deux — c'est elle qui
 * rebascule le corps éditorial sur Inter. La retirer ferait glisser toutes
 * les pages éditoriales en Helvetica sans autre signal.
 */

/** Corps de texte + lien : même échelle, soulignement épais du brand. */
export const EDITORIAL_BODY_LINK = `${EDITORIAL_BODY} underline underline-offset-[6px] decoration-2 hover:opacity-60 transition-opacity motion-reduce:transition-none w-fit`;
