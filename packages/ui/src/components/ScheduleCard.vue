<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { api, type TaskSchedule } from '../lib/api';

const props = defineProps<{ schedule: TaskSchedule }>();
const queryClient = useQueryClient();

const toggleMutation = useMutation({
  mutationFn: (enabled: boolean) => api.toggleSchedule(props.schedule.id, enabled),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
});

const deleteMutation = useMutation({
  mutationFn: () => api.deleteSchedule(props.schedule.id),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
});

function confirmDelete() {
  if (window.confirm(`Remover agendamento "${props.schedule.title}"?`)) {
    deleteMutation.mutate();
  }
}
</script>

<template>
  <article class="card">
    <div class="main">
      <div class="title-row">
        <h3 class="title">{{ schedule.title }}</h3>
        <span class="status" :class="{ off: !schedule.enabled }">
          {{ schedule.enabled ? 'ativo' : 'pausado' }}
        </span>
      </div>
      <p v-if="schedule.description" class="desc">{{ schedule.description }}</p>
      <p class="meta">
        <code class="cron">{{ schedule.cron }}</code>
        <span v-if="schedule.lastRunAt"> · última execução: {{ new Date(schedule.lastRunAt).toLocaleString('pt-BR') }}</span>
      </p>
    </div>
    <div class="actions">
      <button
        type="button"
        class="btn"
        :disabled="toggleMutation.isPending.value"
        @click="toggleMutation.mutate(!schedule.enabled)"
      >
        {{ schedule.enabled ? 'Pausar' : 'Ativar' }}
      </button>
      <button
        type="button"
        class="btn danger"
        :disabled="deleteMutation.isPending.value"
        @click="confirmDelete"
      >
        Remover
      </button>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.title {
  font-size: 14px;
  font-weight: 600;
}
.status {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--success);
  color: var(--bg);
}
.status.off {
  background: var(--text-muted);
}
.desc {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}
.meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}
.cron {
  font-family: var(--font-mono);
  background: var(--bg);
  padding: 2px 6px;
  border-radius: 4px;
}
.actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.btn {
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
}
.btn.danger {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
