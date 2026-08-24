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
 * ══ ÉCHELLE ÉDITORIALE — trois voix de corps, trois crans de titre.
 *
 * **L'état dont ce bloc sort** (refonte du 2026-08-24, demande Alexandre).
 * Les pages textuelles étaient composées en « bold minimalism » : un seul
 * grotesque, corps d'affiche, GRAISSE UNIQUE (700 partout — corps, H2, H3,
 * H4), hiérarchie portée par la seule taille. Quatre conséquences mesurées :
 *
 * 1. La page n'avait qu'une voix, jouée plus ou moins fort. H3 (40) et H4 (36)
 *    tenaient à 11 % l'un de l'autre : deux niveaux déclarés, un seul lu.
 * 2. Le corps à 28 px n'est pas un corps de lecture, c'est un corps de CHAPÔ.
 * 3. Rien n'existait SOUS le paragraphe — « Usual response time: 48 to 72
 *    hours » se lisait au volume exact de la bio.
 * 4. L'emphase était morte. L'italique étant interdit (brand book §5.2), `em`
 *    est remappé sur `font-bold` — sur un texte déjà en 700. Tout le balisage
 *    posé dans le Studio ne produisait rien à l'écran.
 *
 * Le brand book §5.3 prescrivait DÉJÀ un corps courant en 500 et le 700
 * réservé au chapô. Le code ne l'avait jamais implémenté ; c'est cette règle
 * qui descend enfin dans le site.
 *
 * **Les trois voix de corps** :
 *
 *   CHAPÔ    28 / 21   700   pleine colonne (1107)   le bloc d'entrée
 *   COURANT  20 / 17   500   mesure (680)            ce qui se lit
 *   ANNEXE   17 / 15   500   mesure (680)            le pratique, le listé
 *
 * ⚠️ Le contraste chapô → courant vient de DEUX leviers, pas d'un : 40 %
 * d'écart de taille en desktop, mais seulement 24 % en mobile (21 → 17) — le
 * passage 700 → 500 porte le reste. Descendre le chapô sans garder l'écart de
 * graisse écraserait la hiérarchie sur téléphone, là où elle tient déjà au
 * plus juste.
 *
 * ⚠️ La MESURE est cousue dans le courant et l'annexe, pas posée par la page :
 * cf. `--editorial-measure` (app/globals.css) pour le raisonnement complet.
 * Le chapô et les titres en sont volontairement exempts.
 */

/**
 * CHAPÔ — le premier paragraphe d'une page éditoriale, et lui seul.
 *
 * ⚠️ **Personne ne le choisit : il est POSITIONNEL.** `PortableBody` promeut
 * le bloc d'index 0 (s'il est un paragraphe) en chapô ; le Studio n'a pas de
 * bouton pour ça. C'est un arbitrage assumé (Alexandre, 2026-08-24) : l'effet
 * d'entrée de page est gratuit et systématique, aucune page ne peut s'ouvrir
 * en l'oubliant. Coût du choix : l'éditeur du Studio ne peut pas le montrer
 * (`BlockStyleProps` n'expose pas l'index du bloc), d'où le rappel écrit dans
 * la description du champ — cf. `editorialBodyDescription`.
 *
 * Reprend EXACTEMENT l'ancien corps de texte (28/19 → 28/21, `leading-1.34`,
 * `-0.02em`) : ce n'est pas un réglage neuf, c'est l'ancien réglage rendu à
 * son vrai métier. Il n'a jamais été mauvais — il était juste appliqué à toute
 * la page au lieu de son premier paragraphe.
 */
export const EDITORIAL_LEAD =
  'font-sans text-[21px] md:text-[28px] font-bold tracking-[-0.02em] leading-[1.34] text-[var(--color-fg)]';

/**
 * CORPS COURANT — tout ce qui suit le chapô. C'est le texte qu'on LIT.
 *
 * 20 px / 500 / interligne 1,55, borné à la mesure. Trois changements par
 * rapport à l'ancien corps, et ils ne se séparent pas :
 *
 * - **500 et non 700.** C'est le levier principal. Un mur de gras n'a pas de
 *   relief : ni l'emphase, ni les titres, ni le chapô ne pouvaient s'en
 *   détacher. À 500, `em` et `strong` (remappés sur 700, §5.2) redeviennent
 *   visibles pour la première fois — le balisage déjà présent dans le contenu
 *   publié se met à servir sans qu'une ligne de contenu bouge.
 * - **`tracking-normal` et non `-0.02em`.** Le resserrement est un réglage de
 *   GRAND corps (brand book §5.4 : -0,02 em à 24 px et au-dessus, 0 en dessous).
 *   Le garder à 20 px en graisse 500 refermerait les contreformes d'Inter, qui
 *   sont déjà plus étroites qu'en 700.
 * - **La mesure.** Non négociable : cf. `--editorial-measure`. À 1107 px, un
 *   corps de 20 donne ~110 signes par ligne — la page serait devenue MOINS
 *   lisible qu'à 28.
 *
 * ⚠️ `font-sans` en tête : depuis le passage à deux familles (2026-08-22),
 * Helvetica est la fonte par défaut du site et Inter n'est PLUS héritée.
 * Les trois constantes de corps ci-dessus sont la SEULE frontière entre les
 * deux — ce sont elles qui rebasculent le texte sur Inter. La retirer ferait
 * glisser toutes les pages éditoriales en Helvetica sans autre signal. Les
 * TITRES (`EDITORIAL_H2/H3/H4`) ne la portent pas, exprès : ils doivent rester
 * en Helvetica (§5.1).
 */
export const EDITORIAL_BODY =
  'font-sans max-w-[var(--editorial-measure)] text-[17px] md:text-[20px] font-medium tracking-normal leading-[1.55] text-[var(--color-fg)]';

/**
 * ANNEXE — le registre pratique : délai de réponse, listes de matériel,
 * mentions, précisions. Ce qui accompagne le texte sans se lire au même
 * volume que lui.
 *
 * C'est le seul des trois que l'ÉDITEUR déclare, via le style « Annexe » du
 * Studio (`annex`). Il existe parce qu'il manquait : avant lui, « Studio in
 * Villejuif, travel across France and worldwide » pesait autant que la bio.
 *
 * 17 / 15 — un cran sous le courant (15 % d'écart), même graisse. L'écart est
 * volontairement PLUS FAIBLE que celui du chapô : l'annexe est un registre
 * mineur, pas un contraste. Ce qui la distingue au premier coup d'œil, c'est
 * qu'elle arrive en blocs courts et listés, pas sa seule taille.
 */
export const EDITORIAL_ANNEX =
  'font-sans max-w-[var(--editorial-measure)] text-[15px] md:text-[17px] font-medium tracking-normal leading-[1.5] text-[var(--color-fg)]';

/**
 * TITRE DE SECTION (H2) — la dalle en capitales : « GEAR », « YOUR RIGHTS ».
 *
 * Inchangé (36/48, 700, capitales, -0,02 em, interligne 0,9) : c'est le seul
 * niveau que la refonte ne touche pas. Il fonctionnait, et il est ce qui reste
 * du registre d'affiche à l'intérieur du corps de page.
 *
 * ⚠️ Pas de `font-sans` — Helvetica, comme tous les titres (§5.1). Et pleine
 * colonne : pas de `max-w`, la dalle déborde la mesure jusqu'aux 1107.
 *
 * Extrait ici le 2026-08-24 : cette chaîne était recopiée à la main dans
 * `PortableBody`, `/legal` (×4) et `/privacy` (×2) — sept exemplaires à tenir
 * synchrones, exactement le motif que §7.5 interdit.
 */
export const EDITORIAL_H2 =
  'text-[36px] md:text-[48px] font-bold uppercase tracking-[-0.02em] leading-[0.9] text-[var(--color-fg)]';

/**
 * SOUS-TITRE (H3) — le nom qui coiffe un bloc : « Olympus OM-D EM-10 mkIII ».
 *
 * Descendu de 40/28 à 24/19. L'ancien H3 était plus gros que le corps d'alors
 * (40 contre 28) ; face à un courant de 20, il aurait pesé le double et coupé
 * la page en tranches. À 24 il reste au-dessus du courant (+20 %, le seuil de
 * hiérarchie lisible) tout en passant SOUS le chapô — l'ordre des voix est
 * ainsi le même en lecture qu'en structure.
 */
export const EDITORIAL_H3 =
  'text-[19px] md:text-[24px] font-bold tracking-[-0.02em] leading-[1.25] text-[var(--color-fg)]';

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
 * TITRE DE RANG 4 (H4) — le quatrième cran de l'échelle éditoriale. Il vit
 * ici, et pas avec ses trois frères plus haut, parce qu'il n'est plus un titre
 * dimensionné : c'est l'ÉTIQUETTE du site, `MICRO_LABEL`.
 *
 * **La chute est violente et elle est voulue : 36 px → 11 px** (2026-08-24).
 * L'ancien H4 était à 11 % de l'ancien H3 (36 contre 40) — deux niveaux
 * déclarés dans le Studio, un seul lisible à l'écran, donc un cran de
 * hiérarchie qui n'existait que sur le papier. Le poser sur le registre
 * d'étiquette règle les deux problèmes d'un coup : il devient un vrai
 * quatrième cran (24 → 11, aucune confusion possible), et il raccroche les
 * pages textuelles à la couche de libellés qui court déjà partout ailleurs —
 * métadonnées photo, compteurs d'`/archives`, légendes de lightbox.
 *
 * Risque de régression nul au moment du changement : le contenu publié
 * n'utilisait que H2 et H3, aucun H4 n'était en base.
 *
 * ⚠️ `cn()` et pas une concaténation : `MICRO_LABEL` ne déclare pas de
 * couleur, on la lui ajoute — mais le jour où il en porterait une, seule la
 * fusion Tailwind éviterait que les deux `text-*` se disputent l'ordre du CSS
 * généré. Et il est déclaré APRÈS `MICRO_LABEL` par nécessité : un `const`
 * lu avant son initialisation lèverait une erreur au chargement du module.
 */
export const EDITORIAL_H4 = cn(MICRO_LABEL, 'text-[var(--color-fg)]');

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

/**
 * ÉCART D'UNE BANDE DE COMMANDES — quand une page ne s'ouvre pas sur du texte
 * mais sur un TABLEAU DE CONTRÔLE (la console de `/archives`, et toute page
 * future qui en aurait un), c'est cette mesure qui remplace `PAGE_TITLE_GAP`,
 * et elle se pose des DEUX CÔTÉS de la bande : au-dessus (titre → commandes)
 * et en dessous (commandes → corps).
 *
 * **Pourquoi une mesure à part** (demande Alexandre, 2026-08-24, sur capture
 * du mobile d'`/archives`). La console entrait par la porte `children` de
 * `PageShell`, donc elle héritait des 96 px prévus pour séparer un titre d'une
 * colonne de texte — et sous elle il ne restait que les 40 px du `paddingTop`
 * de la grille. Mesuré : **96 au-dessus, 40 en dessous**, un rapport de 2,4
 * contre 1. L'œil n'y lisait pas une bande posée entre le titre et la galerie
 * mais une bande accrochée à la galerie, larguée après un grand blanc qui
 * n'appartenait à personne. Un intervalle qui porte un OBJET ne se mesure pas
 * comme un intervalle vide : il se partage.
 *
 * 48 et pas 96 : la bande est un aplat lourd (plaque pleine largeur en
 * desktop, deux modules empilés en mobile), elle n'a pas besoin de l'air qu'on
 * donne à une colonne de texte. Une seule valeur pour les deux largeurs, comme
 * les trois autres mesures du cadre — le desktop suit (arbitrage Alexandre).
 *
 * ⚠️ **Deux consommateurs, et ils vont ENSEMBLE** : `PageShell` pose l'écart
 * du dessus, `FlatGallery` celui du dessous (l'écart y sépare deux éléments
 * INTERNES à la galerie — la console et la première grille — là où PageShell
 * ne voit qu'un seul enfant). C'est le même nombre exprès : le régler d'un
 * seul côté rejouerait exactement l'asymétrie qu'il corrige.
 */
export const PAGE_CONTROLS_GAP = 48;
