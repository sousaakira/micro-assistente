import type { LLMConfig, LLMMessage, LLMResponse, PluginTool } from './types.js';

/** Adapter multi-provedor: llama-cpp, Ollama e OpenAI-compatível (OmniRouter). */
export class LLMClient {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], tools?: PluginTool[]): Promise<LLMResponse> {
    if (this.config.provider === 'ollama') {
      return this.chatOllama(messages, tools);
    }
    return this.chatOpenAI(messages, tools);
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (this.config.provider === 'ollama') {
        const res = await fetch(`${this.rootUrl()}/api/tags`);
        return res.ok;
      }

      const res = await fetch(`${this.rootUrl()}/health`, {
        headers: this.authHeaders(),
      });
      if (res.ok) return true;

      // Fallback: alguns proxies não expõem /health
      const models = await fetch(`${this.apiBaseUrl()}/models`, {
        headers: this.authHeaders(),
      });
      return models.ok;
    } catch {
      return false;
    }
  }

  private async chatOpenAI(messages: LLMMessage[], tools?: PluginTool[]): Promise<LLMResponse> {
    const chatMessages = messages
      .filter((m) => m.role !== 'tool')
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: chatMessages,
      stream: false,
      max_tokens: this.config.maxTokens,
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${this.apiBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices?.[0];
    const message = choice?.message;

    const toolCalls = message?.tool_calls?.map((tc) => ({
      id: tc.id ?? crypto.randomUUID(),
      name: tc.function.name,
      arguments: parseToolArguments(tc.function.arguments),
    }));

    return {
      content: message?.content ?? '',
      toolCalls,
      finishReason: toolCalls?.length
        ? 'tool_calls'
        : choice?.finish_reason === 'length'
          ? 'length'
          : 'stop',
    };
  }

  private async chatOllama(messages: LLMMessage[], tools?: PluginTool[]): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
      options: {
        num_predict: this.config.maxTokens,
      },
    };

    if (tools && tools.length > 0) {
      body.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    const response = await fetch(`${this.rootUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as OllamaResponse;

    const toolCalls = data.message.tool_calls?.map((tc) => ({
      id: tc.id ?? crypto.randomUUID(),
      name: tc.function.name,
      arguments: parseToolArguments(tc.function.arguments),
    }));

    return {
      content: data.message.content ?? '',
      toolCalls,
      finishReason: toolCalls?.length ? 'tool_calls' : data.done ? 'stop' : 'length',
    };
  }

  /** URL raiz do servidor (sem /v1) */
  private rootUrl(): string {
    return this.config.baseUrl.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  }

  /** Base OpenAI-compatível: https://host/v1 */
  private apiBaseUrl(): string {
    return `${this.rootUrl()}/v1`;
  }

  private authHeaders(): Record<string, string> {
    if (!this.config.apiKey) return {};
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }
}

function parseToolArguments(args: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof args === 'string') {
    try {
      return JSON.parse(args) as Record<string, unknown>;
    } catch {
      return { raw: args };
    }
  }
  return args;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      role: string;
      content?: string;
      tool_calls?: Array<{
        id?: string;
        function: { name: string; arguments: string | Record<string, unknown> };
      }>;
    };
    finish_reason?: string;
  }>;
}

interface OllamaResponse {
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id?: string;
      function: { name: string; arguments: string | Record<string, unknown> };
    }>;
  };
  done: boolean;
}
