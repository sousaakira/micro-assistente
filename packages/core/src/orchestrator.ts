import type { AgentStatus, LLMMessage, Task } from './types.js';
import { HAGMemory } from './hag-memory.js';
import { LLMClient } from './llm-client.js';
import { PluginRegistry } from './plugin-registry.js';
import { TaskQueue } from './task-queue.js';

const EXECUTION_SYSTEM = `Você está EXECUTANDO uma tarefa da fila — não criando uma nova.
Regras:
- NUNCA chame create_task, start_agent ou stop_agent.
- Use apenas as ferramentas disponíveis para realizar a ação pedida.
- Se não houver ferramenta para completar (ex: WhatsApp, e-mail), diga claramente que a tarefa está BLOQUEADA aguardando plugin e o que seria necessário.
- Respostas curtas e objetivas em português.`;

export class AgentOrchestrator {
  private running = false;
  private currentTaskId?: string;
  private tasksProcessed = 0;
  private lastActivity?: string;
  private abortController?: AbortController;

  constructor(
    private taskQueue: TaskQueue,
    private llm: LLMClient,
    private memory: HAGMemory,
    private plugins: PluginRegistry
  ) {}

  getStatus(): AgentStatus {
    return {
      running: this.running,
      currentTaskId: this.currentTaskId,
      tasksProcessed: this.tasksProcessed,
      lastActivity: this.lastActivity,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.abortController = new AbortController();
    this.processLoop(this.abortController.signal);
  }

  stop(): void {
    this.running = false;
    this.abortController?.abort();
    this.currentTaskId = undefined;
  }

  private async processLoop(signal: AbortSignal): Promise<void> {
    while (this.running && !signal.aborted) {
      const task = this.taskQueue.getNext();
      if (!task) {
        await sleep(2000);
        continue;
      }

      this.currentTaskId = task.id;
      this.lastActivity = new Date().toISOString();
      this.taskQueue.updateStatus(task.id, 'running');

      try {
        const result = await this.executeTask(task);
        this.taskQueue.updateStatus(task.id, 'completed', { result });
        this.memory.store(`task:${task.id}`, result, ['task-result', task.title]);
        this.tasksProcessed++;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.taskQueue.updateStatus(task.id, 'failed', { error });
      }

      this.currentTaskId = undefined;
      this.lastActivity = new Date().toISOString();
    }
  }

  private async executeTask(task: Task): Promise<string> {
    if (taskRequiresExternalPlugin(task) && !task.pluginId) {
      throw new Error(
        'Tarefa bloqueada: requer plugin de integração (WhatsApp, e-mail, etc.) que ainda não está instalado. ' +
          'Disponível na Fase 2.'
      );
    }

    const tools = this.plugins.getExecutionTools(task.pluginId);

    if (tools.length === 0 && task.pluginId) {
      throw new Error(`Plugin "${task.pluginId}" não encontrado ou sem ferramentas.`);
    }

    if (tools.length === 0 && !task.pluginId) {
      throw new Error(
        'Tarefa bloqueada: nenhum plugin disponível para executar esta ação (ex: WhatsApp, e-mail). ' +
          'Instale o plugin correspondente ou execute passos manuais.'
      );
    }

    const memoryContext = this.memory.formatForPrompt(task.title + ' ' + task.description);
    const queueContext = this.taskQueue.formatQueueContext(400);

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `${EXECUTION_SYSTEM}\n\nContexto da fila:\n${queueContext}`,
      },
    ];

    if (memoryContext) {
      messages.push({ role: 'user', content: memoryContext });
    }

    messages.push({
      role: 'user',
      content: buildTaskPrompt(task, tools),
    });

    const response = await this.llm.chat(messages, tools.length > 0 ? tools : undefined);

    if (response.toolCalls && response.toolCalls.length > 0) {
      const forbidden = response.toolCalls.filter((c) =>
        ['create_task', 'start_agent', 'stop_agent'].includes(c.name)
      );
      if (forbidden.length > 0) {
        throw new Error(
          'Execução inválida: o modelo tentou criar outra tarefa em vez de executar. ' +
            'Esta ação provavelmente requer um plugin (WhatsApp, e-mail) ainda não instalado.'
        );
      }

      const results: string[] = [];

      for (const call of response.toolCalls) {
        const tool = tools.find((t) => t.name === call.name);
        if (!tool) {
          results.push(`Tool "${call.name}" não encontrada`);
          continue;
        }

        const toolResult = await tool.execute(call.arguments);
        results.push(toolResult.output);
      }

      const followUp: LLMMessage[] = [
        { role: 'system', content: EXECUTION_SYSTEM },
        {
          role: 'user',
          content: `Tarefa: ${task.title}\nResultados:\n${results.join('\n')}\nResuma o que foi feito em 2-3 frases. Se nada foi possível, diga que está bloqueada.`,
        },
      ];

      const summary = await this.llm.chat(followUp);
      return summary.content || results.join('\n');
    }

    const content = response.content || '';
    if (looksLikeBlocked(content)) {
      throw new Error(content.slice(0, 500));
    }

    return content || 'Tarefa concluída sem resposta.';
  }
}

function buildTaskPrompt(
  task: Task,
  tools: Array<{ name: string; description: string }>
): string {
  let prompt = `Execute agora (não crie nova tarefa):\nTítulo: ${task.title}`;
  if (task.description) prompt += `\nDescrição: ${task.description}`;
  if (task.params) prompt += `\nParâmetros: ${JSON.stringify(task.params)}`;
  if (tools.length > 0) {
    prompt += `\n\nFerramentas disponíveis: ${tools.map((t) => t.name).join(', ')}`;
  } else {
    prompt += '\n\nNenhuma ferramenta externa disponível — informe bloqueio se não puder executar.';
  }
  return prompt;
}

function looksLikeBlocked(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('bloqueada') ||
    lower.includes('não tenho como') ||
    lower.includes('nao tenho como') ||
    (lower.includes('plugin') && lower.includes('necessár'))
  );
}

function taskRequiresExternalPlugin(task: Task): boolean {
  const text = `${task.title} ${task.description}`.toLowerCase();
  return /whatsapp|e-?mail|mensagem|cobr|enviar|ligar|reunião|reuniao|slack|telegram/.test(text);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
