import type { Express } from 'express';
import { z } from 'zod';
import type { WhatsAppService } from '@micro-assistente/plugin-whatsapp';

const sessionSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  label: z.string().min(1).max(64),
  port: z.coerce.number().min(1024).max(65535).optional(),
  enabled: z.boolean().optional(),
});

const whatsappConfigSchema = z.object({
  timeoutMs: z.coerce.number().min(1000).max(120_000).optional(),
  enabled: z.boolean().optional(),
  autoStart: z.boolean().optional(),
  defaultSessionId: z.string().min(1).max(64).optional(),
  sessions: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().min(1).max(64),
        port: z.coerce.number().min(1024).max(65535),
        enabled: z.boolean(),
      })
    )
    .optional(),
});

export function registerWhatsAppRoutes(app: Express, service: WhatsAppService): void {
  app.get('/integrations/whatsapp', async (_req, res) => {
    try {
      res.json(await service.getFullStatus());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  app.patch('/integrations/whatsapp', (req, res) => {
    const parsed = whatsappConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const updated = service.updateConfig(parsed.data);
      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  app.post('/integrations/whatsapp/sessions', (req, res) => {
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const updated = service.addSession(parsed.data);
      res.status(201).json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  app.delete('/integrations/whatsapp/sessions/:id', async (req, res) => {
    try {
      const updated = await service.removeSession(req.params.id);
      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  app.post('/integrations/whatsapp/start', async (_req, res) => {
    try {
      service.updateConfig({ enabled: true, autoStart: true });
      await service.ensureRunning();
      res.json(await service.getFullStatus());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  app.post('/integrations/whatsapp/stop', async (_req, res) => {
    try {
      await service.stopServices();
      res.json(await service.getFullStatus());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  app.post('/integrations/whatsapp/restart', async (_req, res) => {
    try {
      await service.restartServices();
      res.json(await service.getFullStatus());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  app.get('/integrations/whatsapp/inbox', async (req, res) => {
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    try {
      const inbox = await service.getClient().listInbox(sessionId);
      res.json(inbox);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });

  app.get('/integrations/whatsapp/messages', async (req, res) => {
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const chat = typeof req.query.chat === 'string' ? req.query.chat : '';
    const limit = Number(req.query.limit ?? 50);

    if (!chat) {
      res.status(400).json({ error: 'chat é obrigatório' });
      return;
    }

    try {
      const messages = await service.getClient().readMessages(chat, limit, sessionId);
      res.json(messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });

  const sendMessageSchema = z.object({
    sessionId: z.string().optional(),
    chat: z.string().min(1),
    message: z.string().min(1),
  });

  app.post('/integrations/whatsapp/send', async (req, res) => {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const output = await service
        .getClient()
        .sendText(parsed.data.chat, parsed.data.message, parsed.data.sessionId);
      res.json({ ok: true, output });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });

  app.get('/integrations/whatsapp/projects', async (req, res) => {
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    try {
      const projects = await service.getClient().listProjects(sessionId);
      res.json(projects);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });

  const createProjectSchema = z.object({
    sessionId: z.string().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
  });

  app.post('/integrations/whatsapp/projects', async (req, res) => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const project = await service
        .getClient()
        .createProject(parsed.data.name, parsed.data.description ?? '', parsed.data.sessionId);
      res.status(201).json(project);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });

  const mapProjectSchema = z.object({
    sessionId: z.string().optional(),
    jid: z.string().min(1),
    projectId: z.coerce.number().int().positive(),
  });

  app.post('/integrations/whatsapp/map', async (req, res) => {
    const parsed = mapProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const result = await service
        .getClient()
        .mapContactToProject(parsed.data.jid, parsed.data.projectId, parsed.data.sessionId);
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });

  app.get('/integrations/whatsapp/contacts/search', async (req, res) => {
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Number(req.query.limit ?? 10);

    if (!q) {
      res.status(400).json({ error: 'q é obrigatório' });
      return;
    }

    try {
      const contacts = await service.getClient().searchContacts(q, limit, sessionId);
      res.json(contacts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });

  app.get('/integrations/whatsapp/messages/search', async (req, res) => {
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Number(req.query.limit ?? 20);

    if (!q) {
      res.status(400).json({ error: 'q é obrigatório' });
      return;
    }

    try {
      const hits = await service.getClient().searchMessages(q, limit, sessionId);
      res.json(hits);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: message });
    }
  });
}
