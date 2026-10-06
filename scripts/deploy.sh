#!/usr/bin/env bash
# Checks .env for production, then builds and (re)starts the stack and waits
# until the API reports ready. Safe to re-run for every update:
#
#   git pull && ./scripts/deploy.sh
#
#   ./scripts/deploy.sh --check   # validate .env only, start nothing

source "$(dirname "$0")/lib.sh"

CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

errors=0
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; errors=$((errors + 1)); }

echo "Checking $ENV_FILE"

# --- database ---
pg_password="$(env_value POSTGRES_PASSWORD)"
if [ -z "$pg_password" ] || [ "$pg_password" = "change-me" ]; then
  fail "POSTGRES_PASSWORD is not set. Generate one: openssl rand -hex 24"
elif [ "${#pg_password}" -lt 16 ]; then
  fail "POSTGRES_PASSWORD is shorter than 16 characters."
elif [[ "$pg_password" == *[\;\"\']* ]]; then
  fail "POSTGRES_PASSWORD contains ; or a quote, which breaks the connection string."
else
  ok "POSTGRES_PASSWORD"
fi

# --- JWT ---
jwt_key="$(env_value JWT_SIGNING_KEY)"
if [ -z "$jwt_key" ] || [ "$jwt_key" = "replace-with-base64-64-bytes" ]; then
  fail "JWT_SIGNING_KEY is not set. Generate one: openssl rand -base64 64 | tr -d '\\n'"
elif [ "${#jwt_key}" -lt 32 ]; then
  fail "JWT_SIGNING_KEY must be at least 32 characters."
else
  ok "JWT_SIGNING_KEY"
fi

# --- app ---
if [ "$(env_value ASPNETCORE_ENVIRONMENT)" = "Development" ]; then
  fail "ASPNETCORE_ENVIRONMENT=Development must not be used in production."
fi
recommend() {
  if [ -n "$(env_value "$1")" ]; then ok "$1"; else warn "$1 is empty: $2"; fi
}
recommend ADMIN_EMAIL "nobody will be admin after the first login."
recommend GOOGLE_CLIENT_ID "only e-mail/password sign-in will work."
recommend SMTP_HOST "password reset and start reminders are disabled."

public_url="$(env_value PUBLIC_URL)"
profiles="$(env_value COMPOSE_PROFILES)"
domain="$(env_value DOMAIN)"

if [[ ",$profiles," == *",proxy,"* ]]; then
  if [ -z "$domain" ]; then
    fail "COMPOSE_PROFILES=proxy needs DOMAIN (e.g. quiz.example.com)."
  else
    ok "DOMAIN=$domain"
    [[ "$public_url" == "https://$domain" || "$public_url" == "https://$domain:"* ]] \
      || fail "PUBLIC_URL must be https://$domain (is: ${public_url:-empty})."
  fi
  [ "$(env_value TRUST_FORWARDED_HEADERS)" = "true" ] \
    || fail "TRUST_FORWARDED_HEADERS must be true behind Caddy, or every visitor shares one rate-limit bucket."
  [ "$(env_value WEB_BIND)" = "127.0.0.1" ] \
    || warn "WEB_BIND is not 127.0.0.1: port $(env_value WEB_PORT) also serves plain HTTP next to Caddy."
else
  warn "COMPOSE_PROFILES does not include 'proxy': no TLS. Fine behind your own proxy, not on the open internet."
  case "$public_url" in
    https://*) ok "PUBLIC_URL=$public_url" ;;
    *) warn "PUBLIC_URL is not https (${public_url:-empty}). Google Sign-In only works over https outside localhost." ;;
  esac
fi

[ "$errors" -eq 0 ] || die "$errors problem(s) in $ENV_FILE. Fix them and run again."
ok "$ENV_FILE looks ready for production"
$CHECK_ONLY && exit 0

command -v docker >/dev/null || die "docker is not installed."
docker compose version >/dev/null 2>&1 || die "The docker compose plugin is not installed."

echo
echo "Pulling base images and building"
compose pull --ignore-buildable --quiet
compose build --pull

echo
echo "Starting"
compose up -d --remove-orphans

echo
echo "Waiting for the API (migrations run on first start)"
if wait_healthy api 240; then
  ok "api healthy"
else
  compose logs --tail 80 api >&2
  die "The API did not become healthy. Logs above."
fi
if wait_healthy web 60; then ok "web healthy"; else warn "web is not healthy yet: docker compose logs web"; fi

compose ps
echo
if [[ ",$profiles," == *",proxy,"* ]]; then
  ok "OpenQuiz is up at https://$domain"
  info "The first visit can take a few seconds while Caddy obtains the certificate."
else
  ok "OpenQuiz is up at ${public_url:-http://localhost:$(env_value WEB_PORT)}"
fi
info "Schedule backups: see docs/DEPLOYMENT.md (scripts/backup.sh)."
