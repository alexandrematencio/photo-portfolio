# Protection des photographies en ligne — audit et recommandations

> Audit du 2026-09-11, sur le site en ligne (`alexandrematencio.github.io/photo-portfolio`),
> le dataset Sanity `production` et le code du dépôt. Toutes les mesures ci-dessous ont été
> faites, pas déduites. Le plan d'exécution qui en découle :
> `docs/superpowers/plans/2026-09-11-protection-images.md`.

## 1. Ce qu'il faut accepter avant de commencer

Une image affichée dans un navigateur est une image déjà livrée. Aucun dispositif ne peut
empêcher une capture d'écran, et tout ce qui bloque le clic droit se contourne en deux
secondes. La protection d'un portfolio ne consiste donc pas à empêcher la copie : elle
consiste à **rendre la copie inutile commercialement, prouver l'auteur, et rendre le
vol coûteux**. Trois leviers, dans cet ordre d'efficacité :

1. **La résolution servie.** C'est le seul levier qui survit à tout. Une image de 2048 px
   remplit n'importe quel écran mais ne fait qu'un tirage de 17 × 11 cm à 300 dpi. Une
   image de 6000 px se vend en affiche.
2. **La provenance lisible par les machines.** Google Images affiche un badge
   « Licensable » et un crédit d'auteur quand la page déclare l'auteur, la licence et la
   page de contact en données structurées. C'est ce qui fait qu'une image trouvée par
   recherche inversée mène à Alexandre, pas à celui qui l'a repostée. C'est aussi ce que
   les tribunaux regardent : un avis de copyright visible et daté.
3. **La preuve et la riposte.** Les fichiers RAW et le catalogue Lightroom sont la preuve
   d'antériorité. Une surveillance par recherche inversée (Pixsy, gratuite jusqu'à
   500 images) détecte les réutilisations. La loi française fait le reste : la notification
   LCEN à l'hébergeur d'un site fautif oblige au retrait.

Deux idées reçues à écarter, franchement :

- **Le filigrane visible.** Il survit à la capture d'écran, c'est son seul mérite. Il se
  retire aujourd'hui en un clic avec n'importe quel outil d'IA générative, il dégrade la
  lecture de chaque photo, et il contredit la promesse du site (« l'image d'abord », brand
  book). Pour un portfolio d'auteur qui cherche galeries et directeurs artistiques, il
  coûte plus qu'il ne rapporte. **Recommandation : non.** Si Alexandre y tient malgré
  tout, la seule version défendable est une signature discrète en bord de cadre sur
  la lightbox uniquement, jamais sur les grilles.
- **La signature dans les métadonnées du fichier.** C'est le sujet qu'Alexandre soulève
  (Lightroom n'a pas écrit son nom dans beaucoup de fichiers). La réponse est plus
  brutale qu'on ne le voudrait : **sur ce site, aucune métadonnée n'atteint le
  visiteur**, quel que soit le fichier déposé. Le CDN de Sanity ré-encode tout ce qu'il
  sert, y compris à l'URL dite « originale », et vide EXIF, IPTC, XMP et profil ICC
  (mesuré ci-dessous). Instagram, Facebook, X et la plupart des plateformes font pareil.
  Les métadonnées restent utiles **dans les masters et les exports qu'il envoie à des
  tiers** (presse, clients, concours), et comme filet si l'hébergement change un jour.
  Elles ne protègent pas le site. Ce qui joue ce rôle sur le web, ce sont les données
  structurées de la page, que Google lit à la place de l'IPTC.

## 2. État mesuré

### 2.1 Les assets dans Sanity

| Mesure | Valeur |
|---|---|
| Assets image dans le dataset | 296, soit 1,70 Go |
| Documents `photo` | 227 (12 masquées) |
| Assets référencés par une photo | 227, soit 1,31 Go |
| … dont au-dessus du plafond de 2048 px | **121** |
| Assets au-dessus de 4000 px (tous confondus) | 139 ; le plus large fait **6356 px** |
| Assets orphelins (plus référencés par aucune photo) | 69 |
| Assets avec un EXIF stocké côté Sanity | 0 |
| Image « reveal » du hero | 3122 px, 2,9 Mo |

Le plafond de 2048 px décidé le 2026-08-21 (`scripts/prepare-image.ts`) ne s'applique
qu'aux imports passés par le script depuis cette date. Plus de la moitié du catalogue en
ligne est stockée en pleine résolution.

### 2.2 Ce que le CDN sert

- **L'original pleine résolution est joignable en un geste.** Le HTML du site ne contient
  aucune URL non transformée (vérifié : 0 sur 326 URL d'images, plus grande largeur
  demandée 1600 px dans le HTML, 2048 px dans la lightbox). Mais l'identifiant d'asset
  est dans la page, et retirer `?w=` de n'importe quelle URL rend le fichier stocké :
  4608 × 3072 px pour la photo testée. Les plafonds d'URL côté code ne ferment rien tant
  que l'asset stocké est grand. **Seule la réduction de l'asset stocké ferme ce trou.**
- **Aucune métadonnée ne survit.** Sur cinq fichiers servis (les plus lourds et les
  plus anciens), 0 octet d'EXIF, 0 XMP, 0 IPTC, 0 ICC, à l'URL originale comme aux URL
  transformées. Le fichier stocké de 19,7 Mo est servi en 4,7 Mo : le CDN ré-encode.
- **Le CDN de Sanity ne connaît ni restriction de referer ni signature d'URL** sur ce
  type de plan. Le hotlinking ne peut pas être bloqué. GitHub Pages n'accepte aucun
  en-tête HTTP non plus (`X-Robots-Tag`, `Content-Disposition`, CORS : impossibles).

### 2.3 Ce que le site déclare

- **Aucune donnée structurée.** Pas de `ImageObject`, pas de `Person`, pas de
  `copyrightNotice`, `creditText`, `license` ni `acquireLicensePage`. Google Images n'a
  aucun moyen d'attribuer les images à Alexandre ni d'afficher le badge Licensable.
- **Aucune politique envers les robots d'IA.** `robots.txt` autorise tout. Aucun
  `tdmrep.json` (le protocole européen d'opposition à la fouille de textes et de données,
  directive DSM art. 4), aucun `<meta name="robots" content="noai">`.
- **`robots.txt` n'est de toute façon pas lu.** Les robots ne lisent que
  `https://alexandrematencio.github.io/robots.txt`, qui répond 404. Le fichier du site
  vit sous `/photo-portfolio/robots.txt`, une adresse qu'aucun robot ne consulte. Tant
  que le site est sous ce chemin, `robots.txt` et `tdmrep.json` sont inertes ; seules les
  balises `<meta>` de chaque page agissent. Le jour du domaine propre, les deux fichiers
  prennent effet sans rien changer au code.
- **Mentions légales : brouillon, et fausses.** La page `/legal` se déclare
  « Placeholder », l'hébergeur indiqué est Vercel alors que le site est sur GitHub Pages,
  l'éditeur est entre crochets, et l'avis de propriété intellectuelle ne nomme personne.
  Le pied de page dit « ©2026 / All Right Reserved » sans titulaire (et avec une faute).
  Un avis de copyright sans nom ni titulaire est un avis faible devant un tribunal.
- **L'image de partage (`og-default.jpg`) n'existe pas.** Chaque partage du site sur un
  réseau social produit une carte sans image.

### 2.4 Le pipeline d'import

- `prepareForWeb` plafonne à 2048 px et 400 Ko, convertit en sRGB, applique
  l'orientation. Il **efface toutes les métadonnées en silence** (comportement par défaut
  de sharp) et n'écrit ni auteur ni copyright. Le fichier déposé chez Sanity est
  juridiquement anonyme.
- **Deux chemins d'import contournent le plafond** : le glisser-déposer dans le Studio
  (aucun redimensionnement, l'asset arrive en résolution master) et `scripts/set-hero.ts`
  (dépôt brut). Rien ne signale un asset trop grand.
- `components/gallery/OriginalViewer.tsx` est du code mort qui affiche l'asset original
  en plein écran. Personne ne l'importe, mais il attend d'être rebranché.

### 2.5 Ce qui est déjà bien

Le clic droit et le glisser-déposer sont neutralisés (`PhotoGuard`), avec un commentaire
honnête sur leur portée. Le plafond d'URL est centralisé dans `urlFor`. Aucun GPS n'est
stocké (`metadata` sans `'location'`). Le champ `hidden` permet de retirer une photo sans
la détruire. Le pipeline existe et il est testé (`check-image-prep`).

## 3. Recommandations

Par ordre d'effet réel sur la protection. Les trois premières ferment les trous mesurés ;
les suivantes rendent l'auteur visible ; les dernières sont de l'hygiène.

### R1 — Réduire les 121 assets stockés en pleine résolution (effet : majeur)

Refaire passer chaque asset au-dessus du plafond par `prepareForWeb`, déposer la version
2048 px, et faire pointer le document `photo` (et ses brouillons) sur le nouvel asset.
Les anciens assets restent en base, orphelins : plus aucune URL du site n'y mène, et
l'opération est réversible tant qu'on ne purge pas. Source préférée : le master local de
`portfolio/` quand il existe (même nom de fichier), sinon le fichier servi par le CDN
(déjà ré-encodé, mais à 2048 px la seconde génération est invisible). Même traitement
pour l'image « reveal » du hero.

La purge des anciens assets (1,4 Go) est **irréversible** et n'est pas dans le plan : elle
n'a de sens qu'après confirmation qu'Alexandre détient les masters ailleurs. Question
ouverte depuis le 2026-08-21.

### R2 — Fermer les deux contournements du plafond (effet : majeur, durable)

Une validation Studio qui lit les dimensions de l'asset et **refuse la publication** d'une
photo au-dessus de 2048 px, avec un message qui dit quoi faire. `set-hero.ts` passe par
`prepareForWeb`. `OriginalViewer.tsx` est supprimé. Sans R2, R1 se défait à la première
photo glissée dans le Studio.

### R3 — Déclarer l'auteur en données structurées (effet : majeur pour l'attribution)

Sur chaque page qui montre des photos : un `ImageGallery` dont chaque `ImageObject` porte
`creator`, `creditText`, `copyrightNotice`, `copyrightHolder`, `license` (vers la clause
de réutilisation de `/legal`) et `acquireLicensePage` (vers `/contact`). Un `Person` sur
`/about`, un `WebSite` sur la home, un `BreadcrumbList` sur les pages intérieures. C'est
la seule façon d'obtenir le badge Licensable et le crédit dans Google Images sans IPTC,
et c'est ce qui manque le plus au site aujourd'hui.

### R4 — Mentions légales exactes, avis de copyright nominatif, clause de licence (effet : juridique)

`/legal` corrigée (hébergeur GitHub, éditeur nommé), avec une section « Licensing »
ancrée (`#licensing`) qui dit en clair : toute reproduction est interdite sans accord
écrit, les demandes passent par `/contact`, et l'auteur se réserve le droit de facturer
toute utilisation non autorisée. `/privacy` gardée en cohérence. Pied de page :
« © 2026 Alexandre Matencio — All rights reserved ». Les deux pages passent sous Sanity
(`legalBody`, `privacyBody`), comme les quatre autres pages éditoriales (CLAUDE.md §8.5) :
Alexandre remplit son identité dans le Studio, sans toucher au code.

### R5 — Politique envers les robots d'IA (effet : réel sur le domaine propre, symbolique aujourd'hui)

`robots.txt` refuse les robots d'entraînement (GPTBot, ClaudeBot, CCBot, Google-Extended,
Bytespider, PerplexityBot, Applebot-Extended, meta-externalagent, etc.) tout en laissant
Googlebot et Googlebot-Image indexer : le site veut être trouvé, pas ingéré.
`/.well-known/tdmrep.json` pose l'opposition TDM européenne, `<meta name="robots"
content="noai, noimageai">` et `<meta name="tdm-reservation" content="1">` sur chaque
page. Il faut le dire tel quel : les grands acteurs respectent `robots.txt` et TDMRep, les
balises `noai` ne sont honorées que par quelques-uns, et rien de tout cela ne lie un
acteur de mauvaise foi. Mais c'est ce qui fait la différence juridique entre « il n'a
rien dit » et « il s'y est opposé de façon lisible par les machines », et c'est ce que la
directive européenne demande.

### R6 — Signer les fichiers déposés malgré tout (effet : filet, coût nul)

`prepareForWeb` écrit désormais EXIF `Artist`/`Copyright` et un paquet XMP
(`dc:creator`, `dc:rights`, `xmpRights:Marked`, `xmpRights:WebStatement`,
`plus:Licensor`). Le CDN les efface à la livraison, mais le fichier **stocké** chez Sanity
les garde : si le site change d'hébergement d'images un jour, le catalogue est déjà
signé. Et `og-default.jpg`, servi par GitHub Pages sans transformation, garde sa
signature intacte : c'est la seule image du site dont les métadonnées atteignent
réellement le visiteur.

### R7 — Ce qui ne dépend que d'Alexandre

- **Lightroom** : un preset de métadonnées (Créateur, Copyright, Statut « Protégé par
  copyright », URL d'info sur les droits) appliqué à tout le catalogue en une sélection,
  puis coché par défaut à l'import. C'est la correction du problème qu'il décrit, et elle
  vaut pour tout ce qu'il exportera vers des tiers.
- **Preuve d'antériorité** : conserver les RAW et le catalogue ; une fois par an, une
  enveloppe e-Soleau INPI (15 €) avec une planche-contact PDF des nouvelles séries.
- **Surveillance** : un compte Pixsy (gratuit, 500 images) ou Copytrack (Berlin), qui
  cherche les réutilisations et gère la mise en demeure.
- **Domaine propre** : `robots.txt` et `tdmrep.json` ne prennent effet qu'à ce moment.
- **Décision sur la purge** des anciens assets (R1).

## 4. Ce que le plan ne fait pas, et pourquoi

- Pas de filigrane visible (§1).
- Pas de filigrane invisible (Digimarc, Imatag) : abonnement payant, et le CDN de Sanity
  ré-encode à chaque taille, ce qui n'est pas garanti compatible. À reconsidérer sur un
  hébergement d'images maîtrisé.
- Pas de Content Credentials (C2PA) : même raison, le ré-encodage les détruit.
- Pas de blocage du hotlinking ni d'en-têtes HTTP : impossibles sur GitHub Pages et sur
  le CDN Sanity. À la migration Vercel, revoir (`X-Robots-Tag: noai`, CSP).
- Pas de `noimageindex` : ce serait se retirer de Google Images, à l'opposé de l'objectif
  du site.
- Pas de baisse du plafond sous 2048 px : c'est déjà inexploitable en impression, et
  descendre abîmerait la lightbox sur écran retina.

## 5. Autonomie d'exécution

Tout ce qui est dans le plan s'exécute sans intervention d'Alexandre, y compris R1 (le
jeton d'écriture Sanity est dans `.env.local`, le script est en dry-run par défaut). Les
seules exceptions sont listées en R7 et dans le guide `docs/PROTECTION-IMAGES.md` que le
plan produit à son intention. La purge des anciens assets n'est **pas** dans le plan.
