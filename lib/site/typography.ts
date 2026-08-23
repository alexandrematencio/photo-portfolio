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

/**
 * CAPITALE MICRO — l'étiquette du site : titre de groupe, sous-titre de page,
 * année, compteur, fiche technique, légende de lightbox.
 *
 * **Ce qu'elle répare.** Le brand book prescrit `+0.25em` d'interlettrage sur
 * le sous-label de 11 px (§5.3 / §5.4). `grep tracking-\[0.25em\]` ne le
 * trouvait NULLE PART dans le repo : toute la couche des micro-étiquettes était
 * en interlettrage nul, du titre de groupe des Archives à la légende de la
 * lightbox. C'est le plus gros écart entre le site et sa propre spec — et la
 * petite capitale largement espacée est précisément la signature typographique
 * de la référence Teenage Engineering. Elle fait appartenir tout le site à la
 * console des Archives sans poser une seule plaque.
 *
 * **Où elle s'applique, où elle ne s'applique pas.** La frontière est le rôle,
 * pas la taille :
 * - ÉTIQUETTE (on la lit, on ne la clique pas) → interlettrage large. C'est ici.
 * - COMMANDE (onglet, pastille de filtre, bouton de densité, nom de série
 *   cliquable) → interlettrage serré, `tracking-[-0.02em]`. Le brand book le
 *   dit déjà des pastilles : « ce sont des contrôles interactifs, pas des
 *   micro-labels ». Élargir une commande qui porte « Djerba, Tunisia (54) »
 *   ferait déborder la rangée bien avant d'apporter quoi que ce soit.
 *
 * `tabular-nums` est inclus : ces étiquettes sont pleines de nombres qui
 * changent en place — compteurs `(54)`, années, ouvertures, focales. En
 * chiffres proportionnels, une colonne de métadonnées frémit d'un chiffre à
 * l'autre. C'est aussi gratuit : Helvetica et Inter ont les deux jeux.
 */
export const MICRO_LABEL =
  'text-[11px] uppercase font-bold tracking-[0.25em] tabular-nums';

/** Le même cran en dessous — métadonnées de photo, légende de lightbox. */
export const MICRO_LABEL_XS =
  'text-[10px] uppercase font-bold tracking-[0.25em] tabular-nums';

/**
 * ⚠️ À POSER SUR UNE CAPITALE MICRO ALIGNÉE À DROITE (ou centrée sur un bord).
 *
 * `letter-spacing` ajoute son blanc APRÈS chaque lettre, la dernière comprise.
 * Un label aligné à droite se retrouve donc décalé de 0,25 em vers la gauche de
 * son bord — visible dès qu'il doit s'aligner sur autre chose, et c'est le cas
 * de la fiche technique de `/series`, calée sur le bord droit de l'image.
 */
export const MICRO_LABEL_RIGHT_TRIM = { marginRight: '-0.25em' } as const;
