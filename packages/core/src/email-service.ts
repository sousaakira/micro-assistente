import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

export interface EmailConfig {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  user: string;
  pass: string;
  secure: boolean;
}

export interface EmailSummary {
  uid: number;
  from: string;
  subject: string;
  date: string;
  preview: string;
}

function getConfig(): EmailConfig | null {
  const imapHost = process.env.EMAIL_IMAP_HOST;
  const smtpHost = process.env.EMAIL_SMTP_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!imapHost || !smtpHost || !user || !pass) return null;

  return {
    imapHost,
    imapPort: Number(process.env.EMAIL_IMAP_PORT ?? 993),
    smtpHost,
    smtpPort: Number(process.env.EMAIL_SMTP_PORT ?? 587),
    user,
    pass,
    secure: process.env.EMAIL_SECURE !== 'false',
  };
}

export function isEmailConfigured(): boolean {
  return getConfig() !== null;
}

export async function listUnreadEmails(limit = 10): Promise<EmailSummary[]> {
  const config = getConfig();
  if (!config) throw new Error('E-mail não configurado');

  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const messages: EmailSummary[] = [];
      const iterator = client.fetch({ seen: false }, { envelope: true, source: true }, { uid: true });
      for (;;) {
        const { value: msg, done } = await iterator.next();
        if (done || !msg) break;
        const from = msg.envelope?.from?.[0];
        const fromText = from ? `${from.name ?? ''} <${from.address}>`.trim() : 'desconhecido';
        const subject = msg.envelope?.subject ?? '(sem assunto)';
        const date = msg.envelope?.date?.toISOString() ?? '';
        let preview = '';
        if (msg.source) {
          preview = msg.source.toString('utf8').slice(0, 200).replace(/\s+/g, ' ');
        }
        messages.push({ uid: msg.uid, from: fromText, subject, date, preview });
        if (messages.length >= limit) break;
      }
      return messages;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error('E-mail não configurado');

  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.user, pass: config.pass },
  });

  const info = await transport.sendMail({
    from: config.user,
    to,
    subject,
    text: body,
  });

  return `E-mail enviado para ${to} (id: ${info.messageId ?? 'ok'})`;
}
