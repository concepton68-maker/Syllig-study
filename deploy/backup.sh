#!/usr/bin/env bash
# Export complet de la base Syllig Study, compressé ; 30 jours conservés.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$DIR/backups" && chmod 700 "$DIR/backups"
F="$DIR/backups/syllig-study-$(date +%Y-%m-%d_%H%M).sql.gz"
docker compose -f "$DIR/docker-compose.yml" exec -T db pg_dump -U syllig --clean --if-exists syllig | gzip > "$F"
find "$DIR/backups" -name 'syllig-study-*.sql.gz' -mtime +30 -delete
echo "$(date -Is) sauvegarde OK : $F ($(du -h "$F" | cut -f1))"
