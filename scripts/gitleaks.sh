#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$ROOT/.gitleaks.toml"

run_gitleaks() {
  gitleaks detect --source "$ROOT" --config "$CONFIG" --redact -v "$@"
}

if command -v gitleaks >/dev/null 2>&1; then
  run_gitleaks "$@"
elif command -v docker >/dev/null 2>&1; then
  docker run --rm -v "$ROOT:/repo" zricethezav/gitleaks:latest \
    detect --source /repo --config /repo/.gitleaks.toml --redact -v "$@"
else
  echo "Instale gitleaks (https://github.com/gitleaks/gitleaks) ou Docker para rodar o scan localmente." >&2
  exit 1
fi
