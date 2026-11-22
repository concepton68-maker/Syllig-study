#!/usr/bin/env bash
# Mise à jour automatique depuis GitHub (lancée par cron toutes les 2 minutes).
# Ne fait rien s'il n'y a pas de nouvelle version. En cas d'échec, revient à la version précédente.
set -uo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${1:?domaine attendu}"
LOG=/var/log/syllig-study-deploy.log
exec 9>/var/lock/syllig-study-deploy.lock
flock -n 9 || exit 0                      # une seule mise à jour à la fois
cd "$DIR"
git fetch -q origin main || { echo "$(date -Is) fetch impossible" >> "$LOG"; exit 0; }
NEW=$(git rev-parse origin/main); CUR=$(git rev-parse HEAD)
[ "$NEW" = "$CUR" ] && exit 0
FAILED="$DIR/.deploy-failed"                # version déjà tentée sans succès : on attend la suivante
[ -f "$FAILED" ] && [ "$(cat "$FAILED")" = "$NEW" ] && exit 0
{
  echo "=== $(date -Is) mise à jour ${CUR:0:7} → ${NEW:0:7} : $(git log -1 --format=%s "$NEW")"
  # filet de sécurité : sauvegarde de la base et image de la version en place
  ./deploy/backup.sh || echo "(sauvegarde préalable impossible)"
  docker image tag syllig-study:latest syllig-study:precedente 2>/dev/null || true
  git reset -q --hard "$NEW"
  if ./deploy/install.sh "$DOMAIN"; then
    rm -f "$FAILED"
    echo "=== $(date -Is) OK : version ${NEW:0:7} en ligne"
  else
    echo "$NEW" > "$FAILED"
    echo "=== $(date -Is) ÉCHEC : retour à la version ${CUR:0:7} (la version ${NEW:0:7} ne sera pas retentée)"
    git reset -q --hard "$CUR"
    # on remet l'image qui tournait, sans reconstruire
    docker image tag syllig-study:precedente syllig-study:latest 2>/dev/null || true
    SKIP_BUILD=1 ./deploy/install.sh "$DOMAIN" || echo "=== $(date -Is) ATTENTION : la version précédente n'a pas redémarré"
  fi
} >> "$LOG" 2>&1
