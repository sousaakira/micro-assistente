import type { AgentPlugin } from '../types.js';
import { isEmailConfigured, listUnreadEmails, sendEmail } from '../email-service.js';

export function createEmailPlugin(): AgentPlugin {
  return {
    id: 'email',
    name: 'E-mail',
    description: 'Leitura e envio de e-mail (IMAP/SMTP) — configuração via variáveis de ambiente',
    tools: [
      {
        name: 'email_status',
        description: 'Verifica se o plugin de e-mail está configurado',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          const configured = isEmailConfigured();
          return {
            success: true,
            output: configured
              ? `E-mail configurado: ${process.env.EMAIL_USER ?? 'usuário não definido'}`
              : 'E-mail não configurado. Defina EMAIL_IMAP_HOST, EMAIL_SMTP_HOST, EMAIL_USER, EMAIL_PASS no .env',
          };
        },
      },
      {
        name: 'email_list_unread',
        description: 'Lista e-mails não lidos (requer configuração IMAP)',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Máximo de e-mails (padrão 10)' },
          },
        },
        execute: async (args: Record<string, unknown>) => {
          if (!isEmailConfigured()) {
            return {
              success: false,
              output: 'Plugin e-mail não configurado. Veja .env.example (EMAIL_IMAP_HOST, etc.)',
            };
          }
          try {
            const limit = Number(args.limit ?? 10);
            const emails = await listUnreadEmails(limit);
            if (emails.length === 0) {
              return { success: true, output: 'Nenhum e-mail não lido.' };
            }
            const lines = emails.map(
              (e) => `- [${e.uid}] ${e.from} | ${e.subject} | ${e.date}\n  ${e.preview.slice(0, 120)}`
            );
            return { success: true, output: lines.join('\n'), data: emails };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, output: message };
          }
        },
      },
      {
        name: 'email_send',
        description: 'Envia e-mail de texto (requer configuração SMTP)',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Destinatário' },
            subject: { type: 'string', description: 'Assunto' },
            body: { type: 'string', description: 'Corpo do e-mail' },
          },
          required: ['to', 'subject', 'body'],
        },
        execute: async (args: Record<string, unknown>) => {
          if (!isEmailConfigured()) {
            return {
              success: false,
              output: 'Plugin e-mail não configurado. Veja .env.example',
            };
          }
          try {
            const output = await sendEmail(
              String(args.to),
              String(args.subject),
              String(args.body)
            );
            return { success: true, output };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, output: message };
          }
        },
      },
    ],
  };
}
