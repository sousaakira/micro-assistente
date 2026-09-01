import { execSync } from 'node:child_process';
import os from 'node:os';
import type { AgentPlugin } from '../types.js';

export function createServersPlugin(): AgentPlugin {
  return {
    id: 'servers',
    name: 'Servidores',
    description: 'Monitoramento básico de CPU, memória e disco do host local',
    tools: [
      {
        name: 'server_host_status',
        description: 'Retorna CPU, memória e uptime do host onde o agente roda',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          const cpus = os.cpus().length;
          const load = os.loadavg();
          const totalMem = os.totalmem();
          const freeMem = os.freemem();
          const usedPct = Math.round((1 - freeMem / totalMem) * 100);
          const uptimeH = Math.round(os.uptime() / 3600);

          return {
            success: true,
            output: [
              `Host: ${os.hostname()}`,
              `CPUs: ${cpus} | Load: ${load.map((l) => l.toFixed(2)).join(', ')}`,
              `Memória: ${usedPct}% usada (${formatBytes(totalMem - freeMem)} / ${formatBytes(totalMem)})`,
              `Uptime: ~${uptimeH}h`,
            ].join('\n'),
          };
        },
      },
      {
        name: 'server_disk_usage',
        description: 'Mostra uso de disco (df -h) no host local',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          try {
            const output = execSync('df -h / 2>/dev/null || df -h', {
              encoding: 'utf8',
              timeout: 5000,
            });
            return { success: true, output: output.trim() };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, output: `Erro ao ler disco: ${message}` };
          }
        },
      },
      {
        name: 'server_ping',
        description: 'Pinga um host para verificar conectividade',
        parameters: {
          type: 'object',
          properties: {
            host: { type: 'string', description: 'Hostname ou IP' },
          },
          required: ['host'],
        },
        execute: async (args) => {
          const host = String(args.host).trim();
          if (!host) return { success: false, output: 'Host vazio' };
          try {
            const output = execSync(`ping -c 2 -W 2 ${host} 2>/dev/null || ping -n 2 -w 2000 ${host}`, {
              encoding: 'utf8',
              timeout: 8000,
            });
            return { success: true, output: output.trim().slice(0, 600) };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, output: `Ping falhou para ${host}: ${message.slice(0, 200)}` };
          }
        },
      },
    ],
  };
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}
