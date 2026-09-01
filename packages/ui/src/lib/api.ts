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

export interface WhatsAppSessionConfig {
  id: string;
  label: string;
  port: number;
  enabled: boolean;
}

export interface WhatsAppPanelConfig {
  enabled: boolean;
  autoStart: boolean;
  timeoutMs: number;
  defaultSessionId: string;
  sessions: WhatsAppSessionConfig[];
}

export interface WhatsAppConnectionStatus {
  connected: boolean;
  state: string;
  apiOnline: boolean;
}

export interface AkiraBrainStatus {
  session_id?: string;
  session_label?: string;
  connected: boolean;
  logged_out: boolean;
  qr_code: string;
  qr_status: string;
}

export interface ManagedProcessInfo {
  sessionId: string;
  label: string;
  port: number;
  name: string;
  running: boolean;
  pid?: number;
  lastError?: string;
  startedAt?: string;
}

export interface WhatsAppRuntimeStatus {
  managedByAgent: boolean;
  sessions: ManagedProcessInfo[];
}

export interface WhatsAppSessionStatus {
  session: WhatsAppSessionConfig;
  apiUrl: string;
  connection: WhatsAppConnectionStatus;
  akiraBrain: AkiraBrainStatus | null;
  runtime: ManagedProcessInfo | null;
}

export interface WhatsAppFullStatus {
  config: WhatsAppPanelConfig;
  sessions: WhatsAppSessionStatus[];
  runtime: WhatsAppRuntimeStatus;
}

export interface InboxChat {
  chat_jid: string;
  is_group: boolean;
  display_name: string;
  message_count: number;
  last_timestamp: number;
  last_preview: string;
}

export interface WhatsAppStoredMessage {
  id: string;
  chat_jid: string;
  sender_jid: string;
  is_from_me: boolean;
  timestamp: number;
  type: string;
  body: string;
  is_media: boolean;
}

export interface TaskSchedule {
  id: string;
  title: string;
  description: string;
  cron: string;
  enabled: boolean;
  pluginId?: string;
  autoRunAgent: boolean;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AkiraBrainProject {
  id: number;
  name: string;
  description: string;
  created_at: number;
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

  whatsappStatus: () => fetchJSON<WhatsAppFullStatus>('/integrations/whatsapp'),
  updateWhatsAppConfig: (data: Partial<WhatsAppPanelConfig>) =>
    fetchJSON<WhatsAppPanelConfig>('/integrations/whatsapp', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  addWhatsAppSession: (data: { label: string; port?: number }) =>
    fetchJSON<WhatsAppPanelConfig>('/integrations/whatsapp/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteWhatsAppSession: (sessionId: string) =>
    fetchJSON<WhatsAppPanelConfig>(`/integrations/whatsapp/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    }),
  startWhatsApp: () =>
    fetchJSON<WhatsAppFullStatus>('/integrations/whatsapp/start', { method: 'POST' }),
  stopWhatsApp: () =>
    fetchJSON<WhatsAppFullStatus>('/integrations/whatsapp/stop', { method: 'POST' }),
  restartWhatsApp: () =>
    fetchJSON<WhatsAppFullStatus>('/integrations/whatsapp/restart', { method: 'POST' }),
  whatsappInbox: (sessionId?: string) =>
    fetchJSON<InboxChat[]>(
      `/integrations/whatsapp/inbox${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`
    ),
  whatsappMessages: (sessionId: string, chat: string, limit = 50) =>
    fetchJSON<WhatsAppStoredMessage[]>(
      `/integrations/whatsapp/messages?sessionId=${encodeURIComponent(sessionId)}&chat=${encodeURIComponent(chat)}&limit=${limit}`
    ),
  whatsappSendMessage: (data: { sessionId: string; chat: string; message: string }) =>
    fetchJSON<{ ok: boolean; output: string }>('/integrations/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  whatsappProjects: (sessionId?: string) =>
    fetchJSON<AkiraBrainProject[]>(
      `/integrations/whatsapp/projects${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`
    ),
  createWhatsAppProject: (data: { sessionId?: string; name: string; description?: string }) =>
    fetchJSON<AkiraBrainProject>('/integrations/whatsapp/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  mapWhatsAppContact: (data: { sessionId?: string; jid: string; projectId: number }) =>
    fetchJSON<{ jid: string; project_id: number; project_name: string }>(
      '/integrations/whatsapp/map',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  whatsappSearchContacts: (sessionId: string, q: string, limit = 10) =>
    fetchJSON<InboxChat[]>(
      `/integrations/whatsapp/contacts/search?sessionId=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  schedules: () => fetchJSON<TaskSchedule[]>('/schedules'),
  createSchedule: (data: {
    title: string;
    description?: string;
    cron: string;
    pluginId?: string;
    autoRunAgent?: boolean;
  }) =>
    fetchJSON<TaskSchedule>('/schedules', { method: 'POST', body: JSON.stringify(data) }),
  toggleSchedule: (id: string, enabled: boolean) =>
    fetchJSON<TaskSchedule>(`/schedules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  deleteSchedule: (id: string) => fetchJSON<void>(`/schedules/${id}`, { method: 'DELETE' }),
};
