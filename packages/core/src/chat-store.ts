import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { ChatMessage, ChatSession, ToolActivity, ToolCall } from './types.js';

export class ChatStore {
  private db: Database.Database;

  constructor(dbPath = './data/chat.db') {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_name TEXT,
        tool_calls TEXT,
        tool_activities TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
      );
    `);
    this.ensureColumn('chat_messages', 'tool_activities', 'TEXT');
  }

  private ensureColumn(table: string, column: string, type: string): void {
    const cols = this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }

  createSession(title = 'Nova conversa'): ChatSession {
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
    };
    this.db
      .prepare('INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(session.id, session.title, session.createdAt, session.updatedAt);
    return session;
  }

  getSession(id: string): ChatSession | null {
    const row = this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as SessionRow | undefined;
    return row ? mapSession(row) : null;
  }

  listSessions(limit = 30): ChatSession[] {
    const rows = this.db
      .prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT ?')
      .all(limit) as SessionRow[];
    return rows.map(mapSession);
  }

  touchSession(id: string, title?: string): void {
    const now = new Date().toISOString();
    if (title) {
      this.db
        .prepare('UPDATE chat_sessions SET updated_at = ?, title = ? WHERE id = ?')
        .run(now, title, id);
    } else {
      this.db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now, id);
    }
  }

  addMessage(input: {
    sessionId: string;
    role: ChatMessage['role'];
    content: string;
    toolName?: string;
    toolCalls?: ToolCall[];
    toolActivities?: ToolActivity[];
  }): ChatMessage {
    const now = new Date().toISOString();
    const message: ChatMessage = {
      id: randomUUID(),
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      toolName: input.toolName,
      toolCalls: input.toolCalls,
      toolActivities: input.toolActivities,
      createdAt: now,
    };

    this.db
      .prepare(
        `INSERT INTO chat_messages (id, session_id, role, content, tool_name, tool_calls, tool_activities, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.toolName ?? null,
        message.toolCalls ? JSON.stringify(message.toolCalls) : null,
        message.toolActivities ? JSON.stringify(message.toolActivities) : null,
        message.createdAt
      );

    this.touchSession(input.sessionId);
    return message;
  }

  getMessages(sessionId: string, limit = 50): ChatMessage[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?'
      )
      .all(sessionId, limit) as MessageRow[];
    return rows.map(mapMessage);
  }

  /** Últimas N mensagens para contexto comprimido */
  getRecentForContext(sessionId: string, maxMessages = 6): ChatMessage[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM (
          SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?
        ) ORDER BY created_at ASC`
      )
      .all(sessionId, maxMessages) as MessageRow[];
    return rows.map(mapMessage);
  }

  close(): void {
    this.db.close();
  }
}

interface SessionRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: ChatMessage['role'];
  content: string;
  tool_name: string | null;
  tool_calls: string | null;
  tool_activities: string | null;
  created_at: string;
}

function mapSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    toolName: row.tool_name ?? undefined,
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
    toolActivities: row.tool_activities ? JSON.parse(row.tool_activities) : undefined,
    createdAt: row.created_at,
  };
}
