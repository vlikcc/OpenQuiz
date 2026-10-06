#!/usr/bin/env bash
# Per-boot reconciliation: bring up PostgreSQL (no systemd in the VM), make
# sure the openquiz role and database exist, and wait until it accepts
# connections so the app terminals start against a ready database.
# Idempotent: a running cluster and existing role/database are left alone.
set -euo pipefail

PG_PASSWORD="${POSTGRES_PASSWORD:-openquiz}"

if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  echo "==> Installing PostgreSQL"
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql >/dev/null
fi

echo "==> Starting PostgreSQL"
sudo service postgresql start >/dev/null

echo "==> Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then
    sudo -u postgres psql -qtAc "SELECT 1 FROM pg_roles WHERE rolname = 'openquiz'" | grep -q 1 \
      || sudo -u postgres psql -qc "CREATE ROLE openquiz LOGIN CREATEDB PASSWORD '${PG_PASSWORD}'"
    sudo -u postgres psql -qtAc "SELECT 1 FROM pg_database WHERE datname = 'openquiz'" | grep -q 1 \
      || sudo -u postgres createdb -O openquiz openquiz
    echo "==> PostgreSQL is ready"
    exit 0
  fi
  sleep 2
done

echo "!! PostgreSQL did not become ready in time" >&2
exit 1
