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

## L'étape d'après — l'autonomie d'Alexandre

Le workflow écoute déjà `repository_dispatch` (type `sanity-publish`). Il reste
à brancher un webhook Sanity dessus : au publish dans Studio, Sanity appelle
l'API GitHub, le site se reconstruit seul. C'est le vrai objectif — aujourd'hui
encore, une modification de contenu réclame que quelqu'un lance une commande.

## Le jour où la facturation est régularisée

Rien n'oblige à défaire ce montage : il marche, il est gratuit, et il isole le
déploiement du compte client. Si tu veux quand même tout ramener chez
Alexandre : reprendre le workflow supprimé au commit `ac553ed`, basculer Pages
en `build_type: workflow` (`PUT /repos/{o}/{r}/pages`), supprimer la clé de
déploiement et le repo déployeur.
