# shellcheck shell=bash
# Shared helpers for the operator scripts. Sourced, not executed.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ENV_FILE lets a second stack (staging, a restore drill) run from the same checkout.
ENV_FILE="${ENV_FILE:-.env}"

die()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
warn() { printf '\033[33m! %s\033[0m\n' "$*" >&2; }
ok()   { printf '\033[32m✓ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found. Start from the template: cp .env.example .env"

# Reads KEY from the env file the way Compose does (last assignment wins,
# surrounding quotes stripped). The file is not sourced: Compose syntax is not
# shell syntax, and a password with a $ in it would be mangled.
env_value() {
  local line
  line="$(grep -E "^[[:space:]]*$1=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%\"}"; line="${line#\"}"
  line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}

compose() { docker compose --env-file "$ENV_FILE" "$@"; }

container_health() {
  local id
  id="$(compose ps -q "$1" 2>/dev/null || true)"
  [ -n "$id" ] || { echo "missing"; return; }
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

wait_healthy() {
  local service="$1" timeout="${2:-180}" waited=0 status
  while :; do
    status="$(container_health "$service")"
    [ "$status" = "healthy" ] && return 0
    [ "$waited" -ge "$timeout" ] && return 1
    sleep 3; waited=$((waited + 3))
  done
}
