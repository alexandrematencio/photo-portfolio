# Déploiement — qui construit, qui sert

> Mis en place le 2026-08-22. Lis d'abord `CLAUDE.md §2.1`, qui porte la règle ;
> ce fichier porte le montage et le runbook.

## Le problème à connaître avant tout le reste

Le compte GitHub d'Alexandre est **verrouillé pour raison de facturation**.
Conséquence : aucun job GitHub Actions ne démarre sur ses repos —

```
The job was not started because your account is locked due to a billing issue.
```

Deux signaux disent le contraire et il ne faut pas les croire : le repo est
**public** (donc minutes Actions illimitées et gratuites) et
`GET /repos/{o}/{r}/actions/permissions` renvoie `enabled: true`. Le verrou est
au niveau du **compte**, en amont des deux. Vérifié sur un run réel, pas déduit.

## Ce qui, lui, fonctionne sous le verrou

Servir des fichiers déjà construits. Quand la branche `gh-pages` bouge, GitHub
lance sa propre plomberie (`pages-build-deployment`, event `dynamic`) : elle
apparaît dans l'onglet Actions mais n'est **pas** un workflow et ne consomme
aucune minute facturable. C'est la voie qui a toujours marché, et celle sur
laquelle tout le montage s'appuie.

Le partage est donc : **le calcul chez bfast, l'hébergement chez Alexandre.**

```
  repo du site (PUBLIC)                repo déployeur (chez bfast)
  alexandrematencio/photo-portfolio    bfastdev/amatencio-deploy
  ├── code + .env.production ──────────► checkout (lecture publique)
  │                                     │  npm ci && npm run build
  │                                     │  (aucune variable côté runner :
  │                                     │   .env.production porte tout)
  ├── branche gh-pages  ◄───────────────┘  push via clé de déploiement
  │        │
  │        └──► pages-build-deployment (interne GitHub, gratuit)
  └────────────► https://alexandrematencio.github.io/photo-portfolio/
```

**Le repo n'est PAS transféré.** Un transfert déplacerait l'URL publique avec le
propriétaire (`<owner>.github.io/photo-portfolio`) : canonicals, sitemap et
liens entrants cassés, pour un portfolio dont tout l'enjeu est d'être trouvé.
Seule la machine qui construit change.

## Runbook — à faire une fois

Le compte déployeur est **`bfastdev`** (compte utilisateur, vérifié existant).
Trois des quatre étapes le réclament, et l'agent ne l'a pas : sa session `gh`
est authentifiée en `alexandrematencio`.

> **Raccourci — état au 2026-08-22.** L'étape 1 est **faite** : la clé
> `160970399` est posée en read-write sur le repo du site, sa moitié privée est
> dans `~/.ssh/amatencio-gh-pages-deploy`. Les étapes 2 à 4 sont scriptées dans
> **`bootstrap-deployer.sh`**, à côté de ce fichier. Deux commandes :
>
> ```
> gh auth login --scopes "repo,workflow"   # en bfastdev
> ./docs/deploy/bootstrap-deployer.sh
> ```
>
> Le script est idempotent (il saute ce qui existe déjà), refuse de partir si le
> compte actif n'est pas `bfastdev` ou si le token n'a pas le scope `workflow`
> — sans lui, pousser un fichier dans `.github/workflows` est refusé — et se
> termine par la seule vérification qui prouve quelque chose : le SHA de
> `gh-pages` a bougé ET le canonical servi n'est pas `localhost`.
>
> Reviens à ton compte habituel après : `gh auth switch --user alexandrematencio`.
>
> Les étapes détaillées ci-dessous restent la référence — à lire si le script
> s'arrête, ou pour comprendre ce qu'il fait.

**1. Clé de déploiement.** Sur ta machine :

```
ssh-keygen -t ed25519 -N "" -f ~/.ssh/amatencio-gh-pages-deploy \
  -C "bfast-deployer → alexandrematencio/photo-portfolio (gh-pages)"
```

Pose la moitié **publique** sur le repo du site, en écriture :

```
gh repo deploy-key add ~/.ssh/amatencio-gh-pages-deploy.pub \
  --repo alexandrematencio/photo-portfolio \
  --title "bfast deployer (gh-pages)" --allow-write
```

Portée de cette clé : ce repo, et rien d'autre. Pas le compte. Révocation =
supprimer la clé dans Settings → Deploy keys.

**2. Repo déployeur, sous le compte bfast.**

```
gh auth login          # se connecter en bfast
gh repo create bfastdev/amatencio-deploy --private --clone
```

Privé : sur un compte gratuit, 2 000 minutes/mois, soit ~600 builds de 3 min.
Largement au-dessus du besoin.

**3. Le secret**, avec la moitié **privée** — elle ne doit apparaître nulle part
ailleurs :

```
gh secret set AMATENCIO_DEPLOY_KEY \
  --repo bfastdev/amatencio-deploy < ~/.ssh/amatencio-gh-pages-deploy
```

**4. Le workflow.** Copier `docs/deploy/bfast-deployer.yml` de ce repo vers
`.github/workflows/deploy.yml` du repo déployeur, commiter, pousser. Puis :

```
gh workflow run "Deploy AMATENCIO PHOTO" --repo bfastdev/amatencio-deploy
gh run watch --repo bfastdev/amatencio-deploy
```

Vérification (elle doit rendre l'URL github.io, jamais `localhost`) :

```
curl -s https://alexandrematencio.github.io/photo-portfolio/ \
  | grep -o '<link rel="canonical"[^>]*>'
```

## Publier au quotidien

| Voie | Commande | Quand |
|---|---|---|
| CI bfast | `gh workflow run "Deploy AMATENCIO PHOTO" --repo bfastdev/amatencio-deploy` | par défaut |
| Local, secours | `npm run deploy` | CI indisponible, ou build à inspecter |

Les deux produisent le même site : elles font le même `next build` et poussent
le même `out/` sur la même branche. La différence est la machine.

## L'étape d'après — « Publish » republie tout seul

Le workflow écoute déjà `repository_dispatch` (type `sanity-publish`). Il reste
à brancher un webhook Sanity dessus : au publish dans Studio, Sanity appelle
l'API GitHub, le site se reconstruit seul. C'est le vrai objectif — aujourd'hui
encore, une modification de contenu réclame que quelqu'un lance une commande.

**Ordre imposé** : le webhook n'a rien à appeler tant que le repo déployeur
n'existe pas. Donc bootstrap d'abord (ci-dessus), webhook ensuite.

**1. Un PAT `bfastdev`**, portée minimale, sur https://github.com/settings/tokens
— *fine-grained*, propriétaire `bfastdev`, **uniquement** le repo
`amatencio-deploy`, permission *Contents: read & write*. C'est ce que réclame
l'endpoint `dispatches`. Rien d'autre : ce jeton va vivre dans la config d'un
service tiers.

**2. Le webhook**, sur https://manage.sanity.io → projet `yh5i5diw` → **API** →
**Webhooks** → *Create webhook* :

| Champ | Valeur |
|---|---|
| Name | `Rebuild site (GitHub)` |
| URL | `https://api.github.com/repos/bfastdev/amatencio-deploy/dispatches` |
| Dataset | `production` |
| Trigger on | Create, Update, Delete |
| Filter | `!(_id in path("drafts.**"))` |
| Projection | `{"event_type":"sanity-publish"}` |
| HTTP method | `POST` |
| API version | `v2021-03-25` |
| Headers | `Authorization: Bearer <PAT>` et `Accept: application/vnd.github+json` |

Le **filtre** est la pièce qui compte : sans lui, chaque frappe au clavier dans
le Studio matérialise un draft et déclenche un build. Avec lui, seuls les
documents publiés passent — c'est-à-dire le bouton « Publish », et rien d'autre.
La rafale reste possible (publier trois documents d'affilée), et c'est le
`concurrency: cancel-in-progress` du workflow qui l'absorbe : seul le dernier
build va au bout.

**3. Vérifier**, une fois posé : publier n'importe quoi dans le Studio, puis

```
gh run list --repo bfastdev/amatencio-deploy --limit 3
```

Un run `repository_dispatch` doit apparaître dans les secondes qui suivent. Le
site en ligne suit ~3 min plus tard (build + `pages-build-deployment`).

**4. Le dire au Studio.** Les descriptions des champs éditoriaux
(`sanity/schemas/siteSettings.ts`) préviennent aujourd'hui que « Publish »
n'affecte pas le site en ligne sans redéploiement. Le jour où ce webhook tourne,
cette phrase devient fausse : la corriger fait partie de l'étape.

## Le jour où la facturation est régularisée

Rien n'oblige à défaire ce montage : il marche, il est gratuit, et il isole le
déploiement du compte client. Si tu veux quand même tout ramener chez
Alexandre : reprendre le workflow supprimé au commit `ac553ed`, basculer Pages
en `build_type: workflow` (`PUT /repos/{o}/{r}/pages`), supprimer la clé de
déploiement et le repo déployeur.
