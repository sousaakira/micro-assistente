import type { AgentOrchestrator } from '../orchestrator.js';
import type { AgentPlugin, TaskStatus } from '../types.js';
import type { TaskQueue } from '../task-queue.js';

export function createTasksPlugin(
  taskQueue: TaskQueue,
  orchestrator: AgentOrchestrator
): AgentPlugin {
  return {
    id: 'tasks',
    name: 'Tarefas',
    description: 'Gerenciar e verificar a fila de tarefas do agente',
    tools: [
      {
        name: 'list_tasks',
        description: 'Lista tarefas da fila. Opcionalmente filtra por status: pending, running, completed, failed, cancelled',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
              description: 'Filtrar por status',
            },
            limit: { type: 'number', description: 'Máximo de tarefas (padrão 10)' },
          },
        },
        execute: async (args) => {
          const limit = Number(args.limit ?? 10);
          const status = args.status as string | undefined;
          const tasks = status
            ? taskQueue.getByStatus(status as TaskStatus, limit)
            : taskQueue.getAll().slice(0, limit);

          if (tasks.length === 0) {
            return { success: true, output: 'Nenhuma tarefa encontrada.' };
          }

          const lines = tasks.map(
            (t) =>
              `- ${t.title} (${t.status})${t.description ? `: ${t.description}` : ''}${t.result ? ` → ${t.result.slice(0, 120)}` : ''}${t.error ? ` [erro: ${t.error}]` : ''}`
          );
          return { success: true, output: lines.join('\n'), data: tasks };
        },
      },
      {
        name: 'verify_tasks',
        description: 'Verifica o estado geral da fila: contagem por status, tarefas em execução, pendentes e falhas',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({
          success: true,
          output: taskQueue.formatQueueContext(),
        }),
      },
      {
        name: 'get_task',
        description: 'Busca uma tarefa pelo ID',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID da tarefa' },
          },
          required: ['id'],
        },
        execute: async (args) => {
          const task = taskQueue.getById(String(args.id));
          if (!task) return { success: false, output: 'Tarefa não encontrada.' };
          return {
            success: true,
            output: JSON.stringify(task, null, 2),
            data: task,
          };
        },
      },
      {
        name: 'create_task',
        description: 'Cria uma nova tarefa na fila para o agente executar',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Título da tarefa' },
            description: { type: 'string', description: 'Descrição detalhada' },
          },
          required: ['title'],
        },
        execute: async (args) => {
          const title = String(args.title).trim();
          const duplicate = taskQueue.findPendingByTitle(title);
          if (duplicate) {
            return {
              success: false,
              output: `Já existe tarefa pendente "${duplicate.title}" (id: ${duplicate.id}). Não crie duplicatas.`,
            };
          }

          const task = taskQueue.add({
            title,
            description: args.description ? String(args.description) : undefined,
          });
          return {
            success: true,
            output: `Tarefa criada: "${task.title}" (id: ${task.id}, status: pending)`,
            data: task,
          };
        },
      },
      {
        name: 'start_agent',
        description: 'Inicia o agente para processar tarefas pendentes automaticamente',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          await orchestrator.start();
          const status = orchestrator.getStatus();
          return {
            success: true,
            output: status.running
              ? 'Agente iniciado. Processando fila de tarefas.'
              : 'Agente já estava em execução.',
          };
        },
      },
      {
        name: 'stop_agent',
        description: 'Para o agente de processamento automático de tarefas',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          orchestrator.stop();
          return { success: true, output: 'Agente parado.' };
        },
      },
    ],
  };
}
