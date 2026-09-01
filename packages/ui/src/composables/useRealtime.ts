import { onMounted, onUnmounted, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';

const connected = ref(false);

export function useRealtime() {
  const queryClient = useQueryClient();
  let source: EventSource | null = null;
  let ws: WebSocket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const invalidate = (type: string) => {
    if (type === 'tasks' || type === 'agent') {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
    }
    if (type === 'config') {
      queryClient.invalidateQueries({ queryKey: ['agent-config'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
    }
  };

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }, 15000);
  };

  const connectSSE = () => {
    try {
      source = new EventSource('/api/events');
      source.onopen = () => {
        connected.value = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };
      source.onerror = () => {
        connected.value = false;
        source?.close();
        source = null;
        startPolling();
      };
      source.addEventListener('tasks', () => invalidate('tasks'));
      source.addEventListener('agent', () => invalidate('agent'));
      source.addEventListener('config', () => invalidate('config'));
    } catch {
      startPolling();
    }
  };

  const connectWS = () => {
    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/api/ws`);
      ws.onopen = () => {
        connected.value = true;
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data) as { type?: string };
          if (data.type) invalidate(data.type);
        } catch {
          /* ignore */
        }
      };
      ws.onerror = () => {
        connected.value = false;
        ws?.close();
        ws = null;
        if (!source) connectSSE();
      };
    } catch {
      connectSSE();
    }
  };

  onMounted(() => {
    connectWS();
  });

  onUnmounted(() => {
    source?.close();
    ws?.close();
    if (pollTimer) clearInterval(pollTimer);
  });

  return { connected };
}
