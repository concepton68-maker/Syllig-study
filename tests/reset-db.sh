#!/usr/bin/env bash
# Recrée une base de test propre (comptes de test inclus). Usage : DATABASE_URL=… tests/reset-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DATABASE_URL##*/}
for i in 1 2 3 4 5; do
  sudo -u postgres psql -qc "drop database if exists $DB with (force);" -c "create database $DB owner syllig;" 2>/dev/null || true
  sudo -u postgres psql -tAc "select 1 from pg_database where datname = '$DB'" | grep -q 1 && break
  sleep 1
done
node scripts/migrate.mjs >/dev/null && SEED_SANS_BIBLIOTHEQUE=1 node scripts/seed.mjs >/dev/null
node scripts/create-user.mjs admin --login admin@test.local --name "Admin" --password 'admin-test-1234' >/dev/null
node scripts/create-user.mjs family --parent-login parent@test.local --parent-name "Parent" --parent-password 'parent-test-1234' \
  --student-first-name "Léa" --student-login lea --student-password 'lea-test-1234' >/dev/null
echo "Base de test prête."
