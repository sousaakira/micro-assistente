# Micro Assistente

Agente inteligente **leve** para automação de tarefas locais com IA local, memória HAG e sistema de plugins extensível.

## Características

- **IA local** — Otimizado para modelos com contexto limitado (Gemma, Llama, etc.)
- **Fila de tarefas** — Defina tarefas; o agente executa automaticamente
- **Memória HAG** — Persistência externa à janela de contexto
- **Plugins** — E-mail, WhatsApp, monitoramento de servidores (Fase 2)
- **UI com motion** — Skeleton, lazy loading e animações suaves

## Início Rápido

```bash
# Pré-requisitos: Node 20+, pnpm, Ollama
cp .env.example .env
pnpm install
pnpm dev
```

- **API:** http://127.0.0.1:3847
- **UI:** http://localhost:5173

## Para Agentes de IA

Leia **[AGENTS.md](./AGENTS.md)** antes de qualquer contribuição. Contém regras de workflow (Issues + PRs), arquitetura e padrões de UI.

## Estrutura

```
packages/
├── core/   # Orquestrador, LLM, fila, plugins
└── ui/     # Dashboard React
```

## Licença

MIT
