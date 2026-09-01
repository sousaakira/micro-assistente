import { EventEmitter } from 'node:events';

export interface AgentEvent {
  type: string;
  data: unknown;
  ts: number;
}

class AgentEventBus extends EventEmitter {
  publish(type: string, data: unknown): void {
    const event: AgentEvent = { type, data, ts: Date.now() };
    this.emit('event', event);
  }
}

export const eventBus = new AgentEventBus();
