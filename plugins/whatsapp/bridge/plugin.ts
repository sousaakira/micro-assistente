import type { AgentPlugin } from './agent-types.js';
import type { WhatsAppService } from './service.js';
import { normalizePhone } from './client.js';

export function createWhatsAppPlugin(service: WhatsAppService): AgentPlugin {
  const client = service.getClient();

  const guard = (): { success: false; output: string } | null => {
    if (!service.getConfig().enabled) {
      return {
        success: false,
        output: 'Plugin WhatsApp desativado no painel. Ative em WhatsApp → Configuração.',
      };
    }
    return null;
  };

  return {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Integração WhatsApp via akira-brain (leitura, envio, inbox, múltiplas sessões)',
    tools: [
      {
        name: 'whatsapp_status',
        description: 'Verifica status das sessões WhatsApp (akira-brain)',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          const blocked = guard();
          if (blocked) return blocked;
          const sessions = service.getConfig().sessions.filter((s) => s.enabled);
          const lines: string[] = [];

          for (const session of sessions) {
            const status = await client.getStatus(session.id);
            const brain = status.apiOnline
              ? await client.getAkiraBrainStatus(session.id).catch(() => null)
              : null;
            lines.push(
              `[${session.label}] api: ${status.apiOnline ? 'online' : 'offline'}, ` +
                `wa: ${status.connected ? 'conectado' : status.state}, ` +
                `qr: ${brain?.qr_status || '—'}`
            );
          }

          const anyConnected = lines.some((l) => l.includes('wa: conectado'));
          return {
            success: anyConnected || lines.length > 0,
            output: lines.join('\n') || 'Nenhuma sessão WhatsApp configurada',
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
          const blocked = guard();
          if (blocked) return blocked;
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
          const blocked = guard();
          if (blocked) return blocked;
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
        name: 'whatsapp_search_contacts',
        description:
          'Busca inteligente de contatos no inbox (nome parcial, múltiplas palavras, telefone)',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Nome, parte do nome ou telefone' },
            limit: { type: 'number', description: 'Máximo de resultados (padrão 5)' },
          },
          required: ['query'],
        },
        execute: async (args) => {
          const blocked = guard();
          if (blocked) return blocked;
          const query = String(args.query);
          const limit = Number(args.limit ?? 5);
          const matches = await client.searchContacts(query, limit);
          if (matches.length === 0) {
            return {
              success: false,
              output: `Nenhum contato encontrado para "${query}".`,
            };
          }
          const lines = matches.map(
            (c) =>
              `- ${c.display_name || c.chat_jid} (${c.is_group ? 'grupo' : 'contato'}) → ${c.chat_jid}`
          );
          return {
            success: true,
            output: lines.join('\n'),
            data: matches,
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
          const blocked = guard();
          if (blocked) return blocked;
          const inbox = await client.listInbox();
          return { success: true, output: client.formatInbox(inbox), data: inbox };
        },
      },
      {
        name: 'whatsapp_search_messages',
        description: 'Busca full-text no histórico de mensagens WhatsApp (FTS offline)',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Termos de busca (ex: reunião CNPJ)' },
            limit: { type: 'number', description: 'Máximo de resultados (padrão 10)' },
          },
          required: ['query'],
        },
        execute: async (args) => {
          const blocked = guard();
          if (blocked) return blocked;
          const query = String(args.query);
          const limit = Number(args.limit ?? 10);
          const hits = await client.searchMessages(query, limit);
          if (hits.length === 0) {
            return { success: false, output: `Nenhuma mensagem encontrada para "${query}".` };
          }
          const lines = hits.map(
            (h) => `- ${h.chat_jid}: ${h.body.slice(0, 120)} (score ${h.score.toFixed(2)})`
          );
          return { success: true, output: lines.join('\n'), data: hits };
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
          const blocked = guard();
          if (blocked) return blocked;
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
          const blocked = guard();
          if (blocked) return blocked;
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
          const blocked = guard();
          if (blocked) return blocked;
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
