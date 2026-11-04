#!/usr/bin/env bash
# Garde-fou de `npm run deploy` / `deploy:blog` (voie de SECOURS, audit 1.4).
#
# Ces deux scripts rsyncent un build LOCAL vers /srv/www, sans passer par la
# chaîne du VPS (commit signé vérifié, build en `builder`). On ne les autorise
# donc que si ce qui part est exactement `origin/main` : arbre propre, HEAD égal
# à la branche distante. Sinon, une branche non fusionnée ou une modif non
# committée partirait en ligne, puis disparaîtrait au Publish suivant.
set -euo pipefail

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "deploy refusé : modifications non committées." >&2
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
