# Page `/series` — spécification de conception

**Date** : 2026-08-20
**Statut** : validé section par section, en attente de relecture avant plan d'implémentation
**Référence visuelle** : [Codrops — Motion Path Transition](https://tympanus.net/Tutorials/MotionPathTransition/) ([source](https://github.com/Ibaliqbal/codrops-motion-path-transition))

---

## 1. Objet et périmètre

Une page publique dédiée aux documents **`series`** de Sanity — les regroupements éditoriaux que le photographe compose à la main dans le Studio.

À ne pas confondre avec les autres pages du site :

| Page | Ce qu'elle montre |
|---|---|
| `/` | La curation (`siteSettings.curation`), sélection ordonnée pour la home |
| `/archives` | Le catalogue complet, groupable par année, lieu, style, boîtier, objectif |
| `/series` | **Les séries éditoriales**, une par document `series` |

Les axes de tri d'`/archives` (style, lieu, année, matériel) ne jouent aucun rôle ici. Une série est un objet éditorial, pas un filtre.

**Hors périmètre, reporté** : les pages indexables par série (`/series/[slug]`). Voir §9.

---

## 2. Séquencement des chantiers

Trois chantiers distincts ont émergé de la conception. Ils sont traités séparément pour qu'un échec dans l'un n'entraîne pas les autres.

| Ordre | Chantier | Statut |
|---|---|---|
| **B** | Module de navigation partagé (`lib/site/nav.ts`) | ✅ Fait le 2026-08-20 |
| **A** | Page `/series` | Ce document |
| **C** | Réorganisation éditoriale (Socials, About/AAXLO, `/about/digital-agency`) | À cadrer séparément |

**Décision de séquencement clé** : l'étape A ajoute `Series` au menu **et retire `Digital Agency` dans le même geste** (la page reste en ligne à son adresse actuelle, elle sort seulement de la navigation). Le menu passe donc de 5 entrées à 5 entrées, jamais 6.

Raison : `NAV_LINKS` est l'état d'arrivée du morph du hero de la home (CLAUDE.md §3.6), sous-système ayant déjà coûté trois bugs documentés. Passer à 6 puis revenir à 5 signifierait toucher deux fois à sa géométrie. Après toute modification de cette liste : **revérifier l'atterrissage du hero sur `/`, en chargement à froid ET au rechargement**.

Menu final : About · Series · Archives · Contact · Socials.

---

## 3. Données

Une seule requête GROQ au build (site en `output: 'export'`, données figées).

Pour chaque série : `title`, `slug`, `subtitle`, `year`, et ses photos ordonnées avec `image` (+ `alt`, dimensions), `year`, `location`, `camera->title`, `lens->title`.

**Règles :**

- **Cover** : `coverPhoto` si défini, **repli sur la première photo de la série** sinon. Le repli n'est pas théorique — une série créée via l'action « Ajouter à une série » n'a que titre + slug.
- **Ordre des séries** *(révisé le 2026-08-21)* : `siteSettings.seriesOrder`, tableau ordonné de références au glisser-déposer — 1ʳᵉ du tableau = 1ʳᵉ pile à gauche de la rangée. Repli pour les séries absentes du tableau : `order` croissant puis `title` (le champ numérique `order` ne sert plus qu'à ça). Même sémantique de clé de tri que `photoOrder` (§11), via la même fonction `applyOrder`.
- **Ordre des photos DANS une série** *(ajouté le 2026-08-20, voir §11)* : `series.photoOrder`, tableau ordonné de références, glisser-déposer dans le Studio. Repli quand il est vide ou incomplet : l'ordre du catalogue (année desc, titre asc).
- **Séries vides** : exclues de la page. Elles restent signalées dans les alertes du Tableau de bord Studio — c'est là qu'elles doivent être vues, pas sur le site public.
- **Aucune série** : message sobre, sur le modèle d'`/archives` quand le catalogue est vide.
- **Ancre** : au chargement, `window.location.hash` ouvre le dossier correspondant si le slug existe, sinon est ignoré. L'ancre suit l'ouverture/fermeture → lien partageable. Même mécanisme éprouvé que `#photo-<slug>` sur `/archives`.
- **Images** : trois tailles servies par le CDN Sanity — minuscule (vignettes empilées des dossiers), moyenne (colonne), pleine définition (image centrale seule). Les photos d'une série ne sont chargées **qu'à son ouverture**, jamais au chargement de la page.

---

## 4. Architecture

```
app/(site)/series/page.tsx        Composant serveur : requête, replis, tri, métadonnées

components/series/
  SeriesExperience.tsx            Client. Détient TOUT l'état : série ouverte + photo active.
                                  Synchronise l'ancre et modalHistory.
  desktop/
    FolderRow.tsx                 État fermé : rangée défilable de piles
    FolderStack.tsx               Une pile : vignettes empilées + bouton Open + titre
    OpenSeriesView.tsx            État ouvert : noms | image centrale | colonne de vignettes
    useFolderTimeline.ts          ★ Timeline GSAP MotionPath (construction / reconstruction)
  mobile/
    SeriesMobileList.tsx          Liste verticale
    SeriesMobileRow.tsx           Une rangée : cover à gauche, titre à droite ; Flip au dépliage
    useExpandGesture.ts           ★ Observer : verrouillage d'axe + seuil de sortie
  shared/
    SeriesMeta.tsx                Bloc année / lieu / boîtier / objectif

lib/site/series.ts                Types + fonctions pures (repli de cover, tri, parsing d'ancre).
                                  Aucune dépendance React → réutilisable pour §9.
```

**État lifté au parent**, conformément au contrat de composition de CLAUDE.md §3.4. Les enfants reçoivent des callbacks, ne détiennent rien.

**Cohabitation desktop / mobile** : les deux structures sont rendues côté serveur, le CSS décide laquelle est visible selon le point de rupture, et GSAP n'est attaché qu'à la branche visible. Écarté : la détection de largeur en JavaScript, qui provoque un clignotement ou un décalage d'hydratation puisque le serveur ignore la taille de l'écran. Coût accepté : du balisage en double. Les images étant aux mêmes URL, le navigateur ne les télécharge qu'une fois, et la branche mobile ne charge ses photos qu'au dépliage.

**Les deux branches ne partagent aucun code d'animation** — seulement les données et l'état. C'est la conséquence assumée du choix de deux interactions distinctes (§5 et §6).

`useFolderTimeline` ne connaît ni Sanity ni le routage : elle reçoit des éléments du DOM et des cibles géométriques.

---

## 5. Interaction desktop

### État fermé

Rangée horizontale partant du bas à gauche. Chaque série est une **pile** : ses photos empilées avec un léger décalage et un z-index décroissant (`arr.length - i`), si bien qu'on voit la cover mais qu'on devine l'épaisseur. Bouton « Open » au-dessus, **cover cliquable** au même titre, **titre de la série sous la pile**.

> Révisé le 2026-08-20 : l'épaisseur est désactivée et le titre est passé au-dessus de la pile. Voir **§10**, qui fait foi.

Défilement horizontal : **conteneur nativement défilable** (`overflow-x`). Décision motivée — le trackpad horizontal fonctionne alors nativement (élan, rebond), et surtout le navigateur n'arme son geste de retour qu'une fois la rangée en bout de course. Capter la molette manuellement obligerait à se battre contre ce comportement. Par-dessus seulement : conversion molette verticale → déplacement horizontal, cliquer-glisser, flèches clavier.

### Ouverture

1. Les autres dossiers et les boutons « Open » s'effacent.
2. Les vignettes de la série partent le long d'un **chemin courbe** vers la colonne de droite, en cascade (~20 ms d'écart). Le chemin passe par un point de dépassement avant de se poser (`curviness ≈ 0.45`) — c'est ce dépassement qui donne la sensation de matière plutôt que de translation mécanique.
3. La **cover ne rejoint pas la colonne** : elle file au centre en grandissant.
4. La colonne des noms de séries apparaît à gauche, à la place des dossiers.
5. « Close » se pose au coin haut-gauche de l'image centrale.

Géométrie **mesurée à l'exécution** (`getBoundingClientRect` + viewport), jamais de valeurs en dur.

### Bloc de métadonnées

**Pas de légende centrée sous l'image** comme le « 01 — Some Text » de la démo de référence. Le bloc se colle **en bas à droite de l'image centrale**, aligné sur son bord, avec le même écart entre texte et image que dans la démo.

Contenu : **année, lieu, boîtier, objectif** de la photo affichée. **Les lignes vides sont masquées**, jamais remplacées par un tiret — sur 134 photos, 11 seulement ont un boîtier et un objectif renseignés, un bloc à trous serait la règle plutôt que l'exception.

### Changement de photo (≤ 0,5 s)

Les deux images **se croisent** : celle du centre part vers l'emplacement de la vignette cliquée, la vignette monte au centre, simultanément et en sens inverse. Flou (~6–8 px) et opacité (~0,65) culminent **à mi-parcours**, là où l'œil lit la vitesse ; les deux images arrivent nettes.

### Changement de série

Les vignettes en place **sortent par la droite** pendant que celles de la nouvelle série **arrivent depuis le coin bas-gauche** par le même chemin courbe. L'image centrale bascule sur la nouvelle cover. La colonne des noms reste en place, série active marquée.

Écarté : le repliage complet puis dépliage (≈ 2,5 s d'attente par changement), et la recomposition sur place en fondu (perd le lien spatial avec le dossier).

### Redimensionnement

~~Timeline remise à zéro → remesure → reconstruction → restauration de l'avancement.~~

**Écart d'implémentation (2026-08-20, assumé)** : la stratégie « timeline unique reconstruite » de la démo a été remplacée par des **vols de clones** (`components/series/desktop/animations.ts`). Chaque état (rangée / vue ouverte) est une mise en page CSS ordinaire ; chaque geste clone les images concernées en `position:fixed`, les fait voler des rects mesurés de l'état de départ vers ceux de l'état d'arrivée (rendu invisible pré-paint le temps du vol), puis échange clone → réel à l'atterrissage. Deux raisons : la colonne de droite doit défiler **nativement** à la molette (impossible si ses items sont les éléments transformés d'une timeline pinnée), et le resize se règle tout seul — les états refluent en CSS, il n'y a plus de timeline à reconstruire. Un resize pendant un vol (≤ 0,8 s) est accepté.

### Durées

| Geste | Durée |
|---|---|
| Ouverture / fermeture | **0,8 s** |
| Changement de série | 0,6 s |
| Échange de photos | 0,45 s |

⚠️ **Écart assumé à CLAUDE.md §3.2**, qui plafonne les transitions à 600 ms. L'ouverture du dossier est traitée comme un grand geste, catégorie splash, mais raccourcie depuis les 1,2 s de la démo. Les valeurs définitives, une fois calées à l'écran, **vont dans le brand book** — pas dans CLAUDE.md (méta-règle du préambule).

---

## 6. Interaction mobile

**Deux interactions distinctes, pas une mise en page adaptative.** Sur un écran de téléphone, le dossier qui se déplie coûterait à l'image la place qui lui revient — et la règle numéro un est l'image d'abord.

### Liste au repos

Chaque série est une rangée : **cover à gauche** (moins de la moitié de la largeur utile), **titre + année à droite**.

~~Covers recadrées au carré via le hotspot Sanity → hauteur uniforme → trois à quatre rangées entières visibles.~~ **Révisé le 2026-08-20 à la demande d'Alexandre : covers SANS crop**, ratio natif, largeur commune 42 % — les hauteurs de rangées varient donc, et la garantie « 3-4 dossiers visibles » est abandonnée en connaissance de cause. Titres longs : passage à la ligne avec interligne aéré (1.7).

Dans la bande dépliée : **hauteur commune** (pleine bande) pour toutes les photos — une horizontale déborde de l'écran vers la droite (`snap-start`), une verticale reste centrée. Jamais d'alignement sur une largeur commune.

**Dimensions en fraction de la largeur utile, jamais en pixels fixes** — sinon le nombre de rangées visibles varie d'un iPhone 17 à un pliant. Marges issues de `env(safe-area-inset-*)` (encoche, îlot dynamique, barre de geste).

### Dépliage (~300 ms)

La rangée s'étire à ~75 % de la hauteur d'écran, et la page se recale pour que la rangée occupe le champ de vision. La cover quitte sa position à gauche pour **venir se centrer en grandissant** — animé par **GSAP Flip** (mesure de l'état de départ, changement de mise en page, animation du delta). Aucune coordonnée à la main ; le mouvement reste juste même si la rangée était à moitié défilée au moment du toucher.

À 75 % de hauteur, l'accordéon se comporte de fait comme une **prise de plein écran** — les autres séries ne sont plus qu'un liseré. C'est assumé.

### Contenu déplié

Photo active à pleine hauteur de bande, centrée, **voisines dépassant légèrement** de chaque côté — le débord signale qu'on peut glisser, sans flèche ni texte. Bloc `SeriesMeta` sous la photo active. Parcours horizontal au doigt.

### Gestes

**Verrouillage d'axe** : sur les dix premiers pixels du geste, si le mouvement penche vers l'horizontale, le geste est verrouillé en horizontal **jusqu'au relâchement**. Un balayage en diagonale ne peut donc plus faire sortir du dossier par accident.

**Sortie** : geste vertical franc — ~70 px, ou moins s'il est vif (la **vélocité** compte autant que la distance). Fourni par **GSAP Observer**, déjà présent dans les dépendances.

**Trois portes de sortie, un seul chemin** : bouton retour du téléphone, toucher à l'extérieur, geste vertical franc. Les deux derniers **ne replient pas directement** — ils déclenchent un `history.back()` qui replie via le même gestionnaire, en réutilisant `lib/utils/modalHistory.ts`. Sinon l'entrée d'historique reste orpheline et un appui ultérieur sur retour ne fait rien de visible.

La bande de photos reste **en retrait des bords** : ne jamais confisquer le geste de retour du système.

**Renoncement volontaire** : le geste qui replie **ne poursuit pas** le défilement dans son élan. Rendre la main au navigateur en cours de geste obligerait à simuler l'élan par code, ce qui sonne faux. À réévaluer sur appareil réel, avec mesures.

---

## 7. Accessibilité, cas limites, performance

- **`prefers-reduced-motion`** (obligatoire, CLAUDE.md §4) : chemins courbes, flou et cascades supprimés ; les vignettes prennent leur place directement, l'image change par substitution. Interface entièrement fonctionnelle. `useReducedMotion` existe déjà.
- **Sans JavaScript / pour les robots** : le serveur rend une liste sémantique des séries avec leurs photos en vraies balises image portant leur `alt`. Page consultable sans JS — et matière déjà prête pour §9.
- **Clavier, de bout en bout** : dossiers atteignables au Tab avec contour de focus visible, Entrée ouvre, Échap ferme, flèches dans la colonne. La colonne de noms est une liste de **vrais boutons**, pas des `div` cliquables.
- **Cas vides** : série sans photo exclue · aucune série → message sobre · cover absente → première photo · ancre inconnue → ignorée.
- **Budget d'images par seconde** : mesure pendant l'ouverture et pendant l'échange. Règle CLAUDE.md §3.2 — sous 50 fps sur MacBook Air M1, on simplifie. **Premier candidat au sacrifice : le flou.** À 120 Hz le budget par image tombe à 8 ms, et flouter une grande image coûte cher.
- **Vérification visuelle** : Playwright installé en dépendance de développement, pour piloter le navigateur, capturer des séquences d'images pendant les animations, lire les erreurs de console et mesurer les performances. Pas de tests automatisés — un outil de vérification pendant la construction. Motivé par trois bugs de cette session qu'un typecheck vert laissait passer et qu'un seul clic aurait révélés.

---

## 8. Décisions écartées (et pourquoi)

| Écarté | Raison |
|---|---|
| Index `/series` + page par série pour l'expérience | Un chargement de page interromprait le motion |
| Un seul dossier visible avec flèches | Les autres séries deviennent peu découvrables |
| Repliage complet entre deux séries | ≈ 2,5 s d'attente par changement |
| Recomposition en fondu sans passer par le coin | Perd le lien spatial avec le dossier |
| Lightbox sur l'image centrale | Ferait doublon avec l'image centrale |
| Ouverture en nouvel onglet | Éjecte du décor vers le visualiseur du navigateur ; sert le fichier pleine résolution par défaut, choix à faire sciemment pour des photos protégées |
| Défilement auto piloté par la position du curseur | Scroll détourné, inutilisable au clavier, interdit par CLAUDE.md |
| Mise en page adaptative unique desktop/mobile | Les deux géométries n'ont rien en commun |
| Détection de largeur en JS pour choisir la branche | Clignotement ou décalage d'hydratation |

---

## 9. Reporté : indexation par série

Générer une page statique sobre par série (`/series/boats`, …) : titre, sous-titre en méta-description, photos en vraies balises image avec `alt`, balisage JSON-LD `ImageGallery` (réclamé par CLAUDE.md §5.3). Chacune renverrait vers `/series#<slug>`.

**Pourquoi ça manque** : l'ancre rend le lien partageable mais **n'apporte rien au référencement** — Google ignore le fragment et ne voit qu'une seule page. Or le public visé (galeries, directeurs artistiques, presse) trouve le photographe par recherche.

**Coût estimé faible** : 6 séries, export statique, `generateStaticParams`, composants réutilisés. La liste sémantique rendue côté serveur (§7) fournit déjà la matière.

Décision du 2026-08-20 : livrer d'abord l'expérience. À reproposer lors d'un point d'avancement.

---

## 10. Révision du 2026-08-20 : état fermé remis à plat

Quatre retouches demandées après la livraison. Elles ne changent aucune animation — seulement la géométrie et le rendu de l'état fermé.

### 10.1 Deux lignes de libellé, puis l'image

L'ordre est maintenant **« Open ↗ » → titre de la série (+ compteur) → pile**. Le titre est donc lu avant l'image, dans le sens de lecture, et les deux lignes de texte forment un bloc compact (2 px entre elles, 6 px avant le bord haut de la cover — moitié des valeurs de la première passe) au lieu d'encadrer la photo.

Le préfixe `+` devient une **flèche diagonale bas-gauche → haut-droit**, placée en **suffixe** du mot, en SVG inline dimensionné en `em` (`0.85em`) : elle suit le `font-size` du libellé quoi qu'il arrive. Dimension posée en **CSS**, pas en attribut SVG — un `width="0.85em"` n'est pas fiable (même famille de piège que le `height="auto"` du `GlyphLogo`, CLAUDE.md §3.6).

### 10.2 Effet « pile désordonnée » : désactivé, pas supprimé

L'épaisseur venait de deux valeurs calculées par index dans `FolderStack.tsx` :

```ts
const angle = i === 0 ? 0 : ((i % 3) - 1) * 1.6;  // −1,6° / 0° / +1,6°, cover droite
const shift = Math.min(i, 4) * 2;                 // 2 px par photo, plafonné à 8
// appliqué en transform : translate(shift, −shift) rotate(angle)
```

Elles sont conservées, sous le drapeau **`PILE_DISORDER`** (constante en tête de fichier). `false` → toutes les images à `translate(0,0) rotate(0)`, seule la cover est visible. **Repasser à `true` restaure l'effet à l'identique**, aucune autre modification n'est nécessaire.

Deux points à ne pas défaire :

1. **Les décalages sont déterministes, jamais aléatoires.** Un `Math.random()` produirait un rendu serveur différent du rendu client → erreur d'hydratation React.
2. **Les sous-images restent montées même à `false`.** Elles portent `data-pile-item` et sont les rects SOURCE des vols d'ouverture ; chaque vol a besoin de SA source, puisque le fantôme copie la `src` de l'élément. Les retirer du DOM réduirait l'ouverture au seul vol de la cover — c'est un piège, pas une optimisation. À `false` elles sont simplement empilées pile sous la cover, invisibles, et servent aussi de préchargement.

Variantes envisageables si l'effet revient un jour : décalage vers le bas plutôt que vers le haut (lit « pile posée » au lieu de « éventail »), ou rotation seule sans translation (plus sobre, l'épaisseur ne se lit qu'aux coins).

### 10.3 Gouttières égales à gauche et en bas de l'ÉCRAN

Référence : les **32 px** entre le bord gauche de l'écran et la première pile (`paddingLeft` de la rangée). Le bas de l'écran doit valoir la même chose.

**Le footer n'entre pas dans ce calcul** — c'est la différence avec les pages courtes. Sur `/series` il se pose **juste sous l'horizon**, à révéler d'un coup de molette : le grand blanc des trois quarts hauts est le sujet de la page, y faire tenir une bande sombre l'aplatirait. La règle §7.6 reste satisfaite (le footer est bien en fin de contenu) ; la page est simplement plus haute que l'écran de sa propre hauteur.

La chaîne de hauteurs, dont les valeurs doivent bouger **ensemble** :

| Élément | Valeur |
|---|---|
| nav-bar fixe | 64 |
| `MainPadding` haut | 64 |
| `MainPadding` bas — **/series uniquement** | 32 (au lieu de 64) |
| → hauteur de scène (`DesktopSeries`) | `calc(100dvh - 160px)` |
| → paddingTop de la vue ouverte | 24 |
| → chrome de l'image centrale (Close 32 + méta 72) | 104 |
| → `CENTER_MAX_H` (`OpenSeriesView`) | `calc(100dvh - 288px)` |

Vérifié à la mesure, viewport 1440 × 900 : première pile à x = 32 et bas de pile à y = 868 (32 px du bas de l'écran) ; bloc de métadonnées de la vue ouverte à 868 également ; haut du footer à exactement 900.

La réserve de méta est passée de 84 à 72 le 2026-08-24 : l'interligne du bloc est tombé de 18 à 15 px (`META_LINE_PX`, `SeriesMeta.tsx`), et `CHROME_BOTTOM` comme `CENTER_MAX_H` sont désormais **calculés** à partir de cette constante — la chaîne ne peut plus dériver d'un côté sans l'autre.

Le `paddingBottom` de 32 px sur `/series` est un écart assumé à la règle éditoriale des 64 px (brand book §6.6) : cette page joue l'équilibre de ses quatre marges, pas le rythme vertical d'une page de texte.

⚠️ **Piège payé ici** : le chrome ancré à l'image (« ✕ Close » au-dessus, métadonnées en dessous) est en `absolute`, donc hors flux. La place qu'on ne lui réserve pas, il la prend **hors de la scène, silencieusement** — les métadonnées sont d'abord revenues coupées par le footer. La place est désormais réservée en `padding` sur la cellule centrale, et `data-open-center` a été descendu sur la boîte de **contenu** : c'est le rect que `runSwap` utilise pour prédire la position de l'image entrante ; le laisser sur la cellule paddée aurait décalé la prédiction de la moitié de l'asymétrie du chrome, soit un saut visible au raccord clone → réel.

### 10.4 Footer

Voir CLAUDE.md §7.6 — la règle « footer collé en bas » est globale au site. Elle décrit **où le footer se pose quand la page est courte** ; elle n'impose pas qu'il soit visible. Sur les pages courtes (contact, socials, mentions légales) il remonte au bas de l'écran ; sur `/series`, dont la scène occupe déjà toute la hauteur visible, il reste juste en dessous.

---

## 11. Ordre des photos dans une série (2026-08-20)

Le tri automatique `année desc, titre asc` était le seul ordre possible. L'éditeur voulait pouvoir composer l'enchaînement lui-même — c'est un objet éditorial, pas un catalogue.

### 11.1 Ce qui a été écarté

**Renverser le modèle** : `series.photos[]` porte l'appartenance, `photo.series` disparaît. Une seule liste, ordre natif, aucune ambiguïté conceptuelle. Écarté pour la surface : l'action document « Ajouter à une série », le structure builder (Par série / Sans série), les alertes du Dashboard, `upload-photos --auto-series`, `assign-series-by-location` et `audit-photos-without-series` lisent tous `photo.series`. Beaucoup de risque pour un besoin de tri.

**Un champ `orderInSeries` numérique sur la photo** : trivial à écrire, pénible à vivre — renuméroter onze photos à la main, sans glisser-déposer. Même odeur que le champ `order` retiré de `photo` lors du passage à `siteSettings.curation`.

### 11.2 Ce qui a été fait

`series.photoOrder` : tableau ordonné de références vers `photo`, glisser-déposer, `Rule.unique()`. Le sélecteur est **filtré aux seules photos de la série** (`options.filter` → `series._ref == $seriesId`, préfixe `drafts.` strippé puisque les photos référencent l'id publié) : impossible d'y glisser une photo étrangère.

**`photoOrder` est une clé de tri, pas une liste d'appartenance.** L'appartenance reste `photo.series`, seule et unique — la règle de CLAUDE.md §11.12 tient. Ce qui rend la distinction vivable est le croisement à la lecture, dans `applyPhotoOrder` (`lib/site/series.ts`) :

| Situation | Résultat |
|---|---|
| Tableau absent ou vide | Ordre du catalogue (année desc, titre asc) |
| Photo listée, toujours dans la série | À sa place |
| Photo listée qui a quitté la série | Ignorée |
| Doublon dans le tableau | Une seule occurrence |
| Photo de la série absente du tableau | **Ajoutée à la fin** |
| Photo listée mais sans asset image | Écartée, sans laisser de trou |

Conséquence recherchée : le tableau peut être vide, partiel ou périmé sans jamais fausser l'affichage. **Rien à resynchroniser** après un import ou un rattachement en masse — écrire un tel code de maintenance serait précisément l'erreur (§11.12).

Une photo fraîchement rattachée arrive donc **en dernier**, jamais en tête : l'ordre déjà composé ne bouge pas tout seul, et l'éditeur remonte la nouvelle quand il le décide.

**Effet de bord voulu** : la cover de repli (quand `coverPhoto` est vide) devient la première photo de l'ordre, et non plus la plus récente par accident.

**Pourquoi le tri n'est pas fait en GROQ** : GROQ ne sait pas ordonner un jeu de documents selon la position d'une référence dans un tableau. La requête ramène le tableau brut (`"photoOrderRefs": photoOrder[]._ref`) et les photos dans l'ordre de repli ; le croisement se fait côté lecture, dans une fonction pure — donc vérifiable seule, et réutilisable telle quelle pour les pages `/series/[slug]` (§9).

Vérifié sur les neuf cas du tableau ci-dessus.
