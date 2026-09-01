/**
 * Cliente HTTP para akira-brain (leitura, envio, inbox, QR).
 * Suporta múltiplas sessões — cada uma com porta/API própria.
 */

export interface WhatsAppSessionConfig {
  id: string;
  label: string;
  port: number;
  enabled: boolean;
}

export interface WhatsAppConfig {
  sessions: WhatsAppSessionConfig[];
  defaultSessionId: string;
  timeoutMs?: number;
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

export interface InboxChat {
  chat_jid: string;
  is_group: boolean;
  display_name: string;
  message_count: number;
  last_timestamp: number;
  last_preview: string;
}

export interface StoredMessage {
  id: string;
  chat_jid: string;
  sender_jid: string;
  is_from_me: boolean;
  timestamp: number;
  type: string;
  body: string;
  is_media: boolean;
}

export interface AkiraBrainProject {
  id: number;
  name: string;
  description: string;
  created_at: number;
}

export class WhatsAppClient {
  private timeoutMs = 25_000;
  private sessions = new Map<string, WhatsAppSessionConfig>();
  private defaultSessionId = 'principal';

  constructor(config: WhatsAppConfig) {
    this.applyConfig(config);
  }

  applyConfig(config: WhatsAppConfig): void {
    this.timeoutMs = config.timeoutMs ?? 25_000;
    this.defaultSessionId = config.defaultSessionId;
    this.sessions.clear();
    for (const session of config.sessions) {
      if (session.enabled) {
        this.sessions.set(session.id, session);
      }
    }
  }

  listSessions(): WhatsAppSessionConfig[] {
    return [...this.sessions.values()];
  }

  getSessionUrl(sessionId?: string): string {
    const session = this.resolveSession(sessionId);
    return `http://127.0.0.1:${session.port}`;
  }

  async getAkiraBrainStatus(sessionId?: string): Promise<AkiraBrainStatus> {
    return this.fetchJSON<AkiraBrainStatus>(`${this.getSessionUrl(sessionId)}/api/status`);
  }

  async getStatus(sessionId?: string): Promise<WhatsAppConnectionStatus> {
    const url = this.getSessionUrl(sessionId);
    try {
      const data = await this.fetchJSON<{
        whatsapp_connected?: boolean;
        connection_state?: string;
      }>(`${url}/api/check`);
      return {
        apiOnline: true,
        connected: !!data.whatsapp_connected,
        state: data.connection_state ?? 'unknown',
      };
    } catch {
      try {
        await this.fetchJSON(`${url}/api/health`);
        return { apiOnline: true, connected: false, state: 'starting' };
      } catch {
        return { apiOnline: false, connected: false, state: 'offline' };
      }
    }
  }

  async sendText(to: string, message: string, sessionId?: string): Promise<string> {
    const fone = normalizePhone(to);
    const res = await this.fetchJSON<{ st?: number; error?: string }>(
      `${this.getSessionUrl(sessionId)}/api/send`,
      {
        method: 'POST',
        body: JSON.stringify({ to: fone, message, type: 'text' }),
      }
    );

    if (res.st !== 1) {
      throw new Error(res.error ?? 'Falha ao enviar mensagem WhatsApp');
    }
    return `Mensagem enviada para ${fone}`;
  }

  async checkNumber(phone: string, sessionId?: string): Promise<string> {
    const fone = normalizePhone(phone);
    const res = await this.fetchJSON<{ st?: number; error?: string; result?: unknown }>(
      `${this.getSessionUrl(sessionId)}/api/check-number`,
      {
        method: 'POST',
        body: JSON.stringify({ fone }),
      }
    );

    if (res.st !== 1) {
      return `Número ${fone} não verificado: ${res.error ?? 'erro'}`;
    }
    return `Número ${fone} está no WhatsApp: ${JSON.stringify(res.result)}`;
  }

  async listInbox(sessionId?: string): Promise<InboxChat[]> {
    return this.fetchJSON<InboxChat[]>(`${this.getSessionUrl(sessionId)}/api/inbox`);
  }

  async readMessages(chat: string, limit = 20, sessionId?: string): Promise<StoredMessage[]> {
    const chatJid = toChatJid(chat);
    const url = `${this.getSessionUrl(sessionId)}/api/messages?chat=${encodeURIComponent(chatJid)}&limit=${limit}`;
    return this.fetchJSON<StoredMessage[]>(url);
  }

  async listProjects(sessionId?: string): Promise<AkiraBrainProject[]> {
    return this.fetchJSON<AkiraBrainProject[]>(`${this.getSessionUrl(sessionId)}/api/projects`);
  }

  async createProject(
    name: string,
    description = '',
    sessionId?: string
  ): Promise<AkiraBrainProject> {
    return this.fetchJSON<AkiraBrainProject>(`${this.getSessionUrl(sessionId)}/api/projects`, {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async mapContactToProject(
    jid: string,
    projectId: number,
    sessionId?: string
  ): Promise<{ jid: string; project_id: number; project_name: string }> {
    return this.fetchJSON(`${this.getSessionUrl(sessionId)}/api/map`, {
      method: 'POST',
      body: JSON.stringify({ jid, project_id: projectId }),
    });
  }

  async searchMessages(
    query: string,
    limit = 20,
    sessionId?: string
  ): Promise<Array<{ message_id: string; chat_jid: string; body: string; score: number }>> {
    const url = `${this.getSessionUrl(sessionId)}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    return this.fetchJSON(url);
  }

  async findChatByName(name: string, sessionId?: string): Promise<InboxChat | null> {
    const results = await this.searchContacts(name, 1, sessionId);
    return results[0] ?? null;
  }

  async searchContacts(query: string, limit = 5, sessionId?: string): Promise<InboxChat[]> {
    const inbox = await this.listInbox(sessionId);
    return inbox
      .map((chat) => ({ chat, score: scoreChatMatch(chat, query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.chat);
  }

  formatInbox(inbox: InboxChat[]): string {
    if (inbox.length === 0) return 'Inbox vazio — nenhum chat capturado ainda.';
    return inbox
      .slice(0, 15)
      .map(
        (c) =>
          `- ${c.display_name || c.chat_jid} (${c.is_group ? 'grupo' : 'contato'}) — ${c.message_count} msgs, última: "${c.last_preview?.slice(0, 60) ?? ''}"`
      )
      .join('\n');
  }

  formatMessages(msgs: StoredMessage[]): string {
    if (msgs.length === 0) return 'Nenhuma mensagem encontrada.';
    return msgs
      .map((m) => {
        const who = m.is_from_me ? 'eu' : m.sender_jid.split('@')[0];
        const time = new Date(m.timestamp * 1000).toLocaleString('pt-BR');
        return `[${time}] ${who}: ${m.body || `(${m.type})`}`;
      })
      .join('\n');
  }

  private resolveSession(sessionId?: string): WhatsAppSessionConfig {
    const id = sessionId ?? this.defaultSessionId;
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Sessão WhatsApp "${id}" não encontrada ou desativada`);
    }
    return session;
  }

  private async fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout WhatsApp API (${this.timeoutMs}ms): ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export function normalizePhone(raw: string): string {
  let s = raw.trim();
  if (s.includes('@')) return s;

  const digits = s.replace(/\D/g, '');
  if (digits.startsWith('55') || digits.length >= 10) {
    return digits;
  }
  return digits;
}

export function toChatJid(raw: string): string {
  const s = raw.trim();
  if (s.includes('@')) return s;
  return `${normalizePhone(s)}@s.whatsapp.net`;
}

export function loadWhatsAppConfig(): WhatsAppConfig {
  const akiraBrainPort = portFromUrl(
    (process.env.WHATSAPP_AKIRA_BRAIN_URL ?? 'http://127.0.0.1:8765').replace(/\/$/, ''),
    8765
  );
  const sessionId = process.env.WHATSAPP_SESSION ?? 'principal';

  return {
    defaultSessionId: sessionId,
    timeoutMs: Number(process.env.WHATSAPP_TIMEOUT_MS ?? 25_000),
    sessions: [
      {
        id: sessionId,
        label: sessionId,
        port: akiraBrainPort,
        enabled: true,
      },
    ],
  };
}

function portFromUrl(url: string, fallback: number): number {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return fallback;
  } catch {
    return fallback;
  }
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function scoreChatMatch(chat: InboxChat, query: string): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;

  const name = normalizeSearchText(chat.display_name || '');
  const jid = chat.chat_jid.toLowerCase();
  const phone = jid.split('@')[0] ?? '';
  const digits = q.replace(/\D/g, '');

  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (name.includes(q)) return 80;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => name.includes(token))) return 75;
  if (tokens.some((token) => name.includes(token))) {
    return 50 + tokens.filter((token) => name.includes(token)).length * 5;
  }

  if (digits.length >= 4 && phone.includes(digits)) return 65;
  if (jid.includes(q)) return 40;

  return 0;
}
