import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { CreateTaskInput, Task, TaskStatus } from './types.js';

export class TaskQueue {
  private db: Database.Database;

  constructor(dbPath = './data/tasks.db') {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        plugin_id TEXT,
        params TEXT,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      )
    `);
  }

  add(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? '',
      status: 'pending',
      pluginId: input.pluginId,
      params: input.params,
      createdAt: now,
      updatedAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO tasks (id, title, description, status, plugin_id, params, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        task.id,
        task.title,
        task.description,
        task.status,
        task.pluginId ?? null,
        task.params ? JSON.stringify(task.params) : null,
        task.createdAt,
        task.updatedAt
      );

    return task;
  }

  getAll(): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all() as Row[];
    return rows.map(mapRow);
  }

  getById(id: string): Task | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Row | undefined;
    return row ? mapRow(row) : null;
  }

  getNext(): Task | null {
    const row = this.db
      .prepare("SELECT * FROM tasks WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1")
      .get() as Row | undefined;
    return row ? mapRow(row) : null;
  }

  updateStatus(id: string, status: TaskStatus, extra?: Partial<Task>): Task | null {
    const now = new Date().toISOString();
    const task = this.getById(id);
    if (!task) return null;

    const updated: Task = {
      ...task,
      ...extra,
      status,
      updatedAt: now,
      completedAt: ['completed', 'failed', 'cancelled'].includes(status) ? now : task.completedAt,
    };

    this.db
      .prepare(
        `UPDATE tasks SET status = ?, result = ?, error = ?, updated_at = ?, completed_at = ?
         WHERE id = ?`
      )
      .run(
        updated.status,
        updated.result ?? null,
        updated.error ?? null,
        updated.updatedAt,
        updated.completedAt ?? null,
        id
      );

    return updated;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  countByStatus(status: TaskStatus): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM tasks WHERE status = ?')
      .get(status) as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}

interface Row {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  plugin_id: string | null;
  params: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function mapRow(row: Row): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    pluginId: row.plugin_id ?? undefined,
    params: row.params ? JSON.parse(row.params) : undefined,
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  };
}
