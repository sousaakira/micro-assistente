import type { AgentPlugin, PluginTool } from './types.js';

/** Tools de gestão — só no chat, nunca na execução automática de tarefas */
export const CHAT_ONLY_TOOLS = new Set([
  'create_task',
  'start_agent',
  'stop_agent',
]);

export class PluginRegistry {
  private plugins = new Map<string, AgentPlugin>();

  register(plugin: AgentPlugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" já registrado`);
    }
    this.plugins.set(plugin.id, plugin);
  }

  unregister(id: string): boolean {
    return this.plugins.delete(id);
  }

  get(id: string): AgentPlugin | undefined {
    return this.plugins.get(id);
  }

  getAll(): AgentPlugin[] {
    return [...this.plugins.values()];
  }

  getToolsForPlugin(pluginId?: string): PluginTool[] {
    if (pluginId) {
      return this.plugins.get(pluginId)?.tools ?? [];
    }
    return this.getAll().flatMap((p) => p.tools);
  }

  /** Tools disponíveis no chat (todas) */
  getChatTools(): PluginTool[] {
    return this.getAll().flatMap((p) => p.tools);
  }

  /** Tools para execução automática — sem create_task/start/stop; só plugin da tarefa ou builtin */
  getExecutionTools(taskPluginId?: string): PluginTool[] {
    if (taskPluginId) {
      return this.getToolsForPlugin(taskPluginId).filter(
        (t) => !CHAT_ONLY_TOOLS.has(t.name)
      );
    }
    const builtin = this.plugins.get('builtin')?.tools ?? [];
    return builtin.filter((t) => !CHAT_ONLY_TOOLS.has(t.name));
  }

  async loadAll(configs: Record<string, unknown> = {}): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.onLoad?.(configs[plugin.id]);
    }
  }

  async unloadAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.onUnload?.();
    }
  }

  list(): Array<{ id: string; name: string; description: string; toolCount: number }> {
    return this.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      toolCount: p.tools.length,
    }));
  }
}
