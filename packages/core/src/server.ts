import 'dotenv/config';
import cors from 'cors';
import express, { type Express } from 'express';
import { z } from 'zod';
import { AgentOrchestrator } from './orchestrator.js';
import { HAGMemory } from './hag-memory.js';
import { LLMClient } from './llm-client.js';
import { PluginRegistry } from './plugin-registry.js';
import { TaskQueue } from './task-queue.js';
import { createBuiltinPlugin } from './plugins/builtin.js';

const PORT = Number(process.env.AGENT_PORT ?? 3847);
const HOST = process.env.AGENT_HOST ?? '127.0.0.1';

const taskQueue = new TaskQueue(process.env.TASKS_DB_PATH ?? './data/tasks.db');
const memory = new HAGMemory(process.env.HAG_PATH ?? './data/hag');
const plugins = new PluginRegistry();
const llm = new LLMClient({
  baseUrl: process.env.LLM_BASE_URL ?? 'http://localhost:11434',
  model: process.env.LLM_MODEL ?? 'gemma2:9b',
  maxTokens: Number(process.env.LLM_MAX_TOKENS ?? 2048),
});

plugins.register(createBuiltinPlugin());
const orchestrator = new AgentOrchestrator(taskQueue, llm, memory, plugins);

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
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const deleted = taskQueue.delete(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Tarefa não encontrada' });
    return;
  }
  res.status(204).end();
});

app.get('/agent/status', (_req, res) => {
  res.json(orchestrator.getStatus());
});

app.post('/agent/start', (_req, res) => {
  orchestrator.start();
  res.json(orchestrator.getStatus());
});

app.post('/agent/stop', (_req, res) => {
  orchestrator.stop();
  res.json(orchestrator.getStatus());
});

app.get('/plugins', (_req, res) => {
  res.json(plugins.list());
});

app.get('/memory', (_req, res) => {
  res.json(memory.getAll());
});

app.listen(PORT, HOST, () => {
  console.log(`Micro Assistente API → http://${HOST}:${PORT}`);
});

export { app, orchestrator, taskQueue, memory, plugins, llm };
