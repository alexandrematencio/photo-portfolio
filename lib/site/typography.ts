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
 * **AUCUN INTERLETTRAGE POSITIF. La question est tranchée, ne pas la rouvrir.**
 *
 * Le brand book prescrivait `+0.25em` à 11 px (§5.3 / §5.4) ; le code, lui, ne
 * le portait NULLE PART. Ce n'était pas un oubli : c'est Alexandre qui l'avait
 * retiré de toute la couche des étiquettes dans `b3d8cef`, puis qui avait
 * descendu le dernier survivant de 0,15 à 0,05 em dans `c7f5cc5`. Le seul
 * interlettrage positif encore vivant sur le site est ce `0.05em` du numéro de
 * bloc de la home (`PhotoBlock`), et c'est le plafond.
 *
 * Réappliqué ici le 2026-08-23 en suivant le brand book plutôt que le code,
 * puis retiré le jour même sur rappel d'Alexandre. Le brand book a été corrigé
 * dans la foulée — si tu lis un jour `+0.25em` quelque part, c'est le document
 * qui a régressé, pas le code.
 *
 * **Ce que la constante sert encore** : la même étiquette était écrite à la
 * main partout (11 px, capitales, gras) avec les dérives que ça suppose, et
 * aucune ne portait de chiffres tabulaires — or ces libellés sont pleins de
 * nombres qui changent EN PLACE : compteurs `(54)`, années, ouvertures,
 * focales. En chiffres proportionnels, une colonne de métadonnées frémit d'un
 * chiffre à l'autre. C'est gratuit : Helvetica et Inter ont les deux jeux.
 *
 * ⚠️ Réservé aux ÉTIQUETTES (on les lit, on ne les clique pas). Les COMMANDES —
 * onglets, pastilles de filtre, boutons de densité, noms de série cliquables —
 * gardent leur `tracking-[-0.02em]` propre.
 */
export const MICRO_LABEL = 'text-[11px] uppercase font-bold tabular-nums';

/** Le même cran en dessous — métadonnées de photo, légende de lightbox. */
export const MICRO_LABEL_XS = 'text-[10px] uppercase font-bold tabular-nums';

/**
 * ══ CADRE DE PAGE — les trois mesures qui font qu'une page ressemble à la
 * suivante. Homogénéisation du 2026-08-24 (demande Alexandre) : avant elle,
 * six pages éditoriales portaient la même chaîne de classes de H1 RECOPIÉE à
 * la main, chacune son `paddingLeft: 32` inline, et trois écarts titre → corps
 * différents selon la page (48 en mobile, 72 en desktop, 96 sur /series).
 *
 * ⚠️ Les VALEURS de gouttière et de corps de titre sont posées en CSS, dans
 * `app/globals.css` (tokens `--page-gutter` / `--page-title-size`), parce
 * qu'elles sont RESPONSIVES : un style inline échappe au reset
 * `* { padding: 0 }` mais ne connaît pas les media queries, et une utility
 * Tailwind connaît les media queries mais se fait avaler par le reset
 * (CLAUDE.md §7.6 / §7.7). Ces tokens sont LUS EN STYLE INLINE par
 * `PageShell` / `PageTitle` (components/site/PageShell.tsx) — il n'y a pas de
 * règle CSS qui les applique à un sélecteur : un composant qui veut le cadre
 * passe par PageShell, ou écrit lui-même `var(--page-…)` dans un style
 * inline. Les constantes ci-dessous ne sont donc PAS la source de vérité de
 * ces deux-là : elles n'existent que pour le code qui a besoin du NOMBRE
 * (mesures, animations). Le commentaire du bloc CSS porte le raisonnement
 * complet.
 */

/** Gouttière latérale de page, sous `md`. Reprise de `/series` — c'est la
 *  seule page dont la mesure de téléphone avait été dessinée. */
export const PAGE_GUTTER = 20;

/** La même au-dessus de `md`, où toutes les pages étaient déjà d'accord.
 *  Consommée par la grille de la vue ouverte de `/series` (`OPEN_GAP`,
 *  OpenSeriesView), qui est cette gouttière-là — la branche desktop n'existe
 *  qu'au-dessus de `md`. */
export const PAGE_GUTTER_MD = 32;

/**
 * TITRE DE PAGE — le H1 en gros lettrage, identique sur toutes les pages.
 *
 * ⚠️ La TAILLE n'est PAS dans cette chaîne : c'est `PageTitle`
 * (components/site/PageShell.tsx) qui la pose, en style inline —
 * `fontSize: 'var(--page-title-size)'`, le token de globals.css qui vaut
 * 96 px au-dessus de `md` et, en dessous, le plus grand corps auquel le mot
 * le plus long du site tient encore. Un `<h1 className={PAGE_TITLE}>` écrit à
 * la main est donc un titre à la taille HÉRITÉE, sans le moindre signal —
 * c'est exactement l'accident que `/archives` portait avant l'homogénéisation.
 * Toujours passer par `<PageShell>` / `<PageTitle>`.
 *
 * `tracking-normal` et non plus `-0.04em` : le site n'a plus AUCUN
 * interlettrage de titre (demande Alexandre, 2026-08-24). Le mobile de
 * `/series` en portait un visible — c'est ce qui a déclenché le chantier.
 */
export const PAGE_TITLE =
  'font-black uppercase tracking-normal leading-none text-[var(--color-fg)]';

/**
 * Corps du titre au-dessus de `md`. Exporté parce qu'une AUTRE page en dépend :
 * le lettrage « SERIES » de `/series` se réduit exactement à cette taille quand
 * une série s'ouvre (CLAUDE.md §3.7). Le rapport d'échelle n'est donc pas
 * transcrit à la main — il se déduit de ce nombre. Changer 96 ici change les
 * deux pages ensemble, ce qui est le but ; le réécrire en dur là-bas les
 * laisserait diverger sans le moindre signal.
 *
 * ⚠️ Doit rester égal au `--page-title-size` de la media query `md` dans
 * `globals.css` — duplication irréductible, comme celle des gouttières
 * ci-dessus : le CSS ne peut pas lire une constante TypeScript, et une
 * animation GSAP ne peut pas attendre une media query. Rien d'AUTRE ne se
 * duplique : le plafond fluide sous `md` (68 px), lui, n'existe QUE dans
 * globals.css — il avait un jumeau TypeScript ici, sans consommateur, retiré
 * le 2026-08-24 (une constante que rien ne lit ne fait que dériver).
 */
export const PAGE_TITLE_SIZE_MD = 96;

/**
 * ÉCART TITRE → CORPS, une seule valeur pour toutes les pages et les deux
 * largeurs. Posé en `gap` sur la colonne de page (un `gap` échappe au reset,
 * contrairement à un padding — c'est pour ça qu'il est utilisable en inline).
 *
 * Il se mesure de BOÎTE à BOÎTE, comme partout ailleurs sur le site : sous un
 * titre en `leading-none`, l'espace vu est un peu plus grand que 96 (la boîte
 * de ligne descend sous la capitale). L'important est que ce soit le même
 * décalage sur les sept pages — ce qui n'était pas le cas quand `/series`
 * mesurait, lui, depuis le bas des glyphes.
 */
export const PAGE_TITLE_GAP = 96;
