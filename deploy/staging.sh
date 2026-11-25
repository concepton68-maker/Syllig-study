#!/usr/bin/env bash
# Site d’essai (« essai.<domaine> ») : même serveur, conteneurs et base SÉPARÉS du site des élèves.
# - suit la branche GitHub « essai » : chaque nouveau commit y est mis en ligne en 2 minutes, sans toucher au site réel ;
# - sa base est une copie des vraies données (à la création, puis chaque nuit vers 4 h) : on teste sur du réel sans rien abîmer ;
# - l’IA y est désactivée (aucun envoi, aucun coût) et un bandeau « Site d’essai » s’affiche partout.
# Lancé en arrière-plan par deploy/auto-update.sh ; ne fait rien tant que la branche « essai » n’existe pas.
set -uo pipefail
PROD="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="${1:?domaine du site d’essai attendu}"
E="${PROD}-essai"
LOG=/var/log/syllig-study-essai.log
PORT=8821
exec 8>/var/lock/syllig-study-essai.lock
flock -n 8 || exit 0
cd "$PROD"
git fetch -q origin essai 2>/dev/null || exit 0
NEW=$(git rev-parse origin/essai)
FIRST=
if [ ! -d "$E/.git" ] && [ ! -f "$E/.git" ]; then git worktree prune; git worktree add -q --detach "$E" "$NEW" >> "$LOG" 2>&1 || exit 0; FIRST=1; fi
CUR=$(git -C "$E" rev-parse HEAD)
TODAY=$(date +%F)
NIGHT=; [ "$(date +%H)" = 04 ] && [ ! -f "$E/.copie-$TODAY" ] && NIGHT=1
[ "$NEW" = "$CUR" ] && [ -z "$FIRST" ] && [ -z "$NIGHT" ] && [ ! -f "$E/.recharger" ] && exit 0
{
  echo "=== $(date -Is) site d’essai ${CUR:0:7} → ${NEW:0:7}"
  git -C "$E" reset -q --hard "$NEW"
  cd "$E"
  if [ ! -f .env ]; then
    umask 077
    printf 'COMPOSE_PROJECT_NAME=syllig-essai\nPOSTGRES_PASSWORD=%s\nAPP_PORT=%s\nAPP_IMAGE=syllig-study:essai\nSITE_ESSAI=1\n' \
      "$(head -c 32 /dev/urandom | base64 | tr -dc ’A-Za-z0-9’ | head -c 32)" "$PORT" > .env
  fi
  export APP_VERSION="$(git rev-parse --short HEAD)" APP_RELEASE="$(cat VERSION 2>/dev/null || echo 0.00)-essai" APP_STARTED="$(date -Is)"
  docker compose -p syllig-essai build && docker compose -p syllig-essai up -d || { echo "ÉCHEC de construction du site d’essai (le site réel n’est pas touché)"; exit 1; }
  # copie des vraies données : à la création, chaque nuit, ou sur demande (fichier .recharger)
  if [ -n "$FIRST" ] || [ -n "$NIGHT" ] || [ -f .recharger ]; then
    [ -n "$FIRST" ] && "$PROD/deploy/backup.sh"
    B=$(ls -t "$PROD"/backups/syllig-study-*.sql.gz 2>/dev/null | head -1)
    if [ -n "$B" ]; then
      for i in $(seq 1 30); do docker compose -p syllig-essai exec -T db pg_isready -U syllig -d syllig >/dev/null 2>&1 && break; sleep 2; done
      gunzip -c "$B" | docker compose -p syllig-essai exec -T db psql -q -U syllig -d syllig >/dev/null && echo "données réelles copiées depuis $(basename "$B")"
      docker compose -p syllig-essai restart app      # migrations de la branche « essai » rejouées sur la copie
      rm -f .recharger .copie-*; touch ".copie-$TODAY"
    fi
  fi
  for i in $(seq 1 60); do curl -fs -o /dev/null "http://127.0.0.1:${PORT}/connexion" && break; sleep 3; done
  # Caddy : bloc ajouté une seule fois (le site réel n’est jamais modifié)
  CADDYFILE=/etc/caddy/Caddyfile; MARK="# syllig-study ESSAI — ajouté par deploy/staging.sh"
  if ! grep -qF "$MARK" "$CADDYFILE"; then
    cp -a "$CADDYFILE" /etc/caddy/Caddyfile.avant-essai
    SEC=""; grep -q '(syllig_securite)' "$CADDYFILE" && SEC="	import syllig_securite"
    printf '\n%s\n%s {\n%s\n\theader X-Robots-Tag "noindex, nofollow"\n\tencode gzip\n\treverse_proxy 127.0.0.1:%s\n}\n' "$MARK" "$DOMAIN" "$SEC" "$PORT" >> "$CADDYFILE"
    if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then systemctl reload caddy; echo "Caddy : ${DOMAIN} ajouté"
    else cp -a /etc/caddy/Caddyfile.avant-essai "$CADDYFILE"; echo "Caddy : bloc refusé, fichier d’origine restauré"; fi
  fi
  echo "=== $(date -Is) site d’essai en ligne : https://${DOMAIN} (version ${NEW:0:7})"
} >> "$LOG" 2>&1
