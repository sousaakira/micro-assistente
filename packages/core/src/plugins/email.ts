import type { AgentPlugin } from '../types.js';

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
          const configured = !!(process.env.EMAIL_IMAP_HOST && process.env.EMAIL_SMTP_HOST);
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
        execute: async () => {
          if (!process.env.EMAIL_IMAP_HOST) {
            return {
              success: false,
              output: 'Plugin e-mail não configurado. Veja .env.example (EMAIL_IMAP_HOST, etc.)',
            };
          }
          return {
            success: false,
            output: 'Leitura IMAP em implementação (#10). Configure as variáveis e aguarde próxima versão.',
          };
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
        execute: async () => {
          if (!process.env.EMAIL_SMTP_HOST) {
            return {
              success: false,
              output: 'Plugin e-mail não configurado. Veja .env.example',
            };
          }
          return {
            success: false,
            output: 'Envio SMTP em implementação (#10).',
          };
        },
      },
    ],
  };
}
