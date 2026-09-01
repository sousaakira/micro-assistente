#!/usr/bin/env bash
# Compila os binários Go embutidos (primeira vez)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build:go
