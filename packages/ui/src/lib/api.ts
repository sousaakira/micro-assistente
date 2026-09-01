export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  pluginId?: string;
  params?: Record<string, unknown>;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AgentStatus {
  running: boolean;
  currentTaskId?: string;
  tasksProcessed: number;
  lastActivity?: string;
}

export interface HealthResponse {
  status: string;
  llm: boolean;
  agent: AgentStatus;
}

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  toolCount: number;
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
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  toolActivities?: ToolActivity[];
  createdAt: string;
}

export interface ToolActivity {
  name: string;
  input: Record<string, unknown>;
  output: string;
}

export interface ChatReply {
  sessionId: string;
  message: ChatMessage;
  toolActivities: ToolActivity[];
}

const BASE = '/api';

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => fetchJSON<HealthResponse>('/health'),
  tasks: () => fetchJSON<Task[]>('/tasks'),
  createTask: (data: { title: string; description?: string; pluginId?: string }) =>
    fetchJSON<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  deleteTask: (id: string) => fetchJSON<void>(`/tasks/${id}`, { method: 'DELETE' }),
  agentStatus: () => fetchJSON<AgentStatus>('/agent/status'),
  startAgent: () => fetchJSON<AgentStatus>('/agent/start', { method: 'POST' }),
  stopAgent: () => fetchJSON<AgentStatus>('/agent/stop', { method: 'POST' }),
  plugins: () => fetchJSON<PluginInfo[]>('/plugins'),

  chatSessions: () => fetchJSON<ChatSession[]>('/chat/sessions'),
  createChatSession: (title?: string) =>
    fetchJSON<ChatSession>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    }),
  chatMessages: (sessionId: string) =>
    fetchJSON<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`),
  sendChat: (data: { message: string; sessionId?: string }) =>
    fetchJSON<ChatReply>('/chat', { method: 'POST', body: JSON.stringify(data) }),
};
