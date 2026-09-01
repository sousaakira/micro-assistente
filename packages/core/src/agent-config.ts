import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LLMProvider } from './types.js';

export interface AgentConfig {
  llm: {
    provider: LLMProvider;
    baseUrl: string;
    model: string;
    maxTokens: number;
    apiKey?: string;
  };
  disabledPlugins: string[];
  updatedAt: string;
}

export class AgentConfigStore {
  private path: string;
  private config: AgentConfig;

  constructor(configPath = './data/agent-config.json') {
    this.path = configPath;
    mkdirSync(dirname(configPath), { recursive: true });
    this.config = this.load();
  }

  get(): AgentConfig {
    return structuredClone(this.config);
  }

  getEffectiveLLM(): AgentConfig['llm'] {
    const fromEnv = {
      provider: (process.env.LLM_PROVIDER ?? 'llama-cpp') as LLMProvider,
      baseUrl: process.env.LLM_BASE_URL ?? 'https://ia.lo',
      model:
        process.env.LLM_MODEL ??
        'Gemma-4-E2B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf',
      maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 2048),
      apiKey: process.env.LLM_API_KEY,
    };

    const stored = this.config.llm;
    const hasStored =
      existsSync(this.path) &&
      (stored.baseUrl !== fromEnv.baseUrl ||
        stored.model !== fromEnv.model ||
        stored.provider !== fromEnv.provider);

    if (!hasStored && !existsSync(this.path)) {
      return fromEnv;
    }

    return {
      provider: stored.provider || fromEnv.provider,
      baseUrl: stored.baseUrl || fromEnv.baseUrl,
      model: stored.model || fromEnv.model,
      maxTokens: stored.maxTokens || fromEnv.maxTokens,
      apiKey: stored.apiKey || fromEnv.apiKey,
    };
  }

  isPluginEnabled(pluginId: string): boolean {
    return !this.config.disabledPlugins.includes(pluginId);
  }

  update(patch: {
    llm?: Partial<AgentConfig['llm']>;
    disabledPlugins?: string[];
  }): AgentConfig {
    if (patch.llm) {
      this.config.llm = { ...this.config.llm, ...patch.llm };
    }
    if (patch.disabledPlugins) {
      this.config.disabledPlugins = [...patch.disabledPlugins];
    }
    this.config.updatedAt = new Date().toISOString();
    writeFileSync(this.path, JSON.stringify(this.config, null, 2), 'utf8');
    return this.get();
  }

  private load(): AgentConfig {
    const defaults: AgentConfig = {
      llm: {
        provider: (process.env.LLM_PROVIDER ?? 'llama-cpp') as LLMProvider,
        baseUrl: process.env.LLM_BASE_URL ?? 'https://ia.lo',
        model:
          process.env.LLM_MODEL ??
          'Gemma-4-E2B-Uncensored-HauhauCS-Aggressive-Q4_K_P.gguf',
        maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 2048),
        apiKey: process.env.LLM_API_KEY,
      },
      disabledPlugins: [],
      updatedAt: new Date().toISOString(),
    };

    if (!existsSync(this.path)) {
      return defaults;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<AgentConfig>;
      return {
        llm: { ...defaults.llm, ...parsed.llm },
        disabledPlugins: parsed.disabledPlugins ?? [],
        updatedAt: parsed.updatedAt ?? defaults.updatedAt,
      };
    } catch {
      return defaults;
    }
  }
}
