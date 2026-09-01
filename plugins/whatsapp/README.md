# Plugin WhatsApp (embutido)

Bot WhatsApp do AkiraBrain, embutido no Micro Assistente.

## Estrutura

```
plugins/whatsapp/
├── bridge/           # Bridge TypeScript → expõe tools ao agente
├── whatsmeow/        # Fork whatsmeow (protocolo WA)
├── whatsmeow-api/    # Serviço Go — enviar mensagens (:5000)
├── akira-brain/      # Serviço Go — capturar/ler mensagens (:8765)
└── scripts/          # Build
```

## Primeira vez

```bash
# Compilar binários Go
npm run build:whatsapp

# Copiar env (opcional — S3, SESSION, etc.)
cp whatsmeow-api/.env.example whatsmeow-api/.env
```

## Subir o bot

```bash
# Na raiz do monorepo
npm run dev:whatsapp
```

- **whatsmeow-api** → http://127.0.0.1:5000 (envio)
- **akira-brain serve** → http://127.0.0.1:8765 (leitura/inbox)

## Integração com o agente

O `@micro-assistente/core` carrega `@micro-assistente/plugin-whatsapp` automaticamente.

Tools: `whatsapp_send_message`, `whatsapp_cobrar_contato`, `whatsapp_list_inbox`, etc.

## Sessão WhatsApp

Na primeira execução, escaneie o QR no terminal do whatsmeow-api ou akira-brain.
Sessão persistida em `whatsmeow-api/tokens/` e `akira-brain/data/session.db`.
