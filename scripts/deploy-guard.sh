#!/usr/bin/env bash
# Garde-fou de `npm run deploy` / `deploy:blog` (voie de SECOURS, audit 1.4).
#
# Ces deux scripts rsyncent un build LOCAL vers /srv/www, sans passer par la
# chaîne du VPS (commit signé vérifié, build en `builder`). On ne les autorise
# donc que si ce qui part est exactement `origin/main` : arbre propre, HEAD égal
# à la branche distante. Sinon, une branche non fusionnée ou une modif non
# committée partirait en ligne, puis disparaîtrait au Publish suivant.
set -euo pipefail

# Fichiers non suivis compris : un `app/**/page.tsx` jamais committé
# partirait sinon en ligne par cette voie (audit de référence, 2026-11-08).
# Les fichiers ignorés (.env.local, out/, docs/SECURITY.md…) ne comptent pas.
if [ -n "$(git status --porcelain)" ]; then
  echo "deploy refusé : modifications non committées ou fichiers non suivis." >&2
  git status --short >&2
  exit 1
fi

git fetch --quiet origin main
head=$(git rev-parse HEAD)
main=$(git rev-parse origin/main)
if [ "$head" != "$main" ]; then
  echo "deploy refusé : HEAD ($(git rev-parse --short HEAD)) ≠ origin/main ($(git rev-parse --short origin/main))." >&2
  echo "Fusionner et pousser dans main d'abord ; le Publish ou rebuild-photo.sh suffit alors." >&2
  exit 1
fi
