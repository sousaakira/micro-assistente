import type { AgentStatus, LLMMessage, Task } from './types.js';
import { HAGMemory } from './hag-memory.js';
import { LLMClient } from './llm-client.js';
import { PluginRegistry } from './plugin-registry.js';
import { TaskQueue } from './task-queue.js';

const SYSTEM_PROMPT = `Você é um assistente local leve. Execute tarefas de forma direta e concisa.
Use as ferramentas disponíveis quando necessário. Respostas curtas.
Memorize informações importantes para referência futura.`;

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
    const memoryContext = this.memory.formatForPrompt(task.title + ' ' + task.description);
    const tools = this.plugins.getToolsForPlugin(task.pluginId);

    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (memoryContext) {
      messages.push({ role: 'user', content: memoryContext });
    }

    messages.push({
      role: 'user',
      content: buildTaskPrompt(task),
    });

    const response = await this.llm.chat(messages, tools.length > 0 ? tools : undefined);

    if (response.toolCalls && response.toolCalls.length > 0) {
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

      // Segundo turno mínimo — apenas resultado resumido
      const followUp: LLMMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Tarefa: ${task.title}\nResultados das ferramentas:\n${results.join('\n')}\nResuma o resultado em 2-3 frases.` },
      ];

      const summary = await this.llm.chat(followUp);
      return summary.content || results.join('\n');
    }

    return response.content || 'Tarefa concluída sem resposta.';
  }
}

function buildTaskPrompt(task: Task): string {
  let prompt = `Tarefa: ${task.title}`;
  if (task.description) prompt += `\nDescrição: ${task.description}`;
  if (task.params) prompt += `\nParâmetros: ${JSON.stringify(task.params)}`;
  return prompt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
