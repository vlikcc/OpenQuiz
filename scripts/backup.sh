#!/usr/bin/env bash
# Writes a consistent PostgreSQL dump plus an archive of the uploaded question
# images to BACKUP_DIR, then prunes files older than BACKUP_RETENTION_DAYS.
# The stack keeps serving while it runs. Meant for cron:
#
#   15 3 * * * /opt/openquiz/scripts/backup.sh >> /var/log/openquiz-backup.log 2>&1

source "$(dirname "$0")/lib.sh"

backup_dir="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"
backup_dir="${backup_dir:-./backups}"
retention="$(env_value BACKUP_RETENTION_DAYS)"
retention="${retention:-14}"

# Dumps hold password hashes and every participant name.
umask 077
mkdir -p "$backup_dir"

stamp="$(date -u +%Y%m%d-%H%M%S)"
db_file="$backup_dir/openquiz-db-$stamp.dump"
media_file="$backup_dir/openquiz-media-$stamp.tgz"

[ "$(container_health db)" = "healthy" ] || die "The db container is not running/healthy."

echo "[$(date -u +%FT%TZ)] Backing up to $backup_dir"

# Custom format: compressed, and pg_restore can restore it selectively.
# Written under a temporary name so a failed run never leaves a file that
# looks like a good backup.
# Single quotes on purpose: the variables are the db container's own.
# shellcheck disable=SC2016
compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner' > "$db_file.part"
# A truncated dump fails to list; catch that now rather than on restore day.
compose exec -T db pg_restore --list < "$db_file.part" > /dev/null \
  || { rm -f "$db_file.part"; die "The dump did not verify; nothing was kept."; }
mv "$db_file.part" "$db_file"
ok "database → $db_file ($(du -h "$db_file" | cut -f1))"

if [ "$(container_health api)" = "healthy" ]; then
  compose exec -T api tar czf - -C /app/data media > "$media_file.part"
  mv "$media_file.part" "$media_file"
  ok "media    → $media_file ($(du -h "$media_file" | cut -f1))"
else
  warn "api is not running; question images were not backed up."
fi

pruned="$(find "$backup_dir" -maxdepth 1 -type f -name 'openquiz-*' -mtime +"$retention" -print -delete | wc -l | tr -d ' ')"
if [ "$pruned" -gt 0 ]; then info "pruned $pruned file(s) older than $retention days"; fi

echo "[$(date -u +%FT%TZ)] Done. Copy $backup_dir off this server too."
