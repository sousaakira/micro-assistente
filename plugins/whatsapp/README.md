# Plugin WhatsApp (embutido)

Bot WhatsApp integrado ao Micro Assistente via **akira-brain** — leitura, envio, inbox e múltiplas sessões.

## Estrutura

```
plugins/whatsapp/
├── bridge/           # Bridge TypeScript → tools + gerenciador de processos
├── akira-brain/      # Serviço Go unificado (WA + API + SQLite)
├── whatsmeow/        # Fork whatsmeow (protocolo WA)
└── whatsmeow-api/    # Legado — não usado pelo agente (send migrado para akira-brain)
```

## Primeira vez

```bash
npm run build:whatsapp   # compila akira-brain
npm run dev              # agente sobe as sessões automaticamente
```

## Múltiplas sessões

Cada conta WhatsApp = um processo akira-brain com:
- `data/whatsapp/sessions/{id}/` — session.db + akira-brain.db
- Porta API própria (8765, 8766, …)

Configure no painel **WhatsApp → Adicionar conta**.

## Integração com o agente

Tools: `whatsapp_send_message`, `whatsapp_list_inbox`, `whatsapp_cobrar_contato`, etc.

Sessão padrão configurável no painel (`defaultSessionId`).
