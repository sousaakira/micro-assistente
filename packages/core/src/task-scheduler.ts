import Database from 'better-sqlite3';
import cron, { type ScheduledTask } from 'node-cron';
import { randomUUID } from 'crypto';
import type { AgentOrchestrator } from './orchestrator.js';
import type { TaskQueue } from './task-queue.js';

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

export interface CreateScheduleInput {
  title: string;
  description?: string;
  cron: string;
  pluginId?: string;
  autoRunAgent?: boolean;
  enabled?: boolean;
}

export class TaskScheduler {
  private db: Database.Database;
  private jobs = new Map<string, ScheduledTask>();

  constructor(
    db: Database.Database,
    private taskQueue: TaskQueue,
    private orchestrator: AgentOrchestrator
  ) {
    this.db = db;
    this.init();
    this.reloadJobs();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_schedules (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        cron TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        plugin_id TEXT,
        auto_run_agent INTEGER DEFAULT 1,
        last_run_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  getAll(): TaskSchedule[] {
    const rows = this.db
      .prepare('SELECT * FROM task_schedules ORDER BY created_at DESC')
      .all() as ScheduleRow[];
    return rows.map(mapRow);
  }

  getById(id: string): TaskSchedule | null {
    const row = this.db.prepare('SELECT * FROM task_schedules WHERE id = ?').get(id) as
      | ScheduleRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  add(input: CreateScheduleInput): TaskSchedule {
    if (!cron.validate(input.cron)) {
      throw new Error(`Expressão cron inválida: ${input.cron}`);
    }

    const now = new Date().toISOString();
    const schedule: TaskSchedule = {
      id: randomUUID(),
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      cron: input.cron.trim(),
      enabled: input.enabled ?? true,
      pluginId: input.pluginId,
      autoRunAgent: input.autoRunAgent ?? true,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO task_schedules
         (id, title, description, cron, enabled, plugin_id, auto_run_agent, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        schedule.id,
        schedule.title,
        schedule.description,
        schedule.cron,
        schedule.enabled ? 1 : 0,
        schedule.pluginId ?? null,
        schedule.autoRunAgent ? 1 : 0,
        schedule.createdAt,
        schedule.updatedAt
      );

    if (schedule.enabled) this.startJob(schedule);
    return schedule;
  }

  setEnabled(id: string, enabled: boolean): TaskSchedule | null {
    const schedule = this.getById(id);
    if (!schedule) return null;

    const updated: TaskSchedule = {
      ...schedule,
      enabled,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare('UPDATE task_schedules SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, updated.updatedAt, id);

    this.stopJob(id);
    if (enabled) this.startJob(updated);
    return updated;
  }

  delete(id: string): boolean {
    this.stopJob(id);
    const result = this.db.prepare('DELETE FROM task_schedules WHERE id = ?').run(id);
    return result.changes > 0;
  }

  reloadJobs(): void {
    for (const id of [...this.jobs.keys()]) this.stopJob(id);
    for (const schedule of this.getAll()) {
      if (schedule.enabled) this.startJob(schedule);
    }
  }

  private startJob(schedule: TaskSchedule): void {
    if (!cron.validate(schedule.cron)) return;
    this.stopJob(schedule.id);

    const job = cron.schedule(schedule.cron, () => {
      void this.runSchedule(schedule.id);
    });
    this.jobs.set(schedule.id, job);
  }

  private stopJob(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
    }
  }

  private async runSchedule(id: string): Promise<void> {
    const schedule = this.getById(id);
    if (!schedule || !schedule.enabled) return;

    this.taskQueue.add({
      title: schedule.title,
      description: schedule.description,
      pluginId: schedule.pluginId,
    });

    const now = new Date().toISOString();
    this.db.prepare('UPDATE task_schedules SET last_run_at = ?, updated_at = ? WHERE id = ?').run(
      now,
      now,
      id
    );

    if (schedule.autoRunAgent && !this.orchestrator.getStatus().running) {
      await this.orchestrator.start();
    }
  }
}

interface ScheduleRow {
  id: string;
  title: string;
  description: string;
  cron: string;
  enabled: number;
  plugin_id: string | null;
  auto_run_agent: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ScheduleRow): TaskSchedule {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    cron: row.cron,
    enabled: row.enabled === 1,
    pluginId: row.plugin_id ?? undefined,
    autoRunAgent: row.auto_run_agent === 1,
    lastRunAt: row.last_run_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
