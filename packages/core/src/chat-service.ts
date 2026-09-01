import type { ChatStore } from './chat-store.js';
import type { HAGMemory } from './hag-memory.js';
import type { LLMClient } from './llm-client.js';
import type { PluginRegistry } from './plugin-registry.js';
import type { TaskQueue } from './task-queue.js';
import type {
  ChatMessage,
  ChatReply,
  LLMMessage,
  PluginTool,
  SendChatInput,
  ToolActivity,
} from './types.js';

const CHAT_SYSTEM = `Você é o Micro Assistente, um agente local leve e direto.
Você pode conversar, consultar a fila de tarefas, criar tarefas, verificar status e controlar o agente.
Use as ferramentas quando precisar de dados atualizados sobre tarefas.
Respostas concisas em português.`;

const MAX_TOOL_ROUNDS = 4;

export class ChatService {
  constructor(
    private store: ChatStore,
    private llm: LLMClient,
    private memory: HAGMemory,
    private tasks: TaskQueue,
    private plugins: PluginRegistry
  ) {}

  listSessions() {
    return this.store.listSessions();
  }

  getMessages(sessionId: string) {
    return this.store.getMessages(sessionId);
  }

  createSession(title?: string) {
    return this.store.createSession(title);
  }

  async send(input: SendChatInput): Promise<ChatReply> {
    let sessionId = input.sessionId;
    if (!sessionId) {
      const session = this.store.createSession(truncate(input.message, 48));
      sessionId = session.id;
    } else if (!this.store.getSession(sessionId)) {
      throw new Error('Sessão não encontrada');
    }

    this.store.addMessage({
      sessionId,
      role: 'user',
      content: input.message,
    });

    const toolActivities: ToolActivity[] = [];
    const tools = this.getChatTools();
    let replyContent = '';
    let toolCallsStored: ChatMessage['toolCalls'];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const messages = this.buildMessages(sessionId, input.message);
      const response = await this.llm.chat(messages, tools);

      if (response.toolCalls?.length) {
        toolCallsStored = response.toolCalls;
        const toolOutputs: string[] = [];

        for (const call of response.toolCalls) {
          const tool = tools.find((t) => t.name === call.name);
          let output: string;

          if (!tool) {
            output = `Ferramenta "${call.name}" não encontrada.`;
          } else {
            const result = await tool.execute(call.arguments);
            output = result.output;
            toolActivities.push({
              name: call.name,
              input: call.arguments,
              output: result.output,
            });
          }

          toolOutputs.push(`[${call.name}]: ${output}`);
        }

        if (round === MAX_TOOL_ROUNDS - 1) {
          replyContent = toolOutputs.join('\n');
          break;
        }

        // Turno intermediário — pede síntese com resultados das tools
        const synthesisMessages: LLMMessage[] = [
          ...messages,
          { role: 'assistant', content: response.content || 'Executando ferramentas...' },
          {
            role: 'user',
            content: `Resultados:\n${toolOutputs.join('\n')}\n\nResponda ao usuário de forma natural e concisa.`,
          },
        ];

        const synthesis = await this.llm.chat(synthesisMessages, tools);
        if (!synthesis.toolCalls?.length) {
          replyContent = synthesis.content;
          break;
        }
        // Se ainda pediu tools, continua o loop
        continue;
      }

      replyContent = response.content;
      break;
    }

    if (!replyContent) {
      replyContent = 'Não consegui processar sua mensagem.';
    }

    const assistantMessage = this.store.addMessage({
      sessionId,
      role: 'assistant',
      content: replyContent,
      toolCalls: toolCallsStored,
      toolActivities: toolActivities.length > 0 ? toolActivities : undefined,
    });

    this.memory.store(
      `chat:${sessionId}`,
      `Usuário: ${input.message}\nAssistente: ${replyContent.slice(0, 300)}`,
      ['chat']
    );

    return { sessionId, message: assistantMessage, toolActivities };
  }

  private getChatTools(): PluginTool[] {
    return this.plugins.getChatTools();
  }

  private buildMessages(sessionId: string, userMessage: string): LLMMessage[] {
    const queueContext = this.tasks.formatQueueContext();
    const memoryContext = this.memory.formatForPrompt(userMessage, 600);
    const recent = this.store.getRecentForContext(sessionId, 6);

    const systemParts = [CHAT_SYSTEM, `\nEstado atual da fila:\n${queueContext}`];
    if (memoryContext) systemParts.push(`\n${memoryContext}`);

    const messages: LLMMessage[] = [
      { role: 'system', content: systemParts.join('\n') },
    ];

    for (const msg of recent) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    return messages;
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + '…';
}
