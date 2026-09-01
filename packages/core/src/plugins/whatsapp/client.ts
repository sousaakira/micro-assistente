/**
 * Cliente HTTP para o ecossistema AkiraBrain (whatsmeow-api + akira-brain).
 * - whatsmeow-api: enviar mensagens, grupos, status de conexão
 * - akira-brain API: ler inbox e mensagens persistidas
 */

export interface WhatsAppConfig {
  whatsmeowUrl: string;
  akiraBrainUrl: string;
  timeoutMs?: number;
}

export interface WhatsAppConnectionStatus {
  connected: boolean;
  state: string;
  whatsmeow: boolean;
  akiraBrain: boolean;
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

export class WhatsAppClient {
  private timeoutMs: number;

  constructor(private config: WhatsAppConfig) {
    this.timeoutMs = config.timeoutMs ?? 25_000;
  }

  async getStatus(): Promise<WhatsAppConnectionStatus> {
    const [whatsmeow, akiraBrain] = await Promise.all([
      this.whatsmeowCheck(),
      this.akiraBrainHealth(),
    ]);

    return {
      connected: whatsmeow.connected,
      state: whatsmeow.state,
      whatsmeow: whatsmeow.ok,
      akiraBrain: akiraBrain.ok,
    };
  }

  async sendText(to: string, message: string): Promise<string> {
    const fone = normalizePhone(to);
    const res = await this.fetchJSON<{ st?: number; error?: string; result?: unknown }>(
      `${this.config.whatsmeowUrl}/bot-text-message`,
      {
        method: 'POST',
        body: JSON.stringify({ fone, message, type: 'text' }),
      }
    );

    if (res.st !== 1) {
      throw new Error(res.error ?? 'Falha ao enviar mensagem WhatsApp');
    }
    return `Mensagem enviada para ${fone}`;
  }

  async checkNumber(phone: string): Promise<string> {
    const fone = normalizePhone(phone);
    const res = await this.fetchJSON<{ st?: number; error?: string; result?: unknown }>(
      `${this.config.whatsmeowUrl}/check-number`,
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

  async listInbox(): Promise<InboxChat[]> {
    return this.fetchJSON<InboxChat[]>(`${this.config.akiraBrainUrl}/api/inbox`);
  }

  async readMessages(chat: string, limit = 20): Promise<StoredMessage[]> {
    const chatJid = toChatJid(chat);
    const url = `${this.config.akiraBrainUrl}/api/messages?chat=${encodeURIComponent(chatJid)}&limit=${limit}`;
    return this.fetchJSON<StoredMessage[]>(url);
  }

  async listGroups(): Promise<string> {
    const res = await this.fetchJSON<{ st?: number; error?: string; result?: unknown }>(
      `${this.config.whatsmeowUrl}/bot-grupo-get-all`,
      { method: 'POST', body: JSON.stringify({}) }
    );

    if (res.st !== 1 && res.error) {
      throw new Error(res.error);
    }
    return JSON.stringify(res.result ?? res, null, 2);
  }

  /** Busca contato no inbox pelo nome (ex: "Geovane") */
  async findChatByName(name: string): Promise<InboxChat | null> {
    const inbox = await this.listInbox();
    const lower = name.toLowerCase();
    return (
      inbox.find((c) => c.display_name.toLowerCase().includes(lower)) ??
      inbox.find((c) => c.chat_jid.toLowerCase().includes(lower)) ??
      null
    );
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

  private async whatsmeowCheck(): Promise<{ ok: boolean; connected: boolean; state: string }> {
    try {
      const data = await this.fetchJSON<{
        whatsapp_connected?: boolean;
        connection_state?: string;
      }>(`${this.config.whatsmeowUrl}/check`);
      return {
        ok: true,
        connected: !!data.whatsapp_connected,
        state: data.connection_state ?? 'unknown',
      };
    } catch {
      return { ok: false, connected: false, state: 'offline' };
    }
  }

  private async akiraBrainHealth(): Promise<{ ok: boolean }> {
    try {
      await this.fetchJSON(`${this.config.akiraBrainUrl}/api/health`);
      return { ok: true };
    } catch {
      return { ok: false };
    }
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

/** Normaliza telefone para formato whatsmeow (5588998002111 ou com @s.whatsapp.net) */
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
  return {
    whatsmeowUrl: (process.env.WHATSAPP_WHATSMEOW_URL ?? 'http://127.0.0.1:5000').replace(/\/$/, ''),
    akiraBrainUrl: (process.env.WHATSAPP_AKIRA_BRAIN_URL ?? 'http://127.0.0.1:8765').replace(/\/$/, ''),
    timeoutMs: Number(process.env.WHATSAPP_TIMEOUT_MS ?? 25_000),
  };
}
