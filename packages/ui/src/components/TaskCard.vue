<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import type { Task } from '../lib/api';
import { api } from '../lib/api';

defineProps<{ task: Task }>();

const queryClient = useQueryClient();

const STATUS_COLORS: Record<Task['status'], string> = {
  pending: 'var(--text-muted)',
  running: 'var(--warning)',
  completed: 'var(--success)',
  failed: 'var(--danger)',
  cancelled: 'var(--text-muted)',
};

const STATUS_LABELS: Record<Task['status'], string> = {
  pending: 'Pendente',
  running: 'Executando',
  completed: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};

const deleteMutation = useMutation({
  mutationFn: (id: string) => api.deleteTask(id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
});
</script>

<template>
  <article class="card">
    <div class="header">
      <span class="status" :style="{ color: STATUS_COLORS[task.status] }">
        <span class="dot" :class="{ pulse: task.status === 'running' }" />
        {{ STATUS_LABELS[task.status] }}
      </span>
      <button
        v-if="task.status !== 'running'"
        type="button"
        class="delete"
        :disabled="deleteMutation.isPending.value"
        @click="deleteMutation.mutate(task.id)"
      >
        ×
      </button>
    </div>
    <h3 class="title">{{ task.title }}</h3>
    <p v-if="task.description" class="desc">{{ task.description }}</p>
    <p v-if="task.result" class="result">{{ task.result }}</p>
    <p v-if="task.error" class="error">{{ task.error }}</p>
  </article>
</template>

<style scoped>
.card {
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: background 0.18s var(--ease-out);
}
.card:hover {
  background: var(--surface-hover);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.dot.pulse {
  animation: blink 1.2s infinite;
}
@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
.delete {
  font-size: 18px;
  color: var(--text-muted);
  line-height: 1;
  padding: 2px 6px;
}
.delete:hover {
  color: var(--danger);
}
.title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}
.desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.result {
  font-size: 13px;
  color: var(--accent);
  margin-top: 8px;
  padding: 8px 10px;
  background: rgba(110, 231, 183, 0.06);
  border-radius: 6px;
  font-family: var(--font-mono);
}
.error {
  font-size: 13px;
  color: var(--danger);
  margin-top: 8px;
}
</style>
