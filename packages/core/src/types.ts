export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  pluginId?: string;
  params?: Record<string, unknown>;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  pluginId?: string;
  params?: Record<string, unknown>;
}

export interface AgentStatus {
  running: boolean;
  currentTaskId?: string;
  tasksProcessed: number;
  lastActivity?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  data?: unknown;
}

export interface PluginTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

export interface AgentPlugin {
  id: string;
  name: string;
  description: string;
  tools: PluginTool[];
  onLoad?(config: unknown): Promise<void>;
  onUnload?(): Promise<void>;
}

export interface HAGEntry {
  id: string;
  key: string;
  content: string;
  tags: string[];
  createdAt: string;
  relevance?: number;
}

export interface LLMConfig {
  baseUrl: string;
  model: string;
  maxTokens: number;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolName?: string;
  toolCalls?: ToolCall[];
  toolActivities?: ToolActivity[];
  createdAt: string;
}

export interface SendChatInput {
  message: string;
  sessionId?: string;
}

export interface ChatReply {
  sessionId: string;
  message: ChatMessage;
  toolActivities: ToolActivity[];
}

export interface ToolActivity {
  name: string;
  input: Record<string, unknown>;
  output: string;
}
