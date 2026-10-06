#!/usr/bin/env bash
# Runs the Vite dev server for the React frontend.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT/frontend"
exec npm run dev -- --host 0.0.0.0 --port 5173
