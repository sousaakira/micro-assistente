import 'dotenv/config';
import { createServer } from 'node:http';
import cors from 'cors';
import express, { type Express } from 'express';
import { z } from 'zod';
import { AgentConfigStore, type AgentConfig } from './agent-config.js';
import { AgentOrchestrator } from './orchestrator.js';
import { HAGMemory } from './hag-memory.js';
import { LLMClient } from './llm-client.js';
import { PluginRegistry } from './plugin-registry.js';
import { publishAgentEvent, registerRealtime } from './realtime.js';
import { TaskQueue } from './task-queue.js';
import { createBuiltinPlugin } from './plugins/builtin.js';
import { createEmailPlugin } from './plugins/email.js';
import { createServersPlugin } from './plugins/servers.js';
import { createTasksPlugin } from './plugins/tasks.js';
import { TaskScheduler } from './task-scheduler.js';
import { createWhatsAppPlugin, WhatsAppService } from '@micro-assistente/plugin-whatsapp';
import { ChatStore } from './chat-store.js';
import { ChatService } from './chat-service.js';
import { registerWhatsAppRoutes } from './whatsapp-routes.js';

const PORT = Number(process.env.AGENT_PORT ?? 3847);
const HOST = process.env.AGENT_HOST ?? '127.0.0.1';

const taskQueue = new TaskQueue(process.env.TASKS_DB_PATH ?? './data/tasks.db');
const memory = new HAGMemory(process.env.HAG_PATH ?? './data/hag');
const plugins = new PluginRegistry();
const agentConfigStore = new AgentConfigStore(
  process.env.AGENT_CONFIG_PATH ?? './data/agent-config.json'
);
plugins.setDisabled(agentConfigStore.get().disabledPlugins);

const llm = new LLMClient(agentConfigStore.getEffectiveLLM());

plugins.register(createBuiltinPlugin());
const orchestrator = new AgentOrchestrator(taskQueue, llm, memory, plugins);
const taskScheduler = new TaskScheduler(taskQueue.getDatabase(), taskQueue, orchestrator);
plugins.register(createTasksPlugin(taskQueue, orchestrator, taskScheduler));
plugins.register(createEmailPlugin());
plugins.register(createServersPlugin());

const whatsappService = new WhatsAppService(
  process.env.WHATSAPP_CONFIG_PATH ?? './data/whatsapp-config.json'
);
plugins.register(createWhatsAppPlugin(whatsappService));

const chatStore = new ChatStore(process.env.CHAT_DB_PATH ?? './data/chat.db');
const chatService = new ChatService(chatStore, llm, memory, taskQueue, plugins);

const app: Express = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const llmAvailable = await llm.isAvailable();
  res.json({
    status: 'ok',
    llm: llmAvailable,
    agent: orchestrator.getStatus(),
  });
});

app.get('/tasks', (_req, res) => {
  res.json(taskQueue.getAll());
});

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  pluginId: z.string().optional(),
  params: z.record(z.unknown()).optional(),
});

app.post('/tasks', (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const task = taskQueue.add(parsed.data);
  publishAgentEvent('tasks', { action: 'created', task });
  res.status(201).json(task);
});

app.patch('/tasks/:id', (req, res) => {
  const { status, result, error } = req.body;
  if (!status) {
    res.status(400).json({ error: 'status é obrigatório' });
    return;
  }
  const task = taskQueue.updateStatus(req.params.id, status, { result, error });
  if (!task) {
    res.status(404).json({ error: 'Tarefa não encontrada' });
    return;
  }
  publishAgentEvent('tasks', { action: 'updated', task });
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const deleted = taskQueue.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Tarefa não encontrada' });
    return;
  }
  publishAgentEvent('tasks', { action: 'deleted', id: req.params.id });
  res.status(204).end();
});

const createScheduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  cron: z.string().min(1),
  pluginId: z.string().optional(),
  autoRunAgent: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

app.get('/schedules', (_req, res) => {
  res.json(taskScheduler.getAll());
});

app.post('/schedules', (req, res) => {
  const parsed = createScheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const schedule = taskScheduler.add(parsed.data);
    res.status(201).json(schedule);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

app.patch('/schedules/:id', (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled (boolean) é obrigatório' });
    return;
  }
  const schedule = taskScheduler.setEnabled(req.params.id, req.body.enabled);
  if (!schedule) {
    res.status(404).json({ error: 'Agendamento não encontrado' });
    return;
  }
  res.json(schedule);
});

app.delete('/schedules/:id', (req, res) => {
  const deleted = taskScheduler.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Agendamento não encontrado' });
    return;
  }
  res.status(204).end();
});

app.get('/agent/status', (_req, res) => {
  res.json(orchestrator.getStatus());
});

app.post('/agent/start', (_req, res) => {
  orchestrator.start();
  const status = orchestrator.getStatus();
  publishAgentEvent('agent', status);
  res.json(status);
});

app.post('/agent/stop', (_req, res) => {
  orchestrator.stop();
  const status = orchestrator.getStatus();
  publishAgentEvent('agent', status);
  res.json(status);
});

const agentConfigSchema = z.object({
  llm: z
    .object({
      provider: z.enum(['llama-cpp', 'ollama', 'openai']).optional(),
      baseUrl: z.string().min(1).optional(),
      model: z.string().min(1).optional(),
      maxTokens: z.coerce.number().min(256).max(32768).optional(),
      apiKey: z.string().optional(),
    })
    .optional(),
  disabledPlugins: z.array(z.string()).optional(),
});

app.get('/agent/config', (_req, res) => {
  res.json({
    config: agentConfigStore.get(),
    effectiveLlm: agentConfigStore.getEffectiveLLM(),
    plugins: plugins.list(),
  });
});

app.patch('/agent/config', (req, res) => {
  const parsed = agentConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const updated = agentConfigStore.update({
    llm: parsed.data.llm
      ? {
          ...parsed.data.llm,
          provider: parsed.data.llm.provider as AgentConfig['llm']['provider'] | undefined,
        }
      : undefined,
    disabledPlugins: parsed.data.disabledPlugins,
  });
  plugins.setDisabled(updated.disabledPlugins);
  llm.updateConfig(agentConfigStore.getEffectiveLLM());
  publishAgentEvent('config', updated);

  res.json({
    config: updated,
    effectiveLlm: agentConfigStore.getEffectiveLLM(),
    plugins: plugins.list(),
  });
});

app.get('/plugins', (_req, res) => {
  res.json(plugins.list());
});

app.get('/memory', (_req, res) => {
  res.json(memory.getAll());
});

app.get('/chat/sessions', (_req, res) => {
  res.json(chatService.listSessions());
});

app.post('/chat/sessions', (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
  res.status(201).json(chatService.createSession(title));
});

app.get('/chat/sessions/:id/messages', (req, res) => {
  const session = chatStore.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Sessão não encontrada' });
    return;
  }
  res.json(chatService.getMessages(req.params.id));
});

const sendChatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().optional(),
});

app.post('/chat', async (req, res) => {
  const parsed = sendChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const reply = await chatService.send(parsed.data);
    res.json(reply);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

registerWhatsAppRoutes(app, whatsappService);

const appInstance = app;
const httpServer = createServer(appInstance);
registerRealtime(appInstance, httpServer);

const shutdown = async (signal: string) => {
  console.log(`\n${signal} — encerrando serviços WhatsApp…`);
  await whatsappService.stopServices();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

httpServer.listen(PORT, HOST, () => {
  console.log(`Micro Assistente API → http://${HOST}:${PORT}`);
  void whatsappService.ensureRunning().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[whatsapp] auto-start:', message);
  });
});

export { app, httpServer, orchestrator, taskQueue, taskScheduler, memory, plugins, llm, chatService, chatStore, agentConfigStore };
