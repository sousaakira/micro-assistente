#!/usr/bin/env bash
# Inicia akira-brain serve (captura + leitura de mensagens, API :8765)
set -euo pipefail

AKIRA_BRAIN_PATH="${AKIRA_BRAIN_PATH:-/home/akira/Documents/Desenvolvimentos/AkiraBrain}"
BRAIN_DIR="$AKIRA_BRAIN_PATH/akira-brain"

if [[ ! -d "$BRAIN_DIR" ]]; then
  echo "Erro: akira-brain não encontrado em $BRAIN_DIR"
  exit 1
fi

cd "$BRAIN_DIR"

if [[ ! -f "./akira-brain" ]]; then
  echo "Compilando akira-brain..."
  go build -o akira-brain ./cmd/akira-brain
fi

export AKIRA_BRAIN_DATA="${AKIRA_BRAIN_DATA:-$BRAIN_DIR/data}"
export AKIRA_BRAIN_API_PORT="${AKIRA_BRAIN_API_PORT:-8765}"

echo "Iniciando akira-brain serve (API http://127.0.0.1:$AKIRA_BRAIN_API_PORT)"
exec ./akira-brain serve
