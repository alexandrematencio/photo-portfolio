#!/usr/bin/env bash
#
# SAUVEGARDE DES FICHIERS MAINTENEUR (gitignorés)
# ===============================================
#
# Ce que ce script protège : tout ce qui vit dans le dépôt sans être versionné —
# brand book, CLAUDE.md, guidelines, skill Sanity, masters du splashscreen,
# captures, photos sources, jetons Sanity. Rien de tout ça ne revient d'un
# `git clone` : ces fichiers n'existent que sur cette machine.
#
# CE CONTRE QUOI IL PROTÈGE VRAIMENT
# ----------------------------------
#   ✔ `git clean -fdx`               — la commande qui les efface tous, sans confirmation
#   ✔ un clone frais du dépôt        — ils n'y sont simplement pas
#   ✔ la suppression du dossier projet
#   ✔ un `git pull` qui ÉCRASE un fichier ignoré (cas réel, vérifié : si quelqu'un
#     commite un fichier au chemin d'un fichier ignoré en local, git le remplace
#     SANS RIEN DIRE — là où un fichier simplement non suivi ferait échouer le merge)
#
#   ✘ la perte du disque. La copie est sur le MÊME disque que la source. Pour une
#     vraie redondance il faut que la destination parte ailleurs (disque externe,
#     Drive, Time Machine) — cette machine n'a pas d'iCloud Drive actif.
#
# MIROIR SANS PERTE
# -----------------
# `--delete` fait de la destination un miroir exact de la source. Mais un miroir
# nu propage aussi les SUPPRESSIONS : effacer un fichier par erreur, lancer la
# sauvegarde, et la copie de secours disparaît avec l'original. D'où
# `--backup-dir` : tout ce que le miroir retire est déposé dans `_attic/<date>`
# au lieu d'être détruit. La destination reste donc un miroir fidèle, et rien
# n'est jamais réellement perdu.
#
# Usage :  npm run backup       (ou  bash scripts/backup-client-files.sh)

set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${CLIENT_FILES_DIR:-$HOME/Documents/FREELANCE/client-files/AMATENCIO-PHOTO}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"

# Chemins sauvegardés. Tous gitignorés, tous écrits à la main : c'est le critère.
# Ce qui se régénère (node_modules, .next, out, next-env.d.ts, tsbuildinfo) n'a
# rien à faire ici — ça ne ferait qu'alourdir et vieillir.
ITEMS=(
  "brand"                 # ★ le brand book — source de vérité visuelle
  "CLAUDE.md"             # ★ les règles techniques du projet
  "doc"                   # guidelines, référence HTML
  ".claude"               # skill sanity-studio + réglages locaux
  "resources"             # carnets d'apprentissage, .pen, masters splashscreen
  "screens"               # captures de référence
  "portfolio"             # photos sources (les originaux, pas les dérivés Sanity)
  "yml-deploy-guide.md"
  ".env.local"            # ⚠️ jetons Sanity en clair — cf. le README de la destination
)

mkdir -p "$DEST"

echo "→ source      : $SRC"
echo "→ destination : $DEST"
echo

present=()
for item in "${ITEMS[@]}"; do
  if [ -e "$SRC/$item" ]; then
    present+=("$item")
  else
    echo "   (absent, ignoré) $item"
  fi
done

for item in "${present[@]}"; do
  rsync -a --delete \
    --backup --backup-dir="$DEST/_attic/$STAMP" \
    --exclude '.DS_Store' \
    "$SRC/$item" "$DEST/$(dirname "$item")/" 2>/dev/null || \
  rsync -a --delete \
    --backup --backup-dir="$DEST/_attic/$STAMP" \
    --exclude '.DS_Store' \
    "$SRC/$item" "$DEST/"
  printf "   ✔ %s\n" "$item"
done

# Trace de la dernière exécution : sans elle, impossible de savoir en regardant
# le dossier si la sauvegarde date d'hier ou de trois mois.
{
  echo "Dernière sauvegarde : $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Source              : $SRC"
  echo "Branche git         : $(git -C "$SRC" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  echo "Commit              : $(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo '?')"
  echo "Éléments            : ${present[*]}"
} > "$DEST/DERNIERE-SAUVEGARDE.txt"

echo
echo "✔ Terminé — $(du -sh "$DEST" 2>/dev/null | cut -f1) dans $DEST"
# ⚠️ Sous `set -e`, un `[ … ] && echo` en DERNIÈRE ligne fait sortir le script en
# code 1 quand le test est faux — donc à chaque sauvegarde sans rien à archiver,
# c'est-à-dire le cas normal. Un `if` explicite ne renvoie pas le résultat du test.
if [ -d "$DEST/_attic" ]; then
  echo "  (_attic/ garde ce que les miroirs successifs ont retiré — à vider à la main quand tu es sûr)"
fi
