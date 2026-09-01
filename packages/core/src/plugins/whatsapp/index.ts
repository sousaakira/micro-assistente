import type { AgentPlugin } from '../../types.js';
import { loadWhatsAppConfig, WhatsAppClient, normalizePhone } from './client.js';

export function createWhatsAppPlugin(): AgentPlugin {
  const client = new WhatsAppClient(loadWhatsAppConfig());

  return {
    id: 'whatsapp',
    name: 'WhatsApp',
    description:
      'Integração com AkiraBrain (whatsmeow-api + akira-brain): enviar e ler mensagens WhatsApp',
    tools: [
      {
        name: 'whatsapp_status',
        description: 'Verifica status da conexão WhatsApp (whatsmeow-api e akira-brain)',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          const status = await client.getStatus();
          return {
            success: status.connected || status.akiraBrain,
            output:
              `WhatsApp — whatsmeow: ${status.whatsmeow ? status.state : 'offline'}, ` +
              `akira-brain: ${status.akiraBrain ? 'online' : 'offline'}, ` +
              `conectado: ${status.connected ? 'sim' : 'não'}`,
            data: status,
          };
        },
      },
      {
        name: 'whatsapp_send_message',
        description:
          'Envia mensagem de texto WhatsApp. Use telefone (5588998002111) ou JID. Para contato por nome, use whatsapp_find_contact primeiro.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Telefone, JID ou número com DDI' },
            message: { type: 'string', description: 'Texto da mensagem' },
          },
          required: ['to', 'message'],
        },
        execute: async (args) => {
          const to = String(args.to);
          const message = String(args.message);
          const output = await client.sendText(to, message);
          return { success: true, output };
        },
      },
      {
        name: 'whatsapp_find_contact',
        description:
          'Busca contato ou chat no inbox akira-brain pelo nome (ex: "Geovane"). Retorna JID para envio.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nome ou parte do nome do contato' },
          },
          required: ['name'],
        },
        execute: async (args) => {
          const chat = await client.findChatByName(String(args.name));
          if (!chat) {
            return {
              success: false,
              output: `Contato "${args.name}" não encontrado no inbox. Use whatsapp_list_inbox para ver chats disponíveis.`,
            };
          }
          const phone = chat.chat_jid.split('@')[0];
          return {
            success: true,
            output: `Encontrado: ${chat.display_name} — JID: ${chat.chat_jid}, telefone: ${phone}`,
            data: chat,
          };
        },
      },
      {
        name: 'whatsapp_list_inbox',
        description: 'Lista chats capturados pelo akira-brain (inbox e contatos conhecidos)',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Máximo de chats (padrão 15)' },
          },
        },
        execute: async () => {
          const inbox = await client.listInbox();
          return { success: true, output: client.formatInbox(inbox), data: inbox };
        },
      },
      {
        name: 'whatsapp_read_messages',
        description: 'Lê mensagens recentes de um chat (telefone, JID ou nome mapeado no inbox)',
        parameters: {
          type: 'object',
          properties: {
            chat: { type: 'string', description: 'Telefone, JID ou nome do contato' },
            limit: { type: 'number', description: 'Quantidade (padrão 20)' },
          },
          required: ['chat'],
        },
        execute: async (args) => {
          let chatRef = String(args.chat);
          const limit = Number(args.limit ?? 20);

          if (!chatRef.includes('@') && !/^\d+$/.test(chatRef.replace(/\D/g, ''))) {
            const found = await client.findChatByName(chatRef);
            if (found) chatRef = found.chat_jid;
          }

          const msgs = await client.readMessages(chatRef, limit);
          return {
            success: true,
            output: client.formatMessages(msgs),
            data: msgs,
          };
        },
      },
      {
        name: 'whatsapp_check_number',
        description: 'Verifica se um número está registrado no WhatsApp',
        parameters: {
          type: 'object',
          properties: {
            phone: { type: 'string', description: 'Número com DDI (ex: 5588998002111)' },
          },
          required: ['phone'],
        },
        execute: async (args) => {
          const output = await client.checkNumber(String(args.phone));
          return { success: true, output };
        },
      },
      {
        name: 'whatsapp_cobrar_contato',
        description:
          'Fluxo completo: encontra contato pelo nome, lê últimas mensagens e envia cobrança/lembrete',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nome do contato (ex: Geovane)' },
            message: {
              type: 'string',
              description: 'Mensagem a enviar (ex: cobrança sobre reunião)',
            },
          },
          required: ['name', 'message'],
        },
        execute: async (args) => {
          const name = String(args.name);
          const message = String(args.message);

          const chat = await client.findChatByName(name);
          if (!chat) {
            return {
              success: false,
              output: `Contato "${name}" não encontrado. Liste o inbox com whatsapp_list_inbox.`,
            };
          }

          const phone = normalizePhone(chat.chat_jid);
          let context = '';
          try {
            const msgs = await client.readMessages(chat.chat_jid, 5);
            context = client.formatMessages(msgs);
          } catch {
            context = '(histórico indisponível — akira-brain offline?)';
          }

          const sent = await client.sendText(phone, message);
          return {
            success: true,
            output: `${sent}\n\nContato: ${chat.display_name} (${phone})\nContexto recente:\n${context}`,
          };
        },
      },
    ],
  };
}
