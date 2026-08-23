import { cn } from '@/lib/utils/cn';

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

/**
 * DÉCORATION de lien éditorial, sans la typo — orange de marque + soulignement
 * épais. Extraite le 2026-08-23 pour que les liens écrits dans le Studio la
 * portent aussi : `PortableBody` (variante `editorial`) rend ses marks `link`
 * avec cette chaîne. Sans elle, brancher `/contact` sur le CMS aurait remplacé
 * le soulignement de marque par le lien générique — même texte, autre trait.
 * Un lien INLINE dans un paragraphe n'hérite ni de la taille ni de `w-fit`,
 * d'où la séparation des deux constantes.
 *
 * **Orange, 2026-08-23** (demande Alexandre) : les liens inline du corps
 * éditorial passent en `--color-link`. Portée volontairement étroite — les
 * items de menu, les liens de galerie et le footer gardent leur couleur de
 * texte. Ce qui vire à l'orange, c'est le lien AU MILIEU D'UNE PHRASE, celui
 * qu'il faut distinguer du texte qui l'entoure.
 *
 * Le soulignement n'a PAS de couleur déclarée : `text-decoration-color` vaut
 * `currentColor` par défaut, il suit donc le texte tout seul — et surtout il
 * suit aussi le survol. Une `decoration-[…]` explicite créerait un second
 * endroit à tenir synchronisé, pour zéro gain.
 *
 * Le survol FONCE (`--color-link-hover`) au lieu de faner : l'ancien
 * `opacity-60` sur un orange saturé retombait à ~2,1:1 sur le papier, soit un
 * lien moins lisible au moment où on le vise. D'où aussi `transition-colors`
 * et non `transition-opacity`.
 */
export const EDITORIAL_LINK_DECORATION =
  'text-[var(--color-link)] hover:text-[var(--color-link-hover)] underline underline-offset-[6px] decoration-2 transition-colors motion-reduce:transition-none';

/**
 * Corps de texte + lien : même échelle, orange de marque, soulignement épais.
 *
 * ⚠️ `cn()` et PAS une concaténation : `EDITORIAL_BODY` porte
 * `text-[var(--color-fg)]` et la décoration porte `text-[var(--color-link)]`.
 * Sur le MÊME élément, ces deux utilities ont la même spécificité — c'est
 * l'ordre du CSS généré qui tranche, pas l'ordre dans l'attribut `class`.
 * `tailwind-merge` résout le conflit à la source en ne gardant que la
 * dernière. (Le cas ne se pose pas dans `PortableBody`, où le `<a>` est un
 * ENFANT du `<p>` : une couleur déclarée l'emporte toujours sur une couleur
 * héritée.)
 */
export const EDITORIAL_BODY_LINK = cn(EDITORIAL_BODY, EDITORIAL_LINK_DECORATION, 'w-fit');
