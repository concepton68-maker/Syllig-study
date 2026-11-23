#!/usr/bin/env bash
# Installation / mise à jour de Syllig Study sur le VPS.
#   sudo ./deploy/install.sh study.syllig.com
# Idempotent : relancer le script met à jour l'application sans perdre de données.
set -euo pipefail
DOMAIN="${1:?Usage : sudo ./deploy/install.sh <domaine>  (ex. study.syllig.com)}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
CADDYFILE=/etc/caddy/Caddyfile
MARK="# syllig-study — ajouté par deploy/install.sh"
cd "$DIR"
[ "$(id -u)" = 0 ] || { echo "À lancer avec sudo."; exit 1; }
command -v docker >/dev/null || { echo "Docker est requis."; exit 1; }

echo "1/5 · Configuration"
if [ ! -f .env ]; then
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nAPP_PORT=8820\n' "$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)" > .env
  echo "   .env créé (mot de passe de base généré, à ne pas diffuser)."
else
  echo "   .env existant conservé."
fi
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2); PORT=${PORT:-8820}

echo "2/5 · Construction et démarrage des conteneurs (quelques minutes la première fois)"
export APP_VERSION="$(git -C "$DIR" rev-parse --short HEAD 2>/dev/null || echo archive)"
export APP_RELEASE="$(cat "$DIR/VERSION" 2>/dev/null || echo 0.00)"
export APP_STARTED="$(date -Is)"
# pas de --pull ni d'en-tête « syntax » : la construction n'a pas besoin de Docker Hub si l'image de base est déjà là
# (un incident DNS passager ne bloque plus la mise à jour) ; 3 essais en cas de coupure réseau
if [ "${SKIP_BUILD:-0}" != 1 ]; then
  for essai in 1 2 3; do docker compose build && break; [ "$essai" = 3 ] && exit 1; echo "   construction échouée, nouvel essai dans 30 s"; sleep 30; done
fi
docker compose up -d
for i in $(seq 1 60); do
  curl -fs -o /dev/null "http://127.0.0.1:${PORT}/connexion" 2>/dev/null && break
  sleep 3
  [ "$i" = 60 ] && { echo "L'application ne répond pas. Journal :"; docker compose logs --tail 50 app; exit 1; }
done
echo "   Application en ligne sur 127.0.0.1:${PORT}."

echo "3/5 · Caddy (${DOMAIN})"
if grep -qF "$MARK" "$CADDYFILE"; then
  echo "   Bloc déjà présent dans le Caddyfile : inchangé."
else
  cp -a "$CADDYFILE" "/etc/caddy/Caddyfile.avant-study"
  {
    echo ""
    echo "$MARK"
    echo "${DOMAIN} {"
    grep -q '(syllig_securite)' "$CADDYFILE" && echo "	import syllig_securite"
    echo "	encode gzip"
    echo "	reverse_proxy 127.0.0.1:${PORT}"
    echo "}"
  } >> "$CADDYFILE"
  if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    echo "   Bloc ajouté, Caddy rechargé (sauvegarde : /etc/caddy/Caddyfile.avant-study)."
  else
    cp -a "/etc/caddy/Caddyfile.avant-study" "$CADDYFILE"
    echo "   Configuration Caddy refusée : fichier d'origine restauré, aucun site touché."; exit 1
  fi
fi

echo "4/5 · Tâches automatiques : sauvegarde nocturne (3 h 17) et mises à jour depuis GitHub (toutes les 2 min)"
chmod +x deploy/backup.sh deploy/auto-update.sh
{
  echo "17 3 * * * root ${DIR}/deploy/backup.sh >> /var/log/syllig-study-backup.log 2>&1"
  if git -C "$DIR" remote get-url origin >/dev/null 2>&1; then
    echo "*/2 * * * * root ${DIR}/deploy/auto-update.sh ${DOMAIN}"
  fi
} > /etc/cron.d/syllig-study
chmod 644 /etc/cron.d/syllig-study

echo "5/5 · Vérification DNS"
IP=$(curl -fsS -4 https://api.ipify.org 2>/dev/null || true)
DNS=$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)
if [ -n "$IP" ] && [ "$DNS" = "$IP" ]; then
  echo "   ${DOMAIN} pointe bien vers ce serveur (${IP}) : le certificat HTTPS sera obtenu automatiquement."
else
  echo "   ⚠ ${DOMAIN} ne pointe pas (encore) vers ce serveur (${IP:-?}). Créez l'enregistrement DNS A ; Caddy obtiendra le certificat ensuite, sans autre action."
fi

echo
VERSION="v${APP_RELEASE} · $(git -C "$DIR" log -1 --format='%h · %s' 2>/dev/null || echo "archive")"
USERS=$(docker compose exec -T db psql -U syllig -tAc "select count(*) from users" 2>/dev/null || echo 0)
echo "Terminé. Version installée : ${VERSION}"
if [ "${USERS:-0}" = "0" ]; then
  echo "Aucun compte pour l'instant. Créez-les (voir docs/INSTALLATION.md) :"
  echo "  cd ${DIR} && sudo docker compose exec app node scripts/create-user.mjs admin"
  echo "  cd ${DIR} && sudo docker compose exec app node scripts/create-user.mjs family"
else
  echo "Comptes existants conservés (${USERS}). Site : https://${DOMAIN}"
fi
