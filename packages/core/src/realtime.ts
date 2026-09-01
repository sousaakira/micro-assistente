import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Express } from 'express';
import { eventBus, type AgentEvent } from './event-bus.js';

export function registerRealtime(app: Express, server: HttpServer): void {
  app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event: AgentEvent) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    };

    const onEvent = (event: AgentEvent) => send(event);
    eventBus.on('event', onEvent);
    send({ type: 'connected', data: { ok: true }, ts: Date.now() });

    req.on('close', () => {
      eventBus.off('event', onEvent);
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket: WebSocket) => {
    const onEvent = (event: AgentEvent) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(event));
      }
    };
    eventBus.on('event', onEvent);
    socket.send(JSON.stringify({ type: 'connected', data: { ok: true }, ts: Date.now() }));
    socket.on('close', () => eventBus.off('event', onEvent));
  });
}

export function publishAgentEvent(type: string, data: unknown): void {
  eventBus.publish(type, data);
}
