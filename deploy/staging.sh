#!/usr/bin/env bash
# Retrait du site d'essai (décision du propriétaire, 25/11/2026) : supprime, s'il existe, tout ce que l'ancienne version
# de ce script avait installé à côté du site des élèves. Idempotent et rapide quand il n'y a plus rien à retirer.
# Le site des élèves (projet « syllig-study », port 8820, sa base) n'est JAMAIS touché.
set -uo pipefail
PROD="$(cd "$(dirname "$0")/.." && pwd)"
E="${PROD}-essai"
LOG=/var/log/syllig-study-essai.log
CADDYFILE=/etc/caddy/Caddyfile
MARK="# syllig-study ESSAI"
exec 8>/var/lock/syllig-study-essai.lock
flock -n 8 || exit 0
HAS_CT=$(docker ps -a --filter "label=com.docker.compose.project=syllig-essai" -q 2>/dev/null | head -1)
HAS_VOL=$(docker volume ls -q --filter "label=com.docker.compose.project=syllig-essai" 2>/dev/null | head -1)
HAS_IMG=$(docker image ls -q syllig-study:essai 2>/dev/null | head -1)
[ -z "$HAS_CT" ] && [ -z "$HAS_VOL" ] && [ -z "$HAS_IMG" ] && [ ! -e "$E" ] && ! grep -qF "$MARK" "$CADDYFILE" 2>/dev/null && exit 0
{
  echo "=== $(date -Is) retrait du site d'essai"
  # conteneurs et base de l'essai (projet compose séparé « syllig-essai »)
  if [ -n "$HAS_CT" ] || [ -n "$HAS_VOL" ]; then
    if [ -f "$E/docker-compose.yml" ]; then (cd "$E" && docker compose -p syllig-essai down -v --remove-orphans)
    else docker ps -a --filter "label=com.docker.compose.project=syllig-essai" -q | xargs -r docker rm -f
         docker volume ls -q --filter "label=com.docker.compose.project=syllig-essai" | xargs -r docker volume rm; fi
    docker network ls -q --filter "label=com.docker.compose.project=syllig-essai" | xargs -r docker network rm
  fi
  [ -n "$HAS_IMG" ] && docker image rm syllig-study:essai
  # copie de travail de l'essai
  if [ -e "$E" ]; then git -C "$PROD" worktree remove --force "$E" 2>/dev/null || rm -rf "$E"; git -C "$PROD" worktree prune; fi
  # bloc Caddy de l'essai (de la ligne repère jusqu'à la accolade fermante qui suit)
  if grep -qF "$MARK" "$CADDYFILE" 2>/dev/null; then
    cp -a "$CADDYFILE" /etc/caddy/Caddyfile.avant-retrait-essai
    awk -v m="$MARK" 'index($0, m) == 1 { skip = 1; next } skip && /^}/ { skip = 0; next } !skip' /etc/caddy/Caddyfile.avant-retrait-essai > "$CADDYFILE"
    if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then systemctl reload caddy; echo "Caddy : bloc de l'essai retiré"
    else cp -a /etc/caddy/Caddyfile.avant-retrait-essai "$CADDYFILE"; echo "Caddy : retrait refusé par la validation, fichier d'origine remis"; fi
  fi
  echo "=== $(date -Is) site d'essai retiré"
} >> "$LOG" 2>&1
