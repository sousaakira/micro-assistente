# Arquitetura — Micro Assistente

## Diagrama Geral

```mermaid
flowchart TB
    subgraph UI["packages/ui"]
        Dashboard[Dashboard React]
        TaskList[Lista de Tarefas]
        AgentStatus[Status do Agente]
    end

    subgraph Core["packages/core"]
        API[REST API]
        Orchestrator[Agent Orchestrator]
        TaskQueue[Task Queue - SQLite]
        LLM[LLM Client - Ollama]
        HAG[HAG Memory]
        Registry[Plugin Registry]
    end

    subgraph Plugins["Plugins (Fase 2)"]
        Email[Email Plugin]
        WhatsApp[WhatsApp Plugin]
        Servers[Server Monitor Plugin]
    end

    Dashboard --> API
    API --> Orchestrator
    Orchestrator --> TaskQueue
    Orchestrator --> LLM
    Orchestrator --> HAG
    Orchestrator --> Registry
    Registry --> Email
    Registry --> WhatsApp
    Registry --> Servers
```

## Fluxo de Execução de Tarefa

```mermaid
sequenceDiagram
    participant U as Usuário
    participant Q as TaskQueue
    participant O as Orchestrator
    participant H as HAG Memory
    participant L as LLM
    participant P as Plugin

    U->>Q: Adiciona tarefa
    Q->>O: Próxima tarefa pendente
    O->>H: Consulta memória relevante
    H-->>O: Contexto comprimido
    O->>L: Prompt mínimo + tools
    L-->>O: Resposta / tool call
    O->>P: Executa tool do plugin
    P-->>O: Resultado
    O->>H: Atualiza memória
    O->>Q: Marca tarefa concluída
```

## Otimização de Contexto

A IA local tem janela limitada. O orquestrador monta prompts mínimos:

| Bloco | Limite aprox. | Conteúdo |
|-------|---------------|----------|
| System | ~200 tokens | Instruções fixas do agente |
| Memory | ~300 tokens | Trechos HAG filtrados por relevância |
| Task | ~100 tokens | Tarefa atual + parâmetros |
| Tools | variável | Apenas tools do plugin necessário |
| Last turn | ~200 tokens | Último resultado, resumido |

**Total alvo:** < 1000 tokens de input por chamada.

## Plugin Interface

```typescript
interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  tools: PluginTool[];
  onLoad?(config: unknown): Promise<void>;
  onUnload?(): Promise<void>;
}

interface PluginTool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}
```

Plugins são carregados dinamicamente pelo `PluginRegistry` a partir de `plugins/` ou via configuração.

## Persistência

- **Tarefas:** SQLite (`data/tasks.db`)
- **Memória HAG:** Diretório configurável (`HAG_PATH`)
- **Config:** `.env` + `data/config.json`

## API REST (Fase 1)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do agente |
| GET | `/tasks` | Listar tarefas |
| POST | `/tasks` | Criar tarefa |
| PATCH | `/tasks/:id` | Atualizar tarefa |
| DELETE | `/tasks/:id` | Remover tarefa |
| POST | `/agent/start` | Iniciar processamento |
| POST | `/agent/stop` | Parar processamento |
| GET | `/agent/status` | Status atual |
| GET | `/plugins` | Plugins carregados |
