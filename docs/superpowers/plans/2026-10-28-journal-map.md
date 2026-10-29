# /concept-map — la Concept Map du journal

Nom verrouillé par Alexandre le 2026-10-29 : URL `/concept-map` dans les trois
langues, « Concept Map » partout ailleurs (menus, titres). La vue centrée
dans l'article reste à nommer. Dans ce plan, « carte » et « /map » désignent
la même chose.

Plan du 2026-10-28. Demande d'Alexandre : publier le graphe du vault Obsidian
sur blog.amatencio.com, pour qu'un lecteur s'y oriente et qu'un nœud l'envoie
au bon paragraphe du bon article. Et surtout : que chaque nouvel article, chaque
correction et chaque retraduction passent par la carte sans rien casser.
Le vault devient la racine. La carte en est une sortie, qu'Alexandre relit
avant de la publier.

## Ce qui existe déjà

- Le vault `~/Documents/ALEX-PERSO/BLOG/Graphe-du-journal/` contient 345 notes :
  8 articles, 91 thèses, 84 mécanismes, des cas, des références, des images et
  des questions. Il est produit par un générateur Python (`_generateur/`) à
  partir de données saisies à la main. Aujourd'hui, c'est le générateur qui fait
  foi, et il écrase le vault à chaque passage.
- Chaque thèse porte une citation exacte de l'article, ce qui permet de
  retrouver son paragraphe.
- Les blocs Sanity ont un `_key`, mais `PortableBody.tsx` ne le rend pas : aucun
  paragraphe n'a d'`id`, donc rien ne peut pointer vers lui.
- La traduction EN/RU (`lib/journal/translate/units.ts`) reconstruit la structure
  depuis le français et recopie les `_key`. Le paragraphe `k2j` du français est
  donc aussi `k2j` en anglais et en russe. Une même ancre sert les trois langues.
  ⚠️ Corrigé le 2026-10-29 : c'est vrai du code actuel, pas des 8 traductions
  écrites le 2026-10-18, avant la traduction incrémentale (clés `b0001`…).
  `npm run align-translation-keys` les réaligne (dry-run vérifié : même
  structure bloc pour bloc, seules les clés changent).
- **Le piège :** `import-journal.ts` numérote les clés par position (`k0`, `k1`…).
  Si on réimporte un article après y avoir inséré un paragraphe, toutes les
  clés suivantes glissent d'un cran et chaque ancre pointe vers le paragraphe
  voisin. Il faut corriger ça avant de mettre une seule ancre en ligne.

## Le principe

```
Obsidian (racine)  →  map:build  →  brouillon `journalMap` dans Sanity  →  relecture  →  Publish  →  /map
      ↑                   │
      └── rapport de dérive (map:check) ← chaque Publish d'article, chaque retraduction
```

Trois règles :

1. **Le vault fait foi.** On n'édite plus les dicts Python. Une thèse, une rime
   ou un mécanisme se corrige dans Obsidian, et l'export lit le vault.
2. **Rien ne se met en ligne sans relecture.** `map:build` écrit un *brouillon*.
   La carte en ligne ne change qu'au Publish d'Alexandre, comme un article.
3. **Une dérive dégrade, elle ne casse pas.** Quand une citation ne se retrouve
   plus (paragraphe réécrit, supprimé), le nœud renvoie au début de la section,
   ou à défaut à l'article. Le build ne tombe jamais pour ça : la dérive est
   signalée, et on la répare au passage suivant.

## Phase 1 : des ancres stables (environ 1 jour)

**Livrée le 2026-10-29** : `id="p-<clé>"` sur les paragraphes (`ArticleBody`,
pas `PortableBody` : c'est lui qui rend les articles), filet d'arrivée
(`PassageArrival` + `.journal-passage`), `import-journal` à clés stables
(`lib/journal/stableKeys.ts`), `npm run check-map-anchors`. Reste : lancer
`npm run align-translation-keys -- --yes` (écriture en production, à faire
par Alexandre ou avec son accord), après quoi `check-map-anchors` passe au vert.

1. **`PortableBody.tsx`** rend `id="p-<_key>"` sur les paragraphes, les
   intertitres et les citations mises en avant. L'`id` déjà posé par
   `anchor` (ligne 598) reste prioritaire là où il existe.
2. **Arrivée sur une ancre.** Le paragraphe visé s'éclaire brièvement : un fond
   qui apparaît puis s'efface, sans mouvement de page. L'arrivée se déclenche
   avec `#p-…` dans l'URL. Le défilement tient compte de l'en-tête fixe
   (`scroll-margin-top`). Avec `prefers-reduced-motion`, il n'y a ni éclairage
   animé ni défilement doux. ⚠️ Lire `RESOURCES/animation-principles.md` avant
   d'écrire cette animation et la repasser à sa grille avant de livrer.
3. **`import-journal.ts` réutilise les clés.** Avant d'écrire, il lit l'article
   publié et donne à chaque bloc dont le texte n'a pas changé sa clé
   existante. Un bloc légèrement retouché garde la clé du bloc existant le plus
   proche s'il est à la même place. Seuls les blocs vraiment nouveaux reçoivent
   une clé neuve, aléatoire et non plus positionnelle. Ce travail règle au
   passage une partie du piège déjà connu de l'import ciblé.
4. **Test hors ligne** `scripts/check-map-anchors.ts`, sur le modèle de
   `check-translate-markup` : réimporter un article où l'on a inséré un
   paragraphe en tête, et vérifier qu'aucune clé existante n'a bougé.

À la fin de cette phase, on peut déjà partager un lien vers un passage exact,
avant même que la carte existe.

## Phase 2 : le vault devient la racine (environ 1 jour)

**Livrée le 2026-10-29.** Vault migré en place (aucune retouche manuelle à
perdre) : propriétés structurées sur thèses, mécanismes et articles ; chaque
thèse porte désormais sa `citation`, choisie par un alignement automatique
(ordre du texte + section) puis à relire par Alexandre — 91/91 retrouvées.
Générateur archivé dans `_archive/generateur-2026-10-28/` (LISEZMOI : ne plus
lancer). `npm run map:build` écrit `.concept-map/concept-map.json` (gitignoré)
et `.concept-map/rapport.md` ; l'écriture du brouillon `journalMap` dans
Sanity arrive avec son schéma, en phase 3. Mise en page reproductible
vérifiée (deux exports depuis zéro : positions identiques). Les sections du
corps des notes ne sont plus régénérées : ce sont les propriétés qui font foi.
À trancher : les `definition` des mécanismes sont rédigées par Claude ; les
publier telles quelles ou les faire relire.

1. **Migration, faite une seule fois.** On réécrit les notes avec un
   frontmatter structuré, lisible par machine et confortable dans Obsidian :
   ```yaml
   # Thèses/Club/Club 03 — ….md
   type: thèse
   article: le-prix-d-un-club
   ordre: 3
   verdict: "…"
   citation: "phrase exacte de l'article"
   mécanismes: ["[[Plancher et multiplicateur]]", "[[Rareté organisée]]"]
   public: true
   ```
   Les rimes passent dans le frontmatter des mécanismes, avec un `statut:`
   qui vaut `écrite` (Alexandre l'a écrite lui-même), `proposée` (lecture de
   Claude) ou `validée` (lecture de Claude acceptée par Alexandre).
   Le générateur Python est archivé, il ne sert plus.
2. **`scripts/map-build.ts`** fait quatre choses :
   - il lit le vault (chemin dans `.env.local` : `JOURNAL_VAULT=…`) ;
   - il récupère les articles publiés ;
   - il résout chaque citation vers sa `_key`, sur du texte normalisé
     (espaces insécables, apostrophes, guillemets) ;
   - il calcule la mise en page, puis écrit le brouillon `journalMap` et un
     rapport.
3. **Ce qui sort du vault** se limite aux articles, aux thèses publiques, aux
   mécanismes, aux séries et thématiques, et aux rimes `écrite` ou `validée`.
   **Ce qui reste privé :** les verdicts sur les références, les questions
   ouvertes, le vécu, les rimes `proposée` et tout ce qui porte `public: false`.
   Le dépôt est public, et la carte en ligne l'est aussi : le filtre est écrit
   dans le code, il ne dépend pas d'un réglage.
4. **Mise en page calculée à l'export** (ForceAtlas2 de graphology, graine
   fixe). Les positions sont enregistrées dans `journalMap`. La carte ne
   « tremble » pas au chargement, et un article ajouté ne chamboule pas tout :
   les nœuds existants partent de leur position précédente.

## Phase 3 : le document `journalMap` et sa garde (environ 0,5 jour)

1. **Schéma** `sanity/schemas/journalMap.ts`. C'est un singleton qui contient :
   - les nœuds (`id`, type, libellé, extrait, `x`/`y`, article, `_key` de
     l'ancre, empreinte du texte du paragraphe au moment de l'export) ;
   - les liens ;
   - la date de l'export.
   Il est en lecture seule dans le Studio, puisqu'on le corrige dans Obsidian.
   Il apparaît dans le Studio sous « Journal ▸ Carte », avec un aperçu.
2. **`map:check`**, lancé à chaque build du blog (donc à chaque Publish
   d'article par le webhook). Pour chaque nœud ancré, il vérifie que la `_key`
   existe encore dans l'article FR et que son texte contient toujours la
   citation :
   - si oui, rien ne change ;
   - si la clé a disparu mais que la citation se retrouve ailleurs (paragraphe
     scindé dans le Studio, par exemple), le lien est **recalé
     automatiquement** sur la nouvelle clé au moment du build ;
   - si la citation est introuvable, le lien se rabat sur la section, puis sur
     l'article, et le nœud passe en dérive. Le build continue dans tous les cas.
3. **Signal de dérive dans le Studio.** Une pastille sur l'article concerné
   (« 2 nœuds de la carte à reprendre ») et une liste dans le Dashboard.
   On n'envoie pas de mail : la pastille suffit.
4. **Retraductions.** Les clés étant recopiées, une retraduction ne change pas
   les ancres. `map:check` vérifie quand même que chaque `_key` existe en EN et
   en RU, ce qui attrapera une future régression du traducteur.

## Phase 4 : la page /map (environ 2 à 3 jours)

1. **Route** `app/(blog)/map/page.blog.tsx`, en lecture du `journalMap`
   publié au build. Ajouts : un lien discret dans la navigation du blog, une
   entrée dans le sitemap, des métadonnées et une image OG.
2. **Rendu avec Sigma.js et graphology** (WebGL, versions exactes figées) :
   - les articles sont de gros nœuds aux couleurs de leur série ;
   - les thèses sont de petits satellites autour de leur article ;
   - les mécanismes portent la couleur de leur thématique ;
   - les rimes sont des liens fins entre mécanismes ;
   - les libellés n'apparaissent qu'au zoom, sinon c'est illisible au-delà de
     150 nœuds.
3. **Au survol**, le nœud et ses voisins restent nets et le reste s'estompe.
   **Au clic**, un panneau latéral s'ouvre :
   - thèse : verdict, citation, « Lire le passage → » vers `/<slug>#p-<key>` ;
   - mécanisme : définition et liste des articles qui l'emploient, chacun
     avec son passage ;
   - article : chapô, série, et ses thèses dans l'ordre.
4. **Filtres** : par série, par thématique et « structures communes
   seulement », c'est-à-dire les mécanismes présents dans au moins deux
   articles.
5. **Mobile et accessibilité.** Sous 768 px, la carte cède la place à une
   liste filtrable (mécanisme → articles → passages), et le graphe reste
   accessible derrière un bouton. Cette même liste sert de version clavier et
   lecteur d'écran sur grand écran. Le graphe est un bonus visuel, pas le seul
   chemin.
6. **Respect de la charte du journal** (typographie, couleurs des
   thématiques, `design-system`). Les animations d'entrée et d'estompage
   passent par `animation-principles.md`.

## Notes du brief (Alexandre, 2026-10-28)

Telles qu'il les a dictées, à garder intactes :

> Note pour moi : quand on clique sur un nœud qui envoie au paragraphe, on
> garde le graphe à côté de l'article (accessible mais caché), et quand on
> l'ouvre, c'est un graphe simplifié avec l'endroit où l'on est au centre, et
> les connexions directes visibles ; ensuite on peut ajouter d'autres choses
> par filtres.

> Quand on lit un article, disons qu'on est au deuxième paragraphe d'une
> section, sur une idée précise, on doit pouvoir, avec une UX moderne et
> irréprochable, accéder à son emplacement dans la mindmap, pour trouver
> toute idée liée dans le même article ou dans n'importe quel autre article
> du journal.

Ces deux notes décrivent un seul objet : **la mindmap dans l'article**. Les
deux entrées (« j'arrive de /map » et « je lis et je veux voir où je suis »)
ouvrent le même panneau.

## Phase 4 bis : la mindmap dans l'article (environ 2 à 3 jours)

**Proposition de Claude, à valider par Alexandre.**

1. **Chaque paragraphe appartient à une thèse.** Aujourd'hui, une thèse pointe
   vers un seul paragraphe, celui de sa citation. Il faut aussi l'inverse :
   une thèse couvre tous les paragraphes compris entre son ancre et l'ancre de
   la thèse suivante. Le paragraphe « 2 de la section 3 » a ainsi toujours une
   thèse qui lui correspond. `map:build` enregistre ces plages dans
   `journalMap`, et `map:check` les vérifie comme les ancres (phases 2 et 3).
2. **Le panneau.** Un tiroir latéral, fermé par défaut, qui ne pousse pas le
   texte. Sur mobile, il devient une feuille qui monte du bas. Quand on
   l'ouvre, il montre :
   - la thèse courante au centre ;
   - ses voisins directs : ses mécanismes, la thèse précédente et la
     suivante dans l'article ;
   - les autres articles qui emploient les mêmes mécanismes.
   Les filtres permettent d'ajouter des couches : rimes, thématiques, série,
   tout le journal. Un lien « Voir dans la mindmap complète » mène à `/map`,
   centré sur ce nœud.
3. **Comment on y accède en lisant :**
   - **une marque dans la marge.** Un repère discret au niveau du paragraphe
     qu'on lit, qui devient visible au survol ou au focus du paragraphe. Au
     clic, le panneau s'ouvre centré sur cette idée. Sur mobile, une pastille
     flottante affiche le nom de l'idée en cours de lecture ; un toucher
     ouvre la feuille ;
   - **le suivi de lecture.** Le panneau ouvert suit le défilement : quand on
     passe à la thèse suivante, le centre glisse vers elle sans tout
     redessiner ;
   - **le clavier.** La touche `M` ouvre et ferme le panneau sur la thèse en
     cours ; on se déplace entre les nœuds avec les flèches et `Entrée`.
4. **Quand on arrive depuis /map**, le panneau existe déjà, fermé, avec le
   nœud d'origine au centre. C'est la première note d'Alexandre, telle quelle.
5. **Coexistence avec le surligneur.** La marge et la sélection de texte
   servent déjà au surligneur du journal. La marque de la mindmap ne doit ni le
   gêner ni le masquer. On teste les deux ensemble avant de livrer.
6. **Animations.** Ouverture du tiroir, glissement du centre, estompage des
   voisins : on lit `animation-principles.md` avant de les écrire et on les
   repasse à sa grille avant de livrer. `prefers-reduced-motion` remplace
   chaque mouvement par un fondu ou par rien.

## Phase 5 (plus tard) : /en/map et /ru/map

Les ancres marchent déjà dans les trois langues. Il manque les libellés : les
verdicts et extraits passeraient par le même traducteur incrémental, en
réutilisant ce qui n'a pas changé. On ne s'y lance qu'une fois la carte
française rodée.

## Le circuit, une fois en place

**Nouvel article** (étape ajoutée à la skill `journal-writing`, entre le texte
final et le Publish) :

1. Le texte est validé et importé en brouillon, comme aujourd'hui.
2. Claude décompose l'article *dans le vault* : les notes de thèses, les
   mécanismes nouveaux ou réemployés et les rimes, toutes en `proposée`.
3. Alexandre relit dans Obsidian. Il corrige les thèses, passe les rimes
   qu'il accepte en `validée`, supprime les autres et met en `public: false`
   ce qui ne doit pas sortir.
4. `npm run map:build` produit le brouillon `journalMap` et le rapport :
   citations introuvables, nœuds orphelins, nouveaux ponts entre séries.
5. Alexandre publie l'article, puis la carte. L'article peut aussi partir
   seul : la carte en ligne reste simplement sur sa version précédente
   jusqu'au Publish suivant.

**Correction d'un article publié.** Rien à faire si la retouche n'a pas
touché aux phrases citées. Sinon, la pastille de dérive apparaît dans le
Studio ; Claude met à jour la citation dans le vault, relance `map:build`, et
Alexandre publie.

**Retraduction.** Rien à faire, les ancres sont partagées. `map:check`
surveille.

**Ce qui ne doit plus arriver :** relancer l'ancien générateur, qui
écraserait le vault, ou réimporter un article avec l'ancien `import-journal`.
Les deux disparaissent dans ce chantier.

## Ordre de livraison et vérification

| Phase | Livrable | Vérifié par |
|---|---|---|
| 1 | ancres + éclairage + import à clés stables | `check-map-anchors`, lien partagé ouvert dans Chrome, Safari et Firefox |
| 2 | vault migré + `map:build` | 91 citations résolues sur 91, rapport vide, diff de la mise en page reproductible |
| 3 | `journalMap` + `map:check` + pastille | paragraphe scindé dans le Studio puis recalé, phrase supprimée puis rabattue sur la section |
| 4 | /map | capture desktop et mobile (Playwright, locale fr-FR), navigation clavier dans la liste, Lighthouse |
| 4 bis | mindmap dans l'article | chaque paragraphe des 8 articles retrouve sa thèse ; arrivée depuis /map ; touche `M` ; surligneur intact |

Chaque phase part sur sa branche depuis `origin/main` et se met en ligne
selon la règle habituelle : vérifier, fusionner, pousser, rebuild du VPS.
La phase 1 peut partir seule.

## Coût total

Environ sept à huit jours de travail sur les phases 1 à 4 bis. La phase 1
rend service seule, puisque les liens vers un passage précis servent même
sans carte.

## Décisions

- 2026-10-28 : toutes les thèses sont publiques par défaut ; `public: false`
  pour en exclure une.
- 2026-10-28 : URL `/map` ; libellés de menu traduits ; « Mindmap » retenu,
  français compris.

## Reste à faire avant la mise en ligne

- Alexandre relit les 49 rimes `proposée` du vault, qui sont des lectures de
  Claude. Les 16 rimes `écrite` viennent de ses textes et n'ont pas besoin
  de cette relecture.
- Valider la proposition de la phase 4 bis.

## Appris en route (2026-10-29)

- **Les articles du journal ne passent pas par `PortableBody`** : c'est
  `components/journal/ArticleBody.tsx` qui les rend, à partir du modèle de
  `lib/journal/convert.ts` (`blocksOf`). Une donnée du Studio qui doit
  atteindre la page passe par `types.ts` → `convert.ts` → `ArticleBody`.
- **Les traductions écrites le 2026-10-18 avaient leurs propres clés**
  (`b0001`, `q000f`…), contrairement au code actuel de `translate-post`, qui
  recopie les clés françaises. Réalignées par `align-translation-keys` (8
  documents). `npm run check-map-anchors` surveille la régression.
- **`import-journal` numérotait les clés avec un compteur GLOBAL** (`k0`,
  `k1`… sur tous les fichiers d'un import), donc la clé d'un paragraphe
  dépendait même des articles importés avant lui. Remplacé par des clés
  aléatoires + reprise des clés existantes (`lib/journal/stableKeys.ts`).
- **`:target` ne suffit pas pour l'arrivée sur un passage** : la navigation
  client de Next passe par `pushState`, qui ne met pas `:target` à jour. D'où
  `PassageArrival` (montage + `hashchange`).
- **Les thèses du vault n'avaient pas de citation**, seulement un résumé
  rédigé par Claude ; seuls les mécanismes portaient une citation exacte. Les
  91 citations ont été posées par alignement automatique (`anchors.py`,
  archivé) : ordre du texte + bonus de section. Les deux scores les plus
  faibles ont été relus à la main et sont justes.
- **Le classifieur du mode auto bloque toute écriture en production Sanity**
  (et même le dry-run d'`import-journal`, qu'il ne distingue pas) : demander
  l'accord explicite d'Alexandre avant de lancer ces scripts.
- **Port 3011 = le serveur d'une autre checkout.** Pour tester cette
  worktree : `SITE_TARGET=blog npx next dev -p 3021`, Playwright avec
  `locale: 'fr-FR'` et `executablePath` vers
  `~/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/…`, import
  de playwright par chemin absolu depuis le scratchpad.
- `npx eslint` sur un fichier isolé échoue (config ESLint à migrer, problème
  antérieur) ; `npx tsc --noEmit` est la vérification qui marche.
- Matplotlib n'est pas installé : pas d'aperçu image de la mise en page hors
  du navigateur.

## Prochaines actions (état au 2026-10-29)

Fait et en ligne : phase 1 (main 3c1c32a, clés EN/RU alignées), phase 2
(main d056564). Sortie actuelle de `map:build` : 8 articles, 91 thèses
ancrées sur 91, 83 mécanismes, 15 rimes écrites, 49 proposées non publiées,
0 problème.

1. **Phase 3 : faite le 2026-10-29** (code en ligne ; reste le premier
   `npm run map:build -- --write`, qui écrit en production : accord
   d'Alexandre, puis son Publish de « Journal ▸ Concept Map »).
   - `lib/journal/mapAnchors.ts` (pur) : `resolveAnchor` → `ok` | `moved`
     (citation retrouvée ailleurs, recalée) | `reworded` (citation perdue,
     paragraphe là) | `section` (repli sur le `_key` de l'intertitre, stocké
     à l'export) | `article`. `resolveArticleTheses` recalcule les `covers`
     sur le texte du moment. Les trois derniers statuts sont la dérive.
   - `lib/journal/conceptMap.ts` : forme du document, GROQ, et
     `checkConceptMap(map, posts)` (dérive + clés absentes en EN/RU). C'est
     CE recalage que la page de la phase 4 appliquera au build : le script du
     VPS lance `next build` directement, pas un script npm.
   - `npm run map:check` : même vérification en console, toujours en sortie 0.
   - Studio : singleton `journalMap` en lecture seule, onglets « État » puis
     « Données » ; pastille « Concept Map : N à reprendre » à côté de Publish
     sur l'article (texte affiché, brouillon compris) ; carte au Tableau de
     bord. Vérifié sur `/studio-probe` avec la carte servie par interception
     Playwright (une dérive et un recalage fabriqués).
   - 39 assertions (`check-map-anchors`) ; sur les vrais articles, 174/174
     nœuds `ok` et `covers` identiques à l'export.
   - ⚠️ `/studio-probe` ne marche que sur le port 3010 (CORS Sanity).
2. **Phase 4** : page `/concept-map` (Sigma.js + graphology, positions de
   `journalMap`), panneau latéral, filtres, liste filtrable sur mobile et
   pour le clavier. Lire `animation-principles.md` avant d'écrire.
3. **Phase 4 bis** : panneau Concept Map dans l'article (thèse courante au
   centre, `covers` pour savoir où l'on est, touche `M`, marque de marge,
   coexistence avec le surligneur).
4. **Ajouter l'étape Concept Map à la skill `journal-writing`**
   (am-photo/.claude/skills/journal-writing) : décomposer l'article dans le
   vault, relecture d'Alexandre, `map:build`, Publish.

En attente d'Alexandre :
- relire dans Obsidian les 91 citations ancrées (le passage où le lecteur
  arrivera) et les 49 rimes `proposée` (passer en `validée` ou supprimer) ;
- trancher : publier les `definition` des mécanismes (rédigées par Claude)
  telles quelles, ou les relire d'abord ;
- nommer la vue centrée dans l'article ;
- **bug en ligne** : *Hot chats make hot charts* affiche « ## L'argent : les
  commus paient déjà pour… » en texte brut dans un paragraphe (intertitre
  tapé dans le texte) ; à convertir en vrai H2 dans le Studio, par lui ou
  par Claude avec son accord ;
- toujours ouverts depuis le 2026-10-28 : « 50 000 euros de dettes à
  confirmer » visible dans *Le plancher et le multiplicateur* ; bloc « à
  trancher » et citation en exergue divergente dans *Hot chats* ; liste des
  directions pour l'« À propos » court.
