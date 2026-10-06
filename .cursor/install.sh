#!/usr/bin/env bash
# Idempotent dependency refresh for the OpenQuiz stack.
# Runs after the repository is checked out. System toolchains (.NET SDK,
# Node.js) come from the base environment and PostgreSQL is installed by
# start.sh if missing; this script only
# restores source-derived dependencies.
set -euo pipefail

export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Restoring backend (.NET) packages"
dotnet restore "$ROOT/backend/OpenQuiz.slnx"

echo "==> Installing frontend (npm) packages"
cd "$ROOT/frontend"
npm ci --no-audit --no-fund

# The frontend reads the API base URL from a gitignored .env at dev time.
# Point it at the locally running API. Created only if absent so local
# customizations are preserved.
if [ ! -f "$ROOT/frontend/.env" ]; then
  echo "==> Creating frontend/.env (Vite -> local API)"
  printf 'VITE_API_BASE_URL=http://localhost:5142\nVITE_GOOGLE_CLIENT_ID=\n' > "$ROOT/frontend/.env"
fi

echo "==> install.sh complete"
