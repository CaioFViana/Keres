#!/bin/sh
# Nightly Postgres backup for the official Keres server (docker-compose.deploy.yml,
# `backup` service, postgres:16-alpine image: /bin/sh, pg_dump and find only).
#
# Each run writes one compressed custom-format dump, then deletes dumps older
# than BACKUP_RETENTION_DAYS. The rotation is the privacy control the server's
# privacy policy promises: dumps may hold point-in-time copies of already-erased
# personal data until they rotate out.
#
# With the argument `once` it dumps and rotates a single time and exits - handy
# for a manual backup (`docker compose -f docker-compose.deploy.yml exec backup
# sh /deploy/backup.sh once`). Without it, it loops forever.
set -eu

: "${POSTGRES_DB:?POSTGRES_DB is not set}"
: "${POSTGRES_USER:?POSTGRES_USER is not set}"
: "${PGPASSWORD:?PGPASSWORD is not set (the deploy compose maps POSTGRES_PASSWORD to it)}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-90}"
DB_HOST="${BACKUP_DB_HOST:-db}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

mkdir -p "$BACKUP_DIR"

wait_for_db() {
  until pg_isready -h "$DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q; do
    echo "backup: waiting for Postgres at $DB_HOST..." >&2
    sleep 5
  done
}

take_backup() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="$BACKUP_DIR/keres-$stamp.dump"
  if pg_dump -h "$DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "backup: wrote $file"
  else
    echo "backup: pg_dump failed, keeping previous dumps" >&2
    rm -f "$file.tmp"
  fi
  # Rotation runs even when the dump fails: old copies must age out regardless.
  # shellcheck disable=SC2086
  kept="$(find "$BACKUP_DIR" -maxdepth 1 -name 'keres-*.dump' -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
  echo "backup: rotated out $kept dump(s) older than $RETENTION_DAYS days"
}

wait_for_db
take_backup

if [ "${1:-}" = "once" ]; then
  exit 0
fi

while true; do
  sleep "$INTERVAL_SECONDS"
  take_backup
done
