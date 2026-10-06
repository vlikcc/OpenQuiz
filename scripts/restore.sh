#!/usr/bin/env bash
# Restores a backup made by scripts/backup.sh into the running stack,
# replacing the current database (and, if given, the question images).
#
#   ./scripts/restore.sh backups/openquiz-db-20261006-031500.dump [backups/openquiz-media-20261006-031500.tgz]
#
# Add --yes to skip the confirmation prompt (for scripted restore drills).

source "$(dirname "$0")/lib.sh"

assume_yes=false
args=()
for a in "$@"; do
  [ "$a" = "--yes" ] && assume_yes=true || args+=("$a")
done

db_file="${args[0]:-}"
media_file="${args[1]:-}"
[ -n "$db_file" ] || die "Usage: $0 <openquiz-db-*.dump> [openquiz-media-*.tgz] [--yes]"
[ -f "$db_file" ] || die "$db_file not found."
[ -z "$media_file" ] || [ -f "$media_file" ] || die "$media_file not found."
[ "$(container_health db)" = "healthy" ] || die "The db container is not running/healthy."

compose exec -T db pg_restore --list < "$db_file" > /dev/null || die "$db_file is not a valid pg_dump archive."

if ! $assume_yes; then
  printf 'This REPLACES all OpenQuiz data in the %s stack with %s.\nType "restore" to continue: ' "$ENV_FILE" "$db_file"
  read -r answer
  [ "$answer" = "restore" ] || die "Cancelled."
fi

echo "Stopping the API so nothing writes during the restore"
compose stop api

# One transaction: if any object fails, the database is left as it was.
# shellcheck disable=SC2016  # the variables are the db container's own
compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction --exit-on-error' < "$db_file" \
  || { compose start api; die "Restore failed; the previous data is unchanged."; }
ok "database restored"

compose start api
wait_healthy api 180 || die "The API did not come back healthy: docker compose logs api"
ok "api healthy"

if [ -n "$media_file" ]; then
  compose exec -T api sh -c 'find /app/data/media -mindepth 1 -delete && tar xzf - -C /app/data' < "$media_file"
  ok "question images restored"
fi

ok "Restore complete"
