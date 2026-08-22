#!/usr/bin/env bash
# Montage du repo déployeur bfast — à lancer UNE fois, après
#   gh auth login --scopes "repo,workflow"    (en bfastdev)
#
# Idempotent : chaque étape déjà faite est détectée et sautée.
# Aucun secret n'est écrit dans ce fichier : la clé privée est lue depuis ~/.ssh.
set -euo pipefail

SITE_REPO="alexandrematencio/photo-portfolio"
DEPLOY_REPO="bfastdev/amatencio-deploy"
KEY="$HOME/.ssh/amatencio-gh-pages-deploy"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bfast-deployer.yml"
LIVE="https://alexandrematencio.github.io/photo-portfolio/"

say() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ── 0. Garde-fous ────────────────────────────────────────────────────────────
ACTIVE="$(gh api user --jq .login 2>/dev/null || true)"
[ "$ACTIVE" = "bfastdev" ] || die "Compte gh actif = « ${ACTIVE:-aucun} », attendu « bfastdev ».
  Lance d'abord :  gh auth login --scopes \"repo,workflow\"
  (ou, si le compte est déjà connu de gh :  gh auth switch --user bfastdev)"

gh auth status 2>&1 | grep -q "'workflow'" \
  || die "Le token bfastdev n'a pas le scope « workflow » — pousser un fichier
  dans .github/workflows sera refusé.  gh auth refresh --scopes workflow"

[ -f "$KEY" ] || die "Clé privée introuvable : $KEY"
[ -f "$SRC" ] || die "Workflow de référence introuvable : $SRC"

# ── 1. Repo déployeur ────────────────────────────────────────────────────────
if gh repo view "$DEPLOY_REPO" >/dev/null 2>&1; then
  say "Repo $DEPLOY_REPO — déjà là."
else
  say "Création de $DEPLOY_REPO (privé)"
  gh repo create "$DEPLOY_REPO" --private \
    --description "Construit et publie alexandrematencio/photo-portfolio (le calcul chez bfast, l'hébergement chez Alexandre)"
fi

# ── 2. Secret = moitié privée de la clé de déploiement ───────────────────────
say "Secret AMATENCIO_DEPLOY_KEY"
gh secret set AMATENCIO_DEPLOY_KEY --repo "$DEPLOY_REPO" < "$KEY"

# ── 3. Workflow ──────────────────────────────────────────────────────────────
say "Envoi du workflow"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git clone --quiet "https://github.com/$DEPLOY_REPO.git" "$TMP/repo" 2>/dev/null || {
  git init --quiet -b main "$TMP/repo"
  git -C "$TMP/repo" remote add origin "https://github.com/$DEPLOY_REPO.git"
}
mkdir -p "$TMP/repo/.github/workflows"
cp "$SRC" "$TMP/repo/.github/workflows/deploy.yml"
cat > "$TMP/repo/README.md" <<'MD'
# amatencio-deploy

Construit `alexandrematencio/photo-portfolio` et pousse le résultat sur sa
branche `gh-pages`. Le repo, GitHub Pages et l'URL publique restent chez
Alexandre ; seule la machine qui construit vit ici — son compte GitHub est
verrouillé pour raison de facturation, donc aucun job Actions n'y démarre.

Source de vérité du workflow : `docs/deploy/bfast-deployer.yml` dans le repo du
site. Toute modification s'y fait d'abord, puis se recopie ici.
Montage et runbook : `docs/deploy/README.md`, même repo.
MD
git -C "$TMP/repo" add -A
if git -C "$TMP/repo" diff --cached --quiet 2>/dev/null; then
  echo "  (rien de neuf à pousser)"
else
  git -C "$TMP/repo" -c user.name="bfast deployer" -c user.email="aymeric@bfast.dev" \
      commit --quiet -m "ci: workflow de publication AMATENCIO PHOTO"
  git -C "$TMP/repo" push --quiet -u origin HEAD:main
fi

# ── 4. Premier run ───────────────────────────────────────────────────────────
say "Lancement du build"
BEFORE="$(gh api "repos/$SITE_REPO/commits/gh-pages" --jq .sha)"
gh workflow run "Deploy AMATENCIO PHOTO" --repo "$DEPLOY_REPO"
sleep 6
gh run watch --repo "$DEPLOY_REPO" --exit-status \
  "$(gh run list --repo "$DEPLOY_REPO" --limit 1 --json databaseId --jq '.[0].databaseId')"

# ── 5. Vérification : c'est bien le CI qui a publié ──────────────────────────
say "Vérification"
AFTER="$(gh api "repos/$SITE_REPO/commits/gh-pages" --jq .sha)"
[ "$BEFORE" != "$AFTER" ] || die "gh-pages n'a pas bougé ($BEFORE) — le push du CI a échoué."
echo "  gh-pages : ${BEFORE:0:7} → ${AFTER:0:7}"
echo "  auteur   : $(gh api "repos/$SITE_REPO/commits/$AFTER" --jq '.commit.author.name')"
sleep 45
CANON="$(curl -s "$LIVE" | grep -o '<link rel="canonical"[^>]*>' || true)"
echo "  canonical: $CANON"
case "$CANON" in
  *localhost*) die "Canonical en localhost — .env.production n'a pas été pris au build." ;;
  *alexandrematencio.github.io*) printf '\n\033[32m✓ Le site servi vient du CI bfast.\033[0m\n' ;;
  *) die "Canonical inattendu." ;;
esac
