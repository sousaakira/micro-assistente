import type { AgentPlugin, PluginTool } from './types.js';

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
