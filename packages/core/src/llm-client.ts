import type { LLMConfig, LLMMessage, LLMResponse, PluginTool } from './types.js';

export class LLMClient {
  constructor(private config: LLMConfig) {}

  async chat(messages: LLMMessage[], tools?: PluginTool[]): Promise<LLMResponse> {
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

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
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
      arguments: typeof tc.function.arguments === 'string'
        ? JSON.parse(tc.function.arguments)
        : tc.function.arguments,
    }));

    return {
      content: data.message.content ?? '',
      toolCalls,
      finishReason: toolCalls?.length ? 'tool_calls' : data.done ? 'stop' : 'length',
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
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
