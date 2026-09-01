# AGENTS.md — Instruções para Agentes de IA

> **Este arquivo é a fonte de verdade para qualquer agente (Cursor, Claude, Codex, etc.) que trabalhe neste repositório.**
> Leia-o integralmente antes de qualquer alteração.

## Visão Geral

**Micro Assistente** é um agente inteligente **leve**, otimizado para IA local com contexto limitado e memória HAG. Executa tarefas do PC (e-mail, WhatsApp, servidores via plugins) definidas em uma fila de tarefas.

### Princípios Arquiteturais

1. **Leveza acima de tudo** — A IA local tem pouco contexto; minimize tokens em prompts, respostas e estado.
2. **Contexto comprimido** — Envie à LLM apenas o necessário: tarefa atual + memória HAG relevante + resultado do último passo.
3. **Plugins desacoplados** — Cada integração (e-mail, WhatsApp, servidores) é um plugin independente.
4. **Fila de tarefas** — O usuário define tarefas; o agente as executa sequencialmente ou em paralelo conforme configuração.
5. **Memória HAG** — Persistência externa à janela de contexto; consulte antes de agir, atualize após concluir.

---

## Workflow GitHub (OBRIGATÓRIO)

### Regra de Ouro

> **Nenhum deploy ou merge em `main` sem PR. Nenhum PR sem Issue vinculada.**

### Fluxo Padrão

```
Issue → Branch → PR → Review → Merge → Deploy
```

### 1. Issues

Toda tarefa **deve** ter uma Issue antes do código. Use os labels:

| Label | Quando usar |
|-------|-------------|
| `nova-funcao` | Feature nova |
| `melhoria` | Enhancement de algo existente |
| `correcao` | Bug fix |
| `fase-2` | Plugins avançados (servidores, WhatsApp, e-mail) |
| `ui` | Interface e motion design |
| `core` | Núcleo do agente |
| `plugin` | Sistema ou plugin específico |

**Formato do título:** `[Tipo] Descrição curta`

Exemplos:
- `[Nova função] Integração com LLM local via Ollama`
- `[Correção] Fila de tarefas não persiste após restart`
- `[Melhoria] Comprimir contexto enviado à LLM`

### 2. Branches

```
feat/issue-<numero>-<slug-curto>
fix/issue-<numero>-<slug-curto>
chore/issue-<numero>-<slug-curto>
```

Exemplo: `feat/issue-3-fila-tarefas`

### 3. Pull Requests

**Título:** mesma convenção das Issues.

**Descrição obrigatória:**

```markdown
## Issue
Closes #<numero>

## Resumo
<1-3 bullets do que mudou>

## Test plan
- [ ] <passo de teste>
- [ ] <passo de teste>
```

Use `Closes #N`, `Fixes #N` ou `Resolves #N` para vincular.

### 4. Commits

Preferir commits atômicos. Mensagem no imperativo:

```
feat(core): adicionar orquestrador de tarefas
fix(ui): skeleton não aparece no carregamento lazy
docs: atualizar AGENTS.md com regras de plugin
```

### 5. Deploys

Cada merge em `main` via PR é um deploy. Não faça push direto em `main`.

---

## Estrutura do Monorepo

```
micro-assistente/
├── AGENTS.md              ← este arquivo
├── README.md
├── packages/
│   ├── core/              ← orquestrador, LLM, fila, plugins loader
│   └── ui/                ← dashboard React com motion
├── docs/
│   └── architecture.md    ← arquitetura detalhada
└── .github/
    └── workflows/         ← CI
```

### packages/core

- `AgentOrchestrator` — loop principal: pega tarefa → monta prompt mínimo → chama LLM → executa tool/plugin → atualiza HAG
- `TaskQueue` — fila persistente (SQLite)
- `LLMClient` — adapter Ollama/OpenAI-compatible
- `HAGMemory` — interface de memória externa
- `PluginRegistry` — carrega e executa plugins

### packages/ui

- Dashboard de tarefas, status do agente, configuração
- **Motion obrigatório** em todos os elementos (ver seção UI)

---

## Sistema de Plugins (Fase 2 — já planejado)

Plugins implementam a interface `AgentPlugin`:

```typescript
interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  tools: PluginTool[];       // ferramentas expostas à LLM
  onLoad?(config: unknown): Promise<void>;
  onUnload?(): Promise<void>;
}
```

### Plugins planejados

| Plugin | Issue | Status |
|--------|-------|--------|
| E-mail (ler/responder) | #10 | Fase 2 |
| WhatsApp (ler/enviar) | #11 | Fase 2 |
| Monitoramento de servidores (HD, CPU, serviços) | #12 | Fase 2 |

Ao implementar plugins, **nunca** embuta lógica de integração no core — sempre via plugin.

---

## Otimização para IA Local

### Contexto mínimo por chamada

```
[System] Instruções fixas curtas (~200 tokens)
[Memory] Trechos HAG relevantes (~300 tokens max)
[Task] Tarefa atual + parâmetros
[Tools] Apenas tools do plugin necessário
[History] Último turno apenas (não histórico completo)
```

### Regras

- Não envie histórico completo de conversa
- Resuma resultados de tools antes de reenviar à LLM
- Use streaming quando disponível
- Prefira function calling / tool use nativo do modelo
- Limite `max_tokens` de saída conforme `.env`

---

## UI — Motion Design (OBRIGATÓRIO)

Seguir a skill **design-motion-principles** (`kylezantos/design-motion-principles`).

### Requisitos em TODA interface

| Elemento | Requisito |
|----------|-----------|
| Carregamento inicial | **Skeleton** placeholders |
| Rotas/componentes | **Lazy loading** com `React.lazy` + `Suspense` |
| Entrada de elementos | Animação enter (opacity + translateY + blur) |
| Saída de elementos | Animação exit mais sutil que enter |
| Progresso | Barra/step animada com spring |
| Listas | Staggered entrance |
| Interações frequentes | Sem animação ou < 180ms |
| Acessibilidade | `prefers-reduced-motion` sempre respeitado |

### Stack UI

- React 19 + Vite
- `motion` (Framer Motion) para animações
- TanStack Query para data fetching com skeleton states
- CSS custom properties para easing (`--ease-out`, etc.)

### Perspectiva de motion (produtividade)

Este é um **tool de produtividade** → peso **Emil Kowalski** (Linear):
- Duração ideal: **180ms**
- Máximo: **300ms**
- Springs com `bounce: 0`
- Animação deve passar despercebida

---

## Comandos de Desenvolvimento

```bash
npm install           # ou: yarn install
npm run dev           # core + UI em paralelo
npm run dev:core      # apenas backend
npm run dev:ui        # apenas frontend
npm run build         # build de produção
npm run typecheck     # verificação de tipos
```

Equivalente com **yarn**:

```bash
yarn install
yarn dev
yarn dev:core
yarn dev:ui
yarn build
yarn typecheck
```

### Pré-requisitos

- Node.js ≥ 20
- npm (incluso no Node) ou Yarn 1.x/4.x
- Ollama (ou LLM compatível) rodando localmente
- Modelo configurado em `.env` (ex: `gemma2:9b`)

---

## Checklist para Agentes

Antes de abrir um PR, verifique:

- [ ] Issue existe e está referenciada no PR (`Closes #N`)
- [ ] Branch nomeada corretamente (`feat/issue-N-slug`)
- [ ] Código no pacote correto (`core` vs `ui`)
- [ ] Contexto LLM não inflado desnecessariamente
- [ ] UI tem skeleton + lazy loading + motion (se aplicável)
- [ ] `prefers-reduced-motion` respeitado
- [ ] Plugin não acoplado ao core (se aplicável)
- [ ] `.env.example` atualizado (se novas vars)
- [ ] Typecheck passa (`npm run typecheck`)

---

## Roadmap por Fase

### Fase 1 — Fundação (atual)
- [x] Scaffold monorepo (#1)
- [x] Core: orquestrador + fila + LLM + HAG (#3, #4, #5, #6)
- [x] UI: dashboard com motion (#8)
- [x] Arquitetura de plugins (#7)
- [x] API REST (#9)
- [x] AGENTS.md e workflow (#2)

### Fase 2 — Integrações
- [ ] Plugin E-mail (#10)
- [ ] Plugin WhatsApp (#11)
- [ ] Plugin Monitoramento de Servidores (#12)

---

## Links

- Repositório: https://github.com/sousaakira/micro-assistente
- Motion Principles: https://github.com/kylezantos/design-motion-principles
