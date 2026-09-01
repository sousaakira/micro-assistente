import fs from 'node:fs';
import path from 'node:path';
import {
  WhatsAppClient,
  loadWhatsAppConfig,
  type AkiraBrainStatus,
  type WhatsAppConnectionStatus,
  type WhatsAppSessionConfig,
} from './client.js';
import {
  WhatsAppProcessManager,
  nextFreePort,
  slugifySessionId,
  urlFromPort,
  type ManagedProcessInfo,
  type WhatsAppRuntimeStatus,
} from './process-manager.js';

export interface WhatsAppPanelConfig {
  enabled: boolean;
  autoStart: boolean;
  timeoutMs: number;
  defaultSessionId: string;
  sessions: WhatsAppSessionConfig[];
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

export class WhatsAppService {
  private client: WhatsAppClient;
  private config: WhatsAppPanelConfig;
  private processManager = new WhatsAppProcessManager();
  private starting = false;

  constructor(private configPath: string) {
    this.config = this.loadConfig();
    this.client = new WhatsAppClient(this.toClientConfig());

    if (this.config.enabled && this.config.autoStart) {
      void this.ensureRunning();
    }
  }

  getClient(): WhatsAppClient {
    return this.client;
  }

  getConfig(): WhatsAppPanelConfig {
    return structuredClone(this.config);
  }

  updateConfig(partial: Partial<WhatsAppPanelConfig>): WhatsAppPanelConfig {
    const next: WhatsAppPanelConfig = {
      ...this.config,
      ...partial,
      sessions: partial.sessions ? partial.sessions.map((s) => ({ ...s })) : this.config.sessions,
    };

    if (partial.defaultSessionId && !next.sessions.some((s) => s.id === partial.defaultSessionId)) {
      throw new Error(`Sessão padrão "${partial.defaultSessionId}" não existe`);
    }

    const wasRunning = this.processManager.isRunning();
    const sessionsChanged = partial.sessions !== undefined;
    const enabledChanged = partial.enabled !== undefined && partial.enabled !== this.config.enabled;

    this.config = next;
    this.client.applyConfig(this.toClientConfig());
    this.saveConfig();

    if (enabledChanged && !this.config.enabled) {
      void this.stopServices();
    } else if (this.config.enabled && this.config.autoStart) {
      if (!wasRunning || sessionsChanged) {
        void this.restartServices();
      }
    }

    return this.getConfig();
  }

  addSession(input: { label: string; port?: number }): WhatsAppPanelConfig {
    const id = slugifySessionId(input.label);
    if (this.config.sessions.some((s) => s.id === id)) {
      throw new Error(`Sessão "${id}" já existe`);
    }

    const port = input.port ?? nextFreePort(this.config.sessions);
    const sessions = [
      ...this.config.sessions,
      { id, label: input.label.trim(), port, enabled: true },
    ];

    return this.updateConfig({
      sessions,
      defaultSessionId: this.config.defaultSessionId || id,
    });
  }

  async removeSession(sessionId: string): Promise<WhatsAppPanelConfig> {
    if (this.config.sessions.length <= 1) {
      throw new Error('É necessário manter ao menos uma sessão');
    }

    const session = this.config.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Sessão "${sessionId}" não encontrada`);
    }

    await this.processManager.stopSessionById(sessionId);

    const sessionData = path.join(this.getDataDir(), 'sessions', sessionId);
    if (fs.existsSync(sessionData)) {
      fs.rmSync(sessionData, { recursive: true, force: true });
    }

    const sessions = this.config.sessions.filter((s) => s.id !== sessionId);
    const defaultSessionId =
      this.config.defaultSessionId === sessionId
        ? sessions[0]?.id ?? 'principal'
        : this.config.defaultSessionId;

    return this.updateConfig({ sessions, defaultSessionId });
  }

  async ensureRunning(): Promise<void> {
    if (!this.config.enabled || this.starting) return;
    if (this.processManager.isRunning()) return;

    this.starting = true;
    try {
      await this.processManager.start(this.getProcessOptions());
      await this.waitForServices(25_000);
    } finally {
      this.starting = false;
    }
  }

  async stopServices(): Promise<void> {
    await this.processManager.stop();
  }

  async restartServices(): Promise<void> {
    await this.processManager.restart(this.getProcessOptions());
    await this.waitForServices(25_000);
  }

  async getFullStatus(): Promise<WhatsAppFullStatus> {
    const runtime = this.processManager.getRuntimeStatus();
    const sessions: WhatsAppSessionStatus[] = [];

    for (const session of this.config.sessions) {
      const runtimeEntry =
        runtime.sessions.find((r) => r.sessionId === session.id) ?? null;

      let connection: WhatsAppConnectionStatus = {
        apiOnline: false,
        connected: false,
        state: 'offline',
      };
      let akiraBrain: AkiraBrainStatus | null = null;

      if (session.enabled) {
        connection = await this.client.getStatus(session.id).catch(() => connection);
        if (connection.apiOnline) {
          akiraBrain = await this.client.getAkiraBrainStatus(session.id).catch(() => null);
        }
      }

      sessions.push({
        session,
        apiUrl: urlFromPort(session.port),
        connection,
        akiraBrain,
        runtime: runtimeEntry,
      });
    }

    return {
      config: this.getConfig(),
      sessions,
      runtime,
    };
  }

  private toClientConfig() {
    return {
      sessions: this.config.sessions,
      defaultSessionId: this.config.defaultSessionId,
      timeoutMs: this.config.timeoutMs,
    };
  }

  private getProcessOptions() {
    const dataDir = this.getDataDir();
    return this.config.sessions
      .filter((s) => s.enabled)
      .map((s) => ({
        id: s.id,
        label: s.label,
        port: s.port,
        dataDir,
      }));
  }

  private getDataDir(): string {
    if (process.env.WHATSAPP_DATA_PATH) {
      return process.env.WHATSAPP_DATA_PATH;
    }
    return path.join(path.dirname(path.resolve(this.configPath)), 'whatsapp');
  }

  private async waitForServices(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const enabled = this.config.sessions.filter((s) => s.enabled);

    while (Date.now() < deadline) {
      const checks = await Promise.all(
        enabled.map((s) => this.client.getStatus(s.id).catch(() => null))
      );
      if (checks.every((c) => c?.apiOnline)) return;
      await sleep(500);
    }
  }

  private loadConfig(): WhatsAppPanelConfig {
    const env = loadWhatsAppConfig();
    const defaults: WhatsAppPanelConfig = {
      enabled: true,
      autoStart: true,
      timeoutMs: env.timeoutMs ?? 25_000,
      defaultSessionId: env.defaultSessionId,
      sessions: env.sessions,
    };

    try {
      if (fs.existsSync(this.configPath)) {
        const saved = JSON.parse(fs.readFileSync(this.configPath, 'utf8')) as Record<string, unknown>;
        return this.normalizeConfig({ ...defaults, ...saved });
      }
    } catch {
      // arquivo inválido
    }

    return defaults;
  }

  private normalizeConfig(raw: Record<string, unknown>): WhatsAppPanelConfig {
    if (Array.isArray(raw.sessions) && raw.sessions.length > 0) {
      return {
        enabled: raw.enabled !== false,
        autoStart: raw.autoStart !== false,
        timeoutMs: Number(raw.timeoutMs ?? 25_000),
        defaultSessionId: String(raw.defaultSessionId ?? (raw.sessions as WhatsAppSessionConfig[])[0]?.id ?? 'principal'),
        sessions: (raw.sessions as WhatsAppSessionConfig[]).map((s) => ({
          id: String(s.id),
          label: String(s.label ?? s.id),
          port: Number(s.port),
          enabled: s.enabled !== false,
        })),
      };
    }

    // migração: config antiga com sessionName / akiraBrainPort
    const legacyName = String(raw.sessionName ?? 'principal');
    const legacyPort = Number(
      raw.akiraBrainPort ??
        (raw.akiraBrainUrl ? new URL(String(raw.akiraBrainUrl)).port : '') ??
        8765
    );

    return {
      enabled: raw.enabled !== false,
      autoStart: raw.autoStart !== false,
      timeoutMs: Number(raw.timeoutMs ?? 25_000),
      defaultSessionId: legacyName,
      sessions: [
        {
          id: legacyName,
          label: legacyName,
          port: legacyPort,
          enabled: true,
        },
      ],
    };
  }

  private saveConfig(): void {
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, `${JSON.stringify(this.config, null, 2)}\n`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { slugifySessionId, nextFreePort, urlFromPort };
