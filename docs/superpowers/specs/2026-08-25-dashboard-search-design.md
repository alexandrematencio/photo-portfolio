# Recherche à facettes du Tableau de bord — spécification de conception

**Date** : 2026-08-25
**Statut** : validé, en attente du plan d'implémentation
**Branche** : `feat/dashboard-search`

---

## 1. Objet et périmètre

Une barre de recherche dans le Tableau de bord du Studio, tolérante aux fautes de frappe, doublée d'un filtrage par facettes (année, lieu, boîtier, objectif, style, série).

**Contrainte structurante, posée par Alexandre le 2026-08-25** : ce n'est pas une fonctionnalité de ce site, c'est une **boilerplate**. Le moteur doit pouvoir servir tel quel à une autre affaire — une épicerie en ligne, une boutique — sans réécriture. Les photos en sont le premier client, pas le sujet.

Conséquence directe et non négociable : **le noyau ne sait rien des photos, ni de Sanity, ni de React**. Ce qu'il sait des photos tient dans un fichier de configuration qu'on remplace.

**Deux habillages visés** : back-office (le Studio, livré ici) et vitrine client (plus tard, hors périmètre). Le noyau est commun, la couture est décrite en §9.

### Hors périmètre, assumé

| Écarté | Raison |
|---|---|
| Palette `Cmd+K` plein écran | Elle **cache** les facettes, or c'est leur visibilité qui produit le gain mesuré (§2). Et elle ne se transpose pas en vitrine. Surcouche possible plus tard, jamais le socle. |
| Actions en lot sur le résultat | Recoupe des gestes existants (action « Ajouter à une série », inputs de tri). À rouvrir sur pièce, une fois le chercheur en service. |
| Synonymes, racinisation | Corpus bilingue FR/EN/RU de 200 fiches. Coût de maintenance du dictionnaire > gain. |
| Recherche des documents `series` / `style` / `camera` comme résultats de plein droit | Leurs noms sont déjà atteignables **en tant que facettes**. Ouvrir le document série depuis la recherche viendrait avec les actions en lot. |
| État dans l'URL | Le Tableau de bord n'est pas une vue routée à paramètres. L'état est néanmoins **sérialisable par construction** — c'est la prise de la vitrine (§9.3). |
| Facettes numériques par tranches (« prix entre 5 et 10 € ») | Aucun consommateur aujourd'hui : `year` se comporte mieux en valeurs discrètes. Le type le réserve, v1 ne l'implémente pas. Forme d'extension en §9.2. |

---

## 2. Ce que disent les mesures et l'état de l'art

Quatre faits ont décidé de l'architecture. Ils sont consignés ici parce qu'ils sont vérifiables et qu'ils périment.

**Le corpus est minuscule — mesuré le 2026-08-24 sur le dataset de production.**
200 photos. L'index complet (titre, slug, légende, année, lieu, boîtier, objectif, styles, séries, référence d'image) pèse **81,5 Ko brut / 13,8 Ko gzip**, servi en **36 ms**. Le Tableau de bord charge déjà les 200 lignes d'axes (`axisRows`) à chaque ouverture : l'index n'ajoute pas un aller-retour, il grossit celui qui existe.

→ **Tout-en-mémoire, zéro requête par frappe.** Ce n'est pas un pis-aller : c'est plus rapide que n'importe quel serveur, et c'est la seule façon d'obtenir ce qui est demandé (ci-dessous).

**GROQ ne sait pas tolérer une faute de frappe.** La documentation Sanity le dit sans détour : `match` ne fait que du token entier et du joker de préfixe, `score()` produit un BM25 sans correction orthographique, et « GROQ search doesn't handle spelling errors, synonyms and other stuff you might find in a dedicated search engine ». `score()` n'accepte par ailleurs ni déréférencement, ni sous-requête, ni fonction hors `boost()`.

→ Le flou **ne peut être que côté client**. La contrainte technique et la demande tombent du même côté.

**Les facettes valent le déplacement.** Nielsen Norman Group mesure 25 à 50 % de temps gagné sur une navigation à facettes par rapport au mot-clé seul, et une satisfaction nettement supérieure chez ceux qui appliquent un filtre avec succès. Le catalogue s'y prête : tous les axes sont des ensembles **fermés et minuscules** — 6 années, 10 lieux, 4 boîtiers, 6 objectifs, 6 styles, 13 séries.

**Le texte libre, lui, est pauvre — et les titres sont courts.**
`caption` n'est renseignée que **6 fois sur 200**. `image.alt` est renseignée 200/200 mais **auto-générée** par l'import : « Archi [2] — Paris, France » = le titre et le lieu recopiés. La surface réellement cherchable est donc **titre + lieu**. Or la médiane des titres est de **13 caractères** et **42 titres sur 200 font 8 caractères ou moins** (« Bus », « Desk », « Archs », « Дума »).

→ Deux conséquences, toutes deux dans le classement : `alt` est **exclue de l'index** (l'indexer double le poids du titre et fausse le tri), et la tolérance aux fautes **doit** être plafonnée par la longueur du mot, faute de quoi les titres courts deviennent interchangeables.

### Sources

- [Sanity — Search text content with GROQ](https://www.sanity.io/docs/content-lake/search-content-with-groq)
- [Sanity — GROQ functions reference](https://www.sanity.io/docs/specifications/groq-functions)
- [NN/g — Ecommerce Search UX, including faceted search](https://www.nngroup.com/reports/ecommerce-ux-search-including-faceted-search/)
- [Algolia — How to streamline your search UX design](https://www.algolia.com/blog/ux/how-to-streamline-your-search-ux-design)
- [Meilisearch — Fuzzy search: a comprehensive guide](https://www.meilisearch.com/blog/fuzzy-search)
- [uFuzzy — A tiny, efficient fuzzy search](https://github.com/leeoniya/uFuzzy)

---

## 3. Architecture

```
lib/search/                    ← NOYAU. TypeScript pur, zéro dépendance.
  types.ts                       SearchConfig, FieldSpec, FacetSpec, SearchResult
  normalize.ts                   pliage de casse et d'accents, tokenisation
  distance.ts                    Damerau-Levenshtein plafonné, score de sous-séquence
  buildIndex.ts                  index de tokens précalculé une fois
  search.ts                      classement, comptage de facettes, « vouliez-vous dire »
  useFacetedSearch.ts            hook React sans UI (état + résultat, zéro pixel)

sanity/tools/search/           ← HABILLAGE Studio (@sanity/ui)
  photoSearchConfig.ts           les champs, leurs poids, les 6 facettes — ~40 lignes
  photoIndexQuery.ts             la GROQ + le rebasage des brouillons
  SearchCard.tsx                 omnibox, jetons, panneau, planche-contact
  ResultGrid.tsx                 le slot de rendu d'un résultat

scripts/check-search.ts        ← assertions hors ligne
```

**Aucune dépendance npm ajoutée.** Fuse.js (Bitap) et uFuzzy sont d'excellentes bibliothèques, écartées pour deux raisons : le classement en trois étages décrit en §4.3 est propre à ce besoin et ne se règle pas depuis leurs options, et le noyau doit rester transposable sans traîner de dépendance dans le bundle du Studio — qui est exporté statiquement vers GitHub Pages comme le reste du site. L'ensemble tient en ~350 lignes de TypeScript vérifiables.

---

## 4. Le noyau

### 4.1 Contrat de configuration

```ts
type FieldSpec<T> = {
  key: string
  weight: number
  get: (doc: T) => string | string[] | null | undefined
  /** termes indexés mais jamais affichés : alias, translittérations, ancien nom */
  extra?: (doc: T) => string[]
}

type FacetSpec<T> = {
  key: string
  label: string
  kind: 'term'                        // 'range' réservé, cf. §9.2
  get: (doc: T) => Primitive | Primitive[] | null | undefined
  sort?: 'count' | 'label' | 'value-desc'
}

type SearchConfig<T> = {
  id: (doc: T) => string
  fields: FieldSpec<T>[]
  facets: FacetSpec<T>[]
  /** départage à score égal — récence en back-office, popularité en vitrine */
  tiebreak?: (a: T, b: T) => number
}
```

```ts
buildIndex(docs: T[], config: SearchConfig<T>): SearchIndex<T>

search(index, query: { text: string; facets: Record<string, Primitive[]> }): {
  hits:        { doc: T; score: number }[]
  facets:      { key; label; values: { value; label; count; active; disabled }[] }[]
  suggestions: FacetSuggestion[]      // pour l'omnibox
  didYouMean?: string
  total: number
}
```

Le noyau ne rend rien et ne connaît aucune source de données. `buildIndex` reçoit un tableau d'objets déjà en mémoire ; d'où il vient — GROQ, `fetch`, fichier statique — ne le regarde pas. **C'est la seule couture qui compte** : le jour où le corpus dépasse le plafond de §8, on remplace ce qui alimente `buildIndex`, ni le classement ni l'interface ne bougent.

### 4.2 Normalisation

Pliage NFD, suppression des diacritiques, minuscules, découpe sur tout ce qui n'est ni lettre ni chiffre.

⚠️ **Le pliage d'accents ne doit pas manger le cyrillique.** Le catalogue contient des titres russes (« Дума », « Переделкино »). La décomposition NFD suivie du retrait de la plage `̀-ͯ` laisse le cyrillique intact — c'est le comportement attendu, et il est vérifié par une assertion (§7). Une implémentation à coups de table de correspondance latine, elle, les détruirait silencieusement.

La normalisation et la tokenisation sont faites **une fois, à l'indexation**. Jamais par frappe. C'est la seule optimisation qui compte à cette échelle ; toutes les autres sont prématurées.

### 4.3 Le classement en trois étages

Pour un mot tapé et un token indexé, on retient le premier étage qui matche :

| Étage | Cas | Score |
|---|---|---|
| 1 | égalité exacte | 1,00 |
| 1 | préfixe (`djer` → `djerba`) | 0,90 |
| 1 | sous-chaîne | 0,70 |
| 2 | sous-séquence façon `fzf` (`djfi` → **dj**erba **fi**shermen) | 0,55 × compacité |
| 3 | distance d'édition dans le budget | 0,45 × (budget + 1 − erreurs) / (budget + 1) |

La formule de l'étage 3 est monotone décroissante et bornée : à budget 1, une erreur vaut 0,225 ; à budget 2, une erreur vaut 0,30 et deux erreurs 0,15. Un mot flou passe donc toujours **derrière** une sous-séquence, qui passe elle-même derrière une sous-chaîne — l'ordre des étages est un ordre de confiance, jamais un ex æquo.

**Étage 3 : Damerau-Levenshtein, pas Levenshtein.** Damerau compte l'**inversion de deux lettres adjacentes comme une seule erreur** (« Djreba » → « Djerba ») là où Levenshtein en compte deux. C'est la faute de frappe la plus courante au clavier, et celle qu'Alexandre a nommée en premier. Implémentation plafonnée : on abandonne dès que le meilleur score possible dépasse le budget, ce qui évite de remplir la matrice complète.

**Le budget d'erreurs suit la longueur du mot tapé** :

| longueur | budget |
|---|---|
| ≤ 4 | **0** |
| 5 – 7 | 1 |
| ≥ 8 | 2 |

C'est la règle d'Algolia et de Meilisearch, et la mesure de §2 la rend obligatoire ici : sans elle, « Bus » ramène « Buoys » et « Bowling », et 42 titres du catalogue deviennent interchangeables. **Cette table est le premier réglage à toucher si le flou paraît trop lâche ou trop serré.**

**Agrégation.** Pour chaque mot tapé : score de chaque champ = meilleur score de ses tokens × poids du champ ; on retient le meilleur champ. Le score du document est la somme sur les mots tapés. **Un mot qui ne matche nulle part exclut le document** — plusieurs mots restreignent, ils n'élargissent jamais (ET entre mots, OU entre champs). À score égal, `tiebreak`.

### 4.4 Poids des champs — configuration photo

| champ | poids | raison |
|---|---|---|
| `title` | 3 | ce qu'on cherche neuf fois sur dix |
| `series`, `location` | 2 | les deux entrées mentales du photographe |
| `styles` | 1,5 | |
| `camera`, `lens` | 1 | |
| `caption` | 1 | renseignée 6/200 — presque du décor aujourd'hui, gratuite à indexer |
| `slug` | 0,5 | rattrape une recherche sur « 2026-paris-archi-2 » |
| `image.alt` | **exclue** | auto-générée « Titre — Lieu » : l'indexer compte le titre deux fois et fausse le classement (§2) |

`tiebreak` = `_updatedAt` décroissant. En back-office, ce qu'on vient d'éditer est ce qu'on cherche.

### 4.5 Facettes

Les valeurs sont **dérivées du corpus**, jamais écrites en dur — une nouvelle série ou un nouveau boîtier apparaît sans toucher au code.

Deux règles, chacune ratée par la majorité des implémentations :

1. **OU à l'intérieur d'une facette, ET entre facettes.** Cocher 2024 *et* 2025 élargit ; cocher 2024 *et* Djerba restreint. C'est l'attente universelle, et l'inverse rend le multi-choix absurde.
2. **Les compteurs d'une facette ignorent ses propres sélections.** Chaque facette est comptée sur le résultat filtré par le texte et par **toutes les autres** facettes. Sans cette règle, cocher 2024 fait tomber toutes les autres années à zéro et le multi-choix devient inutilisable.

**Aucune valeur menant à zéro résultat n'est proposée** : elle est désactivée, avec son compte à 0 visible dans le panneau (pour qu'on comprenne qu'elle existe mais ne s'applique pas ici), et absente des suggestions de l'omnibox.

Coût : 6 facettes × 200 documents = 1 200 opérations par frappe. Négligeable. À 5 000 fiches et 8 facettes : 40 000, toujours sous la milliseconde.

### 4.6 Zéro résultat

Le **vocabulaire du corpus** (tous les tokens distincts) est construit à l'indexation. Sur zéro résultat, on cherche le token du vocabulaire le plus proche du mot tapé le plus long, budget élargi d'un cran, et on le propose en un clic : « Aucun résultat pour « djreeba ». Chercher **djerba** ? »

C'est la recommandation la plus constante sur les pages de résultat vide, et elle coûte une dizaine de lignes puisque la distance et le vocabulaire existent déjà.

---

## 5. L'interface Studio

### 5.1 Emplacement

Une carte posée **au-dessus de « Vue d'ensemble »**, en tête du Tableau de bord. C'est le geste le plus fréquent ; il prend le haut de page.

### 5.2 Anatomie

```
┌──────────────────────────────────────────────┐
│ 🔍 [Djerba ×] [2024 ×] fisher▌      Filtrer ▾ │
└──────────────────────────────────────────────┘
   ▸ Djerba Fishermen OG [2]      2024 · Djerba
   ▸ Djerba Fishermen             2024 · Djerba
   ─────────────────────────────────────────
   ▸ Fujifilm X-PRO 2   — boîtier · 12

  12 résultats
  ▦▦▦▦▦▦   ← planche-contact
  ▦▦▦▦▦▦
```

**Les jetons vivent DANS le champ**, à gauche du curseur, retirables au clic. `Backspace` sur un champ vide retire le dernier — l'affordance que tout le monde attend d'un champ à jetons, et son absence se remarque immédiatement.

**La liste de suggestions mêle deux natures, séparées par un filet** : d'abord les photos qui matchent (5 à 8 au plus — au-delà de dix, une liste défilante n'est plus consultée), puis les valeurs de facette avec leur compte et leur axe (« Fujifilm X-PRO 2 — boîtier · 12 »). C'est ce qui remplace une syntaxe : on ne l'apprend pas, elle est **proposée**. Choisir une suggestion de facette la transforme en jeton et vide le mot en cours ; le reste de la frappe demeure du texte libre.

**Le panneau « Filtrer »**, replié par défaut, déplie les six axes avec toutes leurs valeurs et leurs comptes. C'est la moitié découvrable — celle qui apprend que l'axe « objectif » existe sans qu'on ait à le deviner. Le gain NN/g de §2 vient de la **visibilité** des facettes ; l'omnibox seule ne l'obtiendrait pas.

**Les résultats en planche-contact** : grille de vignettes carrées (CDN Sanity, `width×height` + `fit('crop')`, comme les cartes existantes du Tableau de bord), titre + année + lieu dessous, badge « brouillon » le cas échéant. Un photographe reconnaît une image, pas une ligne de texte. Clic → `IntentLink` `edit` vers le formulaire de la photo, comme partout ailleurs dans le Tableau de bord.

**Le compte de résultats est toujours affiché**, y compris à zéro.

### 5.3 État par défaut

Champ vide et aucune facette active → **la carte ne montre aucun résultat**, seulement le champ et le bouton « Filtrer ». Rendre 200 vignettes au chargement du Tableau de bord doublerait le coût de la page pour un contenu que personne n'a demandé ; les six autres cartes sont déjà là pour donner à voir le catalogue. Dès qu'un caractère est tapé ou une facette cochée, la planche-contact apparaît.

### 5.4 Clavier

| touche | effet |
|---|---|
| `/` | met le focus dans le champ — **sauf** si le focus est déjà dans un champ de saisie |
| `↑` `↓` | parcourt les suggestions |
| `Entrée` | applique la suggestion visée ; à défaut, ouvre le premier résultat |
| `Échap` | vide le texte ; sur un champ déjà vide, referme le panneau |
| `Backspace` | sur champ vide : retire le dernier jeton |

Pas de `Cmd+K` : Sanity possède déjà ses raccourcis, et la palette est hors périmètre (§1).

---

## 6. Trois pièges de ce repo, à ne pas repayer

**1. Une photo publiée ET éditée en brouillon remonte deux fois** (`X` et `drafts.X`). C'est le bug déjà payé dans `orderedRefsInput` (skill `sanity-studio` §11.15). Le client du Tableau de bord (`useClient`) voit les brouillons.
Traitement : rebasage sur l'id publié, dé-doublonnage, et on **garde les valeurs du brouillon** (plus fraîches que le publié — c'est ce que l'éditeur vient de taper, donc ce qu'il va chercher). Le drapeau `hasDraft` alimente le badge, cohérent avec la carte « Brouillons en attente ».

**2. `ButtonProps` de `@sanity/ui` v3 n'expose pas `children`** — seulement `text` / `icon` / `iconRight`. Une ligne composite passée en enfant d'un `<Button>` **ne s'affiche pas** : échec silencieux, typecheck vert (CLAUDE.md §11.13).
Traitement : toute ligne cliquable composite — résultat, suggestion, option de facette, jeton — est un `<Card as="button" __unstable_focusRing>`.

**3. Les compteurs de facette qui tiennent compte de leur propre sélection** rendent le multi-choix inutilisable (§4.5). Assertion dédiée en §7.

---

## 7. Vérification

Pas de framework de test : CLAUDE.md §7.4 l'interdit sans validation explicite, et le repo a sa convention — `check-parser`, `check-image-prep`. On l'étend.

`npm run check-search` → `scripts/check-search.ts`, **hors ligne**, fixtures fabriquées par le script (aucune dépendance au dataset), assertions natives comme les deux autres.

| # | Cas | Attendu |
|---|---|---|
| 1 | `djreba` | trouve `Djerba` — inversion = 1 erreur (Damerau, pas Levenshtein) |
| 2 | `bus` | ne ramène **ni** `Buoys` **ni** `Bowling` — ≤ 4 lettres, budget 0 |
| 3 | `arhcitecture` | trouve `Architecture` — inversion sur mot long |
| 4 | `djfi` | trouve `Djerba Fishermen` — sous-séquence |
| 5 | `archi` | `Archi` classé avant `Architecture` seule — étage 1 exact > étage 1 préfixe |
| 6 | `дум` | trouve `Дума` — le pliage NFD ne détruit pas le cyrillique |
| 7 | `djerba 2024` | ET entre mots : un document Djerba de 2023 est exclu |
| 8 | facettes `year ∈ {2024, 2025}` | OU dans la facette : union des deux |
| 9 | facettes `year=2024` + `location=Djerba` | ET entre facettes : intersection |
| 10 | compteurs de `year` avec `year=2024` actif | les autres années gardent des comptes **non nuls** |
| 11 | valeur de facette menant à 0 | absente des suggestions, `disabled` dans le panneau |
| 12 | `X` + `drafts.X` dans le corpus | un seul résultat, `hasDraft: true`, valeurs du brouillon |
| 13 | requête vide, aucune facette | le **noyau** rend tous les documents, ordre stable par `tiebreak`, toutes les facettes comptées sur le corpus entier. Ne pas confondre avec §5.3 : c'est l'**habillage** qui choisit de ne rien afficher dans cet état. |
| 13b | requête vide, une facette active | filtrage par la seule facette — une recherche 100 % facettes doit marcher sans un caractère tapé |
| 14 | `image.alt` | absente de l'index — un mot présent uniquement dans `alt` ne trouve rien |
| 15 | zéro résultat sur `djreeba` | `didYouMean === 'djerba'` |

Vérification manuelle complémentaire, au navigateur, sur le dataset réel : les six axes se peuplent, les comptes correspondent aux cartes existantes du Tableau de bord (`byStyle`, `tally`), le clavier fait ce que dit §5.4.

---

## 8. Performance et plafond

**Aujourd'hui.** 200 fiches × 8 champs indexés. Le pire cas par frappe reste sous la milliseconde. **Aucun anti-rebond n'est nécessaire** — en ajouter un ne ferait qu'introduire un retard perceptible sans rien économiser.

**Le plafond, écrit plutôt que découvert.** Le tout-en-mémoire tient jusqu'à **~5 000 fiches** (≈ 300 Ko gzip d'index, quelques millisecondes par frappe). Entre 2 000 et 5 000 : ajouter un anti-rebond de 80 ms. Au-delà de 5 000, deux leviers, dans cet ordre :

1. **Pré-filtrage des candidats par première lettre** avant l'étage 3 (l'étage coûteux). Coupe l'espace d'un ordre de grandeur, ne change rien au résultat. Non implémenté : à 200 fiches ce serait de l'optimisation prématurée.
2. **Remplacer la source de l'index** — index côté serveur, moteur dédié. `buildIndex` reçoit toujours un tableau ; ni le classement ni l'interface ne bougent. **C'est cette couture qui rend la boilerplate durable.**

---

## 9. La réutilisation

### 9.1 Ce qu'on remplace pour une autre affaire

Un fichier. Pour une épicerie :

```ts
export const shopSearchConfig: SearchConfig<Product> = {
  id: (p) => p.id,
  fields: [
    { key: 'name',     weight: 3,   get: (p) => p.name },
    { key: 'brand',    weight: 2,   get: (p) => p.brand },
    { key: 'category', weight: 1.5, get: (p) => p.category },
    { key: 'tags',     weight: 1,   get: (p) => p.tags },
  ],
  facets: [
    { key: 'category',     label: 'Rayon',        kind: 'term', get: (p) => p.category },
    { key: 'brand',        label: 'Marque',       kind: 'term', get: (p) => p.brand, sort: 'count' },
    { key: 'availability', label: 'Disponibilité',kind: 'term', get: (p) => p.inStock ? 'En stock' : 'Épuisé' },
  ],
  tiebreak: (a, b) => b.sales - a.sales,
}
```

Le noyau ne change pas d'une ligne. C'est la doctrine déjà en vigueur dans ce repo pour `orderedRefsInput` et `quickRefInput` : une fabrique, des instances qui n'apportent que leur requête et leurs libellés.

### 9.2 Les facettes par tranches — extension prévue, non livrée

Le prix appelle une facette `kind: 'range'` à paliers déclarés :

```ts
{ key: 'price', label: 'Prix', kind: 'range', get: (p) => p.price,
  buckets: [[0,5],[5,10],[10,20],[20,null]] }
```

Environ trente lignes dans `search.ts` (affectation d'une valeur à son palier, puis comptage identique aux facettes de termes). **Non implémentée : aucun consommateur.** On ne livre pas de code mort. La forme est écrite ici pour que l'extension soit mécanique.

### 9.3 Ce que la vitrine héritera, et ce qu'elle devra écrire

| Hérité tel quel | À écrire côté vitrine |
|---|---|
| Le noyau entier (`lib/search/`) | L'habillage : Tailwind au lieu de `@sanity/ui`. `ListSelector` du site (`components/site/ListSelector.tsx`) est le module de facette tout trouvé. |
| Le hook `useFacetedSearch` | La sérialisation de l'état vers l'URL — partageable, compatible retour navigateur. L'état est un objet plat, c'est déjà prêt. |
| Le slot de rendu d'un résultat | Une carte produit à la place de la vignette. |
| Le classement, les budgets d'erreur, les règles de facettes | Les facettes par tranches (§9.2), le tri par prix. |

⚠️ **Le chrome ne se partage pas entre les deux habillages.** Le Studio est en `@sanity/ui`, le site en Tailwind + tokens CSS. Prétendre partager des composants visuels entre les deux ferait rentrer le design system du Studio dans le site public, ou l'inverse. **Le moteur est commun, l'habillage ne l'est pas** — et c'est délibéré.

---

## 10. Capitalisation

Conformément au protocole (`resources/learning/README.md`) :

- **Note d'apprentissage** : `resources/learning/recherche-a-facettes-tolerante-aux-fautes.md` — les trois étages, la table de budget et pourquoi elle dépend de la longueur, le piège Levenshtein/Damerau, la règle du comptage de facette. Sans code.
- **Archive réutilisable** : `FREELANCE/RESOURCES/existing-components/faceted-fuzzy-search/` — le noyau complet, son script d'assertions, un `README` de branchement, et les deux configurations (photo + épicerie fictive) comme exemples de transposition.

---

## 11. Points laissés ouverts, hors chantier

Deux défauts de données que la recherche rendra visibles sans les corriger :

- **70 photos sur 200 n'ont aucune série.** Déjà remonté par la carte « Alertes qualité ».
- **`meshchersky park, russia`** subsiste en minuscules, seul de son groupe, alors que `Moscow, Russia` a été fusionné le 2026-08-25. `/archives` groupe sur égalité stricte de chaîne : c'est un groupe d'une photo sur le site public.
