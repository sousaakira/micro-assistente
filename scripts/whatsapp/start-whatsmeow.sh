#!/usr/bin/env bash
# Inicia whatsmeow-api do AkiraBrain (envio de mensagens)
set -euo pipefail

AKIRA_BRAIN_PATH="${AKIRA_BRAIN_PATH:-/home/akira/Documents/Desenvolvimentos/AkiraBrain}"
API_DIR="$AKIRA_BRAIN_PATH/whatsmeow-api"

if [[ ! -d "$API_DIR" ]]; then
  echo "Erro: AkiraBrain não encontrado em $AKIRA_BRAIN_PATH"
  echo "Defina AKIRA_BRAIN_PATH no .env"
  exit 1
fi

cd "$API_DIR"

if [[ ! -f "./main" ]]; then
  echo "Compilando whatsmeow-api..."
  go build -o main .
fi

echo "Iniciando whatsmeow-api em $API_DIR"
echo "Porta padrão: 5000 (+ PORTA offset)"
exec node src/server.js
