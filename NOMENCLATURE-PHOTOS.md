# Nommer ses fichiers photo avant l'upload

Le nom du fichier n'est pas qu'une étiquette : c'est ce qui remplit le catalogue. Titre, lieu, styles, boîtier, objectif — tout est lu depuis le nom au moment de l'import, puis complété par les données EXIF de l'appareil. Bien nommer une photo avant de l'envoyer, c'est s'épargner dix minutes de saisie dans le CMS.

## Le format

```
Titre -champ -champ -champ…
```

Le titre vient toujours en premier. Ensuite, autant de champs que tu veux, **dans l'ordre qui t'arrange**, et **aucun n'est obligatoire**.

Un exemple complet :

```
Pas de vin à la fête -paris, france -sp,paysage -Fuji X-PRO2 -MF 35MM f1.4 Meike.jpeg
```

Un exemple minimal, tout aussi valable :

```
Toits gris -2024 -paris, france.jpeg
```

Et même, si tu es pressé :

```
Toits gris.jpeg
```

Rien ne plante jamais. Un champ absent reste vide, et la photo remonte dans les alertes du tableau de bord pour que tu la complètes dans le Studio quand tu veux.

## Deux façons d'écrire un champ

**Avec le nom du champ** — sans ambiguïté possible, à privilégier dès qu'il y a un doute :

```
Ma photo -lieu:Paris, France -style:sp -boitier:Fuji X-PRO2 -annee:2024
```

**Sans le nom du champ** — l'import devine d'après le contenu :

```
Ma photo -paris, france -sp -2024
```

Les deux écritures se mélangent librement dans un même nom. Les noms de champs acceptés :

| Champ | Écrire au choix |
|---|---|
| Titre | `titre:` `nom:` `title:` |
| Lieu | `lieu:` `ville:` `location:` |
| Styles | `style:` `styles:` `type:` |
| Boîtier | `boitier:` `camera:` `appareil:` |
| Objectif | `objectif:` `lens:` `optique:` |
| Année | `annee:` `year:` `an:` |
| Date | `date:` (format `AAAA-MM-JJ`) |
| Série(s) | `serie:` `series:` |

Si tu écris `--lieu:` avec deux tirets par réflexe de ligne de commande, c'est accepté aussi.

## L'ordre n'a aucune importance

Ces deux noms produisent exactement le même résultat :

```
Ma photo -lieu:Paris, France -date:2024-06-12
Ma photo -date:2024-06-12 -lieu:Paris, France
```

Ce n'est pas une hiérarchie, juste une liste. Range les champs comme ça t'arrange.

## Ce que la déduction sait reconnaître

Sans nom de champ, l'import identifie un jeton ainsi : un nombre à quatre chiffres entre 1900 et l'an prochain est une **année** ; une chaîne `AAAA-MM-JJ` est une **date** ; un mot du vocabulaire des styles (voir plus bas) est un **style** ; un boîtier ou un objectif déjà présent dans le catalogue est reconnu par son nom ; un nom de **série existante** (ou plusieurs, séparées par des virgules) est reconnu ; et une chaîne contenant une virgule, ou correspondant à un lieu déjà utilisé, est un **lieu**.

Tout le reste est signalé dans le rapport comme non compris, et ignoré. L'import ne devine jamais au hasard.

La limite à connaître : un boîtier ou un objectif **utilisé pour la première fois** n'est pas encore dans le catalogue, donc pas reconnu. Pour celui-là, utilise le nom de champ — `-boitier:Leica M6` — au moins la première fois. Ensuite il sera connu.

## Le séparateur

Les champs sont séparés par **espace + tiret** : ` -`. C'est ce qui découpe le nom.

Un tiret collé à l'intérieur d'un mot ne pose aucun problème : « Rendez-vous à l'aube » reste un titre entier, parce qu'il n'y a pas d'espace avant le tiret. En revanche, n'écris jamais un titre contenant « espace tiret » — « Paris - la nuit » serait coupé en deux. Écris « Paris, la nuit » ou « Paris — la nuit » (tiret cadratin) à la place.

## Le lieu : mets toujours le pays

**Écris `-paris, france`, pas `-paris`.** Le catalogue existant utilise la forme « Ville, Pays », et la page Archives regroupe les photos par lieu en comparant ces chaînes au caractère près. Un « Paris » et un « Paris, France » créeraient deux groupes séparés pour la même ville.

La casse n'a pas d'importance, elle est corrigée à l'import : `-djerba, tunisia` devient « Djerba, Tunisia ». La virgule à l'intérieur du lieu ne gêne pas le découpage, puisque seuls les ` -` séparent les champs.

Les lieux déjà présents dans le catalogue, à réutiliser tels quels :

`Paris, France` · `Djerba, Tunisia` · `Villejuif, France` · `Moscow, Russia` · `Gornutz, Spain` · `Biarritz, France` · `Bruxelles, Belgium`

## Les styles

Jusqu'à trois, séparés par des virgules : `-sp,paysage`. Un espace après la virgule est toléré (`-sp, paysage`), il est ignoré à l'import. Une photo à plusieurs styles apparaît dans chacun des groupes correspondants sur la page Archives — c'est voulu.

| Style | Ce que tu peux écrire |
|---|---|
| Street | `sp`, `street`, `rue`, `streetphotography` |
| Landscape | `paysage`, `ls`, `landscape` |
| Portrait | `pt`, `portrait` |
| Architecture | `archi`, `ar`, `architecture` |

Les accents et la casse sont ignorés. Un mot absent de cette table est **ignoré et signalé** dans le rapport — la photo est importée quand même, simplement sans ce style. Aucun style fantôme n'est jamais créé sur une faute de frappe.

Pour ajouter un nouveau style au vocabulaire, passe par le Studio : **Structure → Taxonomies → Styles**, crée le style, et renseigne ses alias. Il devient utilisable dès l'import suivant.

## Les séries

Une photo peut rejoindre une ou plusieurs séries directement depuis son nom, séparées par des virgules :

```
Scène de rue -paris, france -street -serie:Global Street, Topo
```

Deux règles distinctes selon l'écriture :

- **Avec la clé `serie:`** — les séries qui n'existent pas encore sont **créées automatiquement** à l'import (avec leur titre tel que tu l'as tapé), exactement comme le fait l'action « Ajouter à une série » du Studio. Le rapport les liste avant de valider.
- **Sans la clé** — un jeton n'est reconnu comme série(s) que si **tous** ses noms correspondent à des séries déjà existantes (titre ou slug). Une série toute neuve écrite sans clé finirait en « jeton incompris » : pour la première fois, utilise `serie:`, ensuite l'écriture libre suffit.

Deux précisions. Si un mot est à la fois un style et une série (« topo » par exemple), un jeton sans clé où tout matche des styles est lu comme **styles** — pour forcer la série, écris `serie:topo`. Et le rattachement par le nom se **cumule** avec `--auto-series` : la photo rejoint ses séries du nom ET celle de son lieu.

## Boîtier et objectif

Ces deux champs sont facultatifs dans le nom, parce que l'appareil les écrit souvent tout seul dans l'EXIF. La règle de priorité : **le nom de fichier gagne toujours sur l'EXIF.** Si tu ne mets rien, l'EXIF prend le relais. Si l'EXIF est muet aussi, le champ reste vide et la photo remonte dans les alertes du tableau de bord.

Le cas qui compte vraiment, c'est l'objectif manuel. Une optique entièrement mécanique — ta Meike MF 35mm, par exemple — ne communique rien au boîtier : elle n'apparaît nulle part dans l'EXIF. Pour ces objectifs-là, **le nom de fichier est la seule source**. Si tu l'omets, l'information est perdue.

Écris le nom tel que tu veux le voir affiché. À l'import, un boîtier ou un objectif inconnu est créé automatiquement, et la chaîne EXIF correspondante lui est ajoutée comme alias — de sorte que les imports suivants, même sans mention dans le nom, retrouveront le bon matériel.

Attention aux variantes d'écriture : « Fuji X-PRO2 » et « Fujifilm X-Pro2 » créeraient deux boîtiers distincts. Le rapport d'import liste tout matériel nouvellement créé, précisément pour que tu repères ce genre de doublon avant de valider.

## Ce que tu n'as pas à écrire

**La date et l'année**, la plupart du temps. Elles sont lues dans l'EXIF (`DateTimeOriginal`). Tu peux malgré tout les forcer dans le nom (`-2024` ou `-date:2024-06-12`), et c'est alors le nom qui gagne — utile pour un scan d'argentique ou un boîtier à l'horloge déréglée. Si la date EXIF contredit l'année que tu as écrite, elle est écartée plutôt que de laisser un couple incohérent.

**Le slug.** Il est fabriqué automatiquement au format `année-ville-titre`, par exemple `2025-paris-pas-de-vin-a-la-fete`.

## Ce que le nom de fichier ne peut pas porter

Le **texte alternatif** est obligatoire et doit faire entre 5 et 200 caractères. L'import le pré-remplit avec « Titre — Lieu », ce qui satisfait la validation mais ne vaut rien pour l'accessibilité ni le référencement. Il faut le réécrire à la main dans le Studio : une description sensorielle courte — le lieu, le sujet, l'ambiance. Pas d'accumulation de mots-clés.

La **curation** (la sélection affichée sur la page d'accueil) se gère dans le Studio, après l'import — elle vit dans les Réglages du site, pas sur la photo.

## Comment exporter tes fichiers

**sRGB, 8 bits, grand côté d'au moins 2048 px, qualité maximale.** Le poids du fichier que tu déposes n'a aucune importance : l'import fabrique sa propre copie réduite et ne touche jamais à ton master.

Formats acceptés : `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.heic`, `.heif`, `.tif`, `.tiff`. Tout ce qui n'est pas dans cette liste est ignoré en silence par le dossier `portfolio/`.

**N'exporte pas en HDR.** Ce n'est pas une préférence esthétique, c'est une contrainte mesurée : le CDN de Sanity ré-encode chaque image qu'il sert, y compris à l'adresse dite « originale ». Une gain map HDR ou un fichier PQ/HLG y perd sa couche HDR quoi qu'il arrive — personne ne verrait jamais la différence sur le site, et le master serait juste plus lourd. Si tu en déposes un quand même, rien ne casse : l'import le détecte, l'aplatit proprement et te le dit dans le rapport.

Même logique pour le **Display P3** ou l'**AdobeRGB** : c'est converti en sRGB à l'import, avec écrêtage des couleurs hors gamut. Autant faire la conversion toi-même dans Lightroom, où tu vois le résultat.

## Comment se passe un import

Dépose les fichiers dans le dossier `portfolio/`, puis :

```bash
npm run upload-photos                    # analyse, rapport, demande confirmation
npm run upload-photos -- --dry-run       # rapport seul, n'écrit rien
npm run upload-photos -- --auto-series   # range aussi chaque photo dans la série de son lieu
```

Le rapport détaille, fichier par fichier, ce qui a été compris : titre, slug, lieu, styles, boîtier, objectif, série, année — avec la source entre crochets, `[fichier]` ou `[exif]`. Les avertissements signalent ce qui manque. Aucun fichier n'est jamais rejeté, et rien n'est écrit avant ta confirmation.

## Le rangement automatique en série

Avec `--auto-series`, chaque photo est rattachée à la série correspondant à son lieu : une photo à « Djerba, Tunisia » rejoint la série « Djerba », créée au besoin. La règle de nommage est la même que celle du rattachement en masse (`npm run assign-series-by-location`), donc les deux outils alimentent bien les mêmes séries au lieu d'en créer des parallèles.

Sans lieu, pas de série automatique — c'est signalé dans le rapport. `--auto-series` se cumule avec les séries écrites dans le nom de fichier (section « Les séries ») : la photo rejoint les deux. Et sans l'un ni l'autre, la série se choisit à la main dans le Studio, via l'action **« Ajouter à une série »** du menu d'une photo, qui permet aussi de créer une série en tapant simplement son nom.

L'import est **idempotent** : l'identifiant d'une photo dérive de son nom de fichier, donc relancer la commande ignore ce qui a déjà été importé. Corollaire à connaître : **renommer un fichier après coup et le réimporter crée une deuxième photo** au lieu de mettre à jour la première. Pour corriger des métadonnées après import, passe par le Studio.

Une fois les photos importées et rangées, il reste deux gestes pour qu'elles apparaissent en ligne : **Publish** dans le Studio, puis `npm run deploy`.

## Si tu ne mets rien du tout

Un fichier sans aucun ` -` est importé quand même : le nom sert de titre, le reste est vide, et la photo t'attend dans les alertes du tableau de bord. C'est parfaitement acceptable pour vider une carte mémoire vite fait et trier plus tard.

## Aide-mémoire

```
Djerba Beach Girls -djerba, tunisia -sp,portrait -Fuji X-PRO2.jpeg
Villejuif Construction -villejuif, france -archi.jpeg
Toits gris -2024 -paris, france.jpeg
Nuit blanche -style:sp -lieu:Paris, France -annee:2023 -boitier:Leica M6.jpeg
Scène de rue -paris, france -street -serie:Global Street, Topo.jpeg
Sans rien.jpeg
```

| Cas | Ce qui se passe |
|---|---|
| `-paris` au lieu de `-paris, france` | Deux groupes « Paris » distincts dans les Archives |
| Style hors vocabulaire (`-urbain`) | Style ignoré et signalé ; la photo est importée |
| Titre contenant « espace tiret » | Titre coupé, champs décalés |
| Plus de 3 styles | Les 3 premiers sont gardés, le reste signalé |
| Objectif manuel omis | Information définitivement perdue |
| Boîtier neuf sans `-boitier:` | Non reconnu ; signalé comme jeton incompris |
| Série neuve sans `-serie:` | Non reconnue ; signalée comme jeton incompris |
| Deux orthographes d'un même boîtier | Deux boîtiers dans le catalogue |
