import type { AgentPlugin } from '../types.js';

/** Plugin built-in com ferramentas básicas do sistema */
export function createBuiltinPlugin(): AgentPlugin {
  return {
    id: 'builtin',
    name: 'Sistema',
    description: 'Ferramentas básicas do sistema operacional',
    tools: [
      {
        name: 'get_datetime',
        description: 'Retorna data e hora atual do sistema',
        parameters: {
          type: 'object',
          properties: {},
        },
        execute: async () => ({
          success: true,
          output: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        }),
      },
      {
        name: 'echo',
        description: 'Repete uma mensagem — útil para testes',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Mensagem a repetir' },
          },
          required: ['message'],
        },
        execute: async (args) => ({
          success: true,
          output: String(args.message ?? ''),
        }),
      },
    ],
  };
}
