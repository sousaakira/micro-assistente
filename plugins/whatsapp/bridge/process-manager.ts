import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

export interface SessionProcessOptions {
  id: string;
  label: string;
  port: number;
  dataDir: string;
}

interface ProcessEntry {
  proc: ChildProcess;
  options: SessionProcessOptions;
  lastError?: string;
  startedAt?: string;
}

export class WhatsAppProcessManager {
  private processes = new Map<string, ProcessEntry>();
  private shouldRun = false;
  private activeOptions: SessionProcessOptions[] = [];

  getRuntimeStatus(): WhatsAppRuntimeStatus {
    const sessions: ManagedProcessInfo[] = [];

    for (const [id, entry] of this.processes) {
      sessions.push({
        sessionId: id,
        label: entry.options.label,
        port: entry.options.port,
        name: 'akira-brain',
        running: this.isAlive(entry.proc),
        pid: entry.proc.pid,
        lastError: entry.lastError,
        startedAt: entry.startedAt,
      });
    }

    for (const opt of this.activeOptions) {
      if (!this.processes.has(opt.id)) {
        sessions.push({
          sessionId: opt.id,
          label: opt.label,
          port: opt.port,
          name: 'akira-brain',
          running: false,
          lastError: 'processo não iniciado',
        });
      }
    }

    return { managedByAgent: true, sessions };
  }

  isRunning(): boolean {
    for (const entry of this.processes.values()) {
      if (this.isAlive(entry.proc)) return true;
    }
    return false;
  }

  async start(sessions: SessionProcessOptions[]): Promise<void> {
    this.shouldRun = true;
    this.activeOptions = sessions;

    for (const session of sessions) {
      await this.startSession(session);
    }
  }

  async stop(): Promise<void> {
    this.shouldRun = false;
    this.activeOptions = [];

    const ids = [...this.processes.keys()];
    for (const id of ids) {
      await this.stopSession(id);
    }
  }

  async restart(sessions: SessionProcessOptions[]): Promise<void> {
    await this.stop();
    if (sessions.length > 0) {
      await this.start(sessions);
    }
  }

  async stopSessionById(id: string): Promise<void> {
    this.activeOptions = this.activeOptions.filter((opt) => opt.id !== id);
    await this.stopSession(id);
  }

  private async startSession(options: SessionProcessOptions): Promise<void> {
    const existing = this.processes.get(options.id);
    if (existing && this.isAlive(existing.proc)) return;

    const bin = path.join(PLUGIN_ROOT, 'akira-brain', 'akira-brain');
    if (!fs.existsSync(bin)) {
      this.processes.set(options.id, {
        proc: undefined as unknown as ChildProcess,
        options,
        lastError: 'Binário akira-brain não encontrado. Execute: npm run build:whatsapp',
      });
      return;
    }

    const sessionData = path.join(options.dataDir, 'sessions', options.id);
    fs.mkdirSync(sessionData, { recursive: true });

    const label = `[akira-brain:${options.id}]`;
    const child = spawn(bin, ['serve'], {
      cwd: path.join(PLUGIN_ROOT, 'akira-brain'),
      env: {
        ...process.env,
        AKIRA_BRAIN_DATA: sessionData,
        AKIRA_BRAIN_API_PORT: String(options.port),
        AKIRA_BRAIN_SESSION_ID: options.id,
        AKIRA_BRAIN_SESSION_LABEL: options.label,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const entry: ProcessEntry = {
      proc: child,
      options,
      startedAt: new Date().toISOString(),
    };
    this.processes.set(options.id, entry);
    this.pipeLogs(label, child);

    child.on('exit', (code, signal) => {
      const current = this.processes.get(options.id);
      if (!current || current.proc !== child) return;

      const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      current.lastError = `Processo encerrado (${reason})`;
      this.processes.delete(options.id);

      if (!this.shouldRun) return;

      console.warn(`${label} ${current.lastError} — reiniciando em 3s…`);
      setTimeout(() => {
        if (this.shouldRun) {
          void this.startSession(options);
        }
      }, 3000);
    });

    child.on('error', (err) => {
      const current = this.processes.get(options.id);
      if (current) current.lastError = err.message;
    });
  }

  private async stopSession(id: string): Promise<void> {
    const entry = this.processes.get(id);
    if (!entry) return;
    await this.killProcess(entry.proc);
    this.processes.delete(id);
  }

  private pipeLogs(label: string, child: ChildProcess): void {
    child.stdout?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        console.log(`${label} ${line}`);
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n').filter(Boolean)) {
        console.warn(`${label} ${line}`);
      }
    });
  }

  private isAlive(proc?: ChildProcess): boolean {
    return proc !== undefined && proc.exitCode === null && !proc.killed;
  }

  private killProcess(proc: ChildProcess | undefined): Promise<void> {
    if (!proc || proc.killed || proc.exitCode !== null) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (!proc.killed && proc.exitCode === null) {
          proc.kill('SIGKILL');
        }
      }, 5000);

      proc.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });

      proc.kill('SIGTERM');
    });
  }
}

export function urlFromPort(port: number): string {
  return `http://127.0.0.1:${port}`;
}

export function portFromUrl(url: string, fallback: number): number {
  try {
    const parsed = new URL(url);
    if (parsed.port) return Number(parsed.port);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return fallback;
  }
}

export function nextFreePort(sessions: { port: number }[], base = 8765): number {
  const used = new Set(sessions.map((s) => s.port));
  let port = base;
  while (used.has(port)) port += 1;
  return port;
}

export function slugifySessionId(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'sessao'
  );
}
