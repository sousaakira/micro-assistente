/** Tipos compatíveis com @micro-assistente/core — evita dependência circular */
export interface PluginTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  data?: unknown;
}

export interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  tools: PluginTool[];
  onLoad?(config: unknown): Promise<void>;
  onUnload?(): Promise<void>;
}
