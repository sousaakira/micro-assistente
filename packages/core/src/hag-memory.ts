import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { HAGEntry } from './types.js';

export class HAGMemory {
  private basePath: string;
  private cache: Map<string, HAGEntry> = new Map();

  constructor(basePath = './data/hag') {
    this.basePath = basePath;
    mkdirSync(basePath, { recursive: true });
    this.loadAll();
  }

  private loadAll(): void {
    const indexPath = join(this.basePath, 'index.json');
    if (!existsSync(indexPath)) {
      writeFileSync(indexPath, JSON.stringify([]));
      return;
    }

    const ids: string[] = JSON.parse(readFileSync(indexPath, 'utf-8'));
    for (const id of ids) {
      const entryPath = join(this.basePath, `${id}.json`);
      if (existsSync(entryPath)) {
        const entry = JSON.parse(readFileSync(entryPath, 'utf-8')) as HAGEntry;
        this.cache.set(id, entry);
      }
    }
  }

  private persistIndex(): void {
    writeFileSync(join(this.basePath, 'index.json'), JSON.stringify([...this.cache.keys()]));
  }

  store(key: string, content: string, tags: string[] = []): HAGEntry {
    const entry: HAGEntry = {
      id: randomUUID(),
      key,
      content,
      tags,
      createdAt: new Date().toISOString(),
    };

    this.cache.set(entry.id, entry);
    writeFileSync(join(this.basePath, `${entry.id}.json`), JSON.stringify(entry, null, 2));
    this.persistIndex();
    return entry;
  }

  /** Busca entradas relevantes por tags ou keyword — retorna no máximo `limit` entradas */
  query(query: string, tags?: string[], limit = 5): HAGEntry[] {
    const lowerQuery = query.toLowerCase();
    const results: HAGEntry[] = [];

    for (const entry of this.cache.values()) {
      let score = 0;

      if (tags?.some((t) => entry.tags.includes(t))) score += 2;
      if (entry.key.toLowerCase().includes(lowerQuery)) score += 3;
      if (entry.content.toLowerCase().includes(lowerQuery)) score += 1;

      if (score > 0) {
        results.push({ ...entry, relevance: score });
      }
    }

    return results
      .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0))
      .slice(0, limit);
  }

  /** Formata memória para injeção no prompt — comprimido */
  formatForPrompt(query: string, maxChars = 1200): string {
    const entries = this.query(query);
    if (entries.length === 0) return '';

    let output = 'Memória relevante:\n';
    let chars = output.length;

    for (const entry of entries) {
      const line = `- [${entry.key}] ${entry.content.slice(0, 200)}\n`;
      if (chars + line.length > maxChars) break;
      output += line;
      chars += line.length;
    }

    return output.trim();
  }

  getAll(): HAGEntry[] {
    return [...this.cache.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  delete(id: string): boolean {
    const deleted = this.cache.delete(id);
    if (deleted) {
      this.persistIndex();
    }
    return deleted;
  }
}
