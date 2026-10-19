#!/bin/sh
# Nightly Postgres backup for the official Keres server (docker-compose.deploy.yml,
# `backup` service, postgres:16-alpine image: /bin/sh, pg_dump, find and busybox tools).
#
# Each run writes one compressed custom-format dump, then deletes daily dumps older
# than BACKUP_RETENTION_DAYS (default 30). The first successful dump of each calendar
# month (UTC) is also kept as a monthly copy, keres-monthly-YYYYMM.dump, and the newest
# BACKUP_MONTHLY_KEEP of those are kept (default 3, allowed 0 to 3). A monthly copy older
# than 93 days is removed too, after every dump attempt. The daily rotation never touches a
# monthly copy; a failed dump creates none, and only the 93-day limit acts on a failed run.
# The rotation is the privacy control the server's privacy policy promises: dumps may
# hold point-in-time copies of already-erased personal data until they rotate out.
#
# With the argument `once` it dumps and rotates a single time and exits - handy
# for a manual backup (`docker compose -f docker-compose.deploy.yml exec backup
# sh /deploy/backup.sh once`). Without it, it loops forever.
set -eu

: "${POSTGRES_DB:?POSTGRES_DB is not set}"
: "${POSTGRES_USER:?POSTGRES_USER is not set}"
: "${PGPASSWORD:?PGPASSWORD is not set (the deploy compose maps POSTGRES_PASSWORD to it)}"

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
MONTHLY_KEEP="${BACKUP_MONTHLY_KEEP:-3}"
# 93 days, in minutes, for find -mmin: a monthly copy older than this is removed whatever the dumps since did.
MONTHLY_MAX_AGE_MINUTES=133920
DB_HOST="${BACKUP_DB_HOST:-db}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

case "$MONTHLY_KEEP" in
  0 | 1 | 2 | 3) ;;
  *)
    echo "backup: BACKUP_MONTHLY_KEEP must be 0, 1, 2 or 3" >&2
    exit 1
    ;;
esac

mkdir -p "$BACKUP_DIR"

wait_for_db() {
  until pg_isready -h "$DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q; do
    echo "backup: waiting for Postgres at $DB_HOST..." >&2
    sleep 5
  done
}

# The first successful dump of a month is also kept as keres-monthly-YYYYMM.dump. It is
# a hard link to the daily dump when the volume allows one (no second copy of the data),
# else a copy written under a temporary name and renamed. Nothing is written over an
# existing monthly copy, and a daily rotation later only removes its own name.
keep_monthly() {
  daily="$1"
  month="$2"
  [ "$MONTHLY_KEEP" -gt 0 ] || return 0
  monthly="$BACKUP_DIR/keres-monthly-$month.dump"
  [ -e "$monthly" ] && return 0
  if ln "$daily" "$monthly" 2>/dev/null; then
    echo "backup: kept monthly copy $monthly"
  elif cp "$daily" "$monthly.tmp" && mv "$monthly.tmp" "$monthly"; then
    echo "backup: kept monthly copy $monthly"
  else
    rm -f "$monthly.tmp"
    echo "backup: could not write monthly copy $monthly" >&2
  fi
}

# Removes monthly copies older than 93 days, by file age. The hard link keeps the daily
# dump's own mtime and a copy gets the time it was made, so the age is the copy's age.
# This runs before every dump attempt, failed or not: an outage must not keep a monthly
# copy past the limit. It creates nothing.
expire_monthly() {
  expired="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'keres-monthly-[0-9][0-9][0-9][0-9][0-9][0-9].dump' -mmin +"$MONTHLY_MAX_AGE_MINUTES" -print -delete | wc -l)"
  echo "backup: removed $expired monthly copy(ies) older than 93 days"
}

# Keeps the newest BACKUP_MONTHLY_KEEP monthly copies. The names carry YYYYMM, so the
# newest sorts first. With BACKUP_MONTHLY_KEEP=0 every monthly copy is removed.
rotate_monthly() {
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'keres-monthly-[0-9][0-9][0-9][0-9][0-9][0-9].dump' -print \
    | sort -r | tail -n +"$((MONTHLY_KEEP + 1))" | while IFS= read -r old; do
      rm -f "$old"
      echo "backup: removed monthly copy $old"
    done
}

take_backup() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  file="$BACKUP_DIR/keres-$stamp.dump"
  expire_monthly
  if pg_dump -h "$DB_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "$file.tmp"; then
    mv "$file.tmp" "$file"
    echo "backup: wrote $file"
    # Monthly copies follow a good dump only. The month comes from the dump's own stamp.
    keep_monthly "$file" "$(printf '%s' "$stamp" | cut -c1-6)"
    rotate_monthly
  else
    echo "backup: pg_dump failed, keeping previous dumps" >&2
    rm -f "$file.tmp"
  fi
  # Daily rotation runs even when the dump fails: old copies must age out regardless.
  # The name pattern starts with a digit, so the monthly copies (keres-monthly-...) never match.
  # shellcheck disable=SC2086
  kept="$(find "$BACKUP_DIR" -maxdepth 1 -name 'keres-[0-9]*.dump' -mtime +"$RETENTION_DAYS" -print -delete | wc -l)"
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
