<script setup lang="ts">
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { api } from '../lib/api';
import StatusSkeleton from './skeleton/StatusSkeleton.vue';

const queryClient = useQueryClient();

const { data: health, isLoading } = useQuery({
  queryKey: ['health'],
  queryFn: api.health,
});

const { data: whatsapp } = useQuery({
  queryKey: ['whatsapp'],
  queryFn: api.whatsappStatus,
  refetchInterval: 15000,
  retry: false,
});

const startMutation = useMutation({
  mutationFn: api.startAgent,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['health'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  },
});

const stopMutation = useMutation({
  mutationFn: api.stopAgent,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health'] }),
});
</script>

<template>
  <StatusSkeleton v-if="isLoading" />
  <div v-else class="bar">
    <div class="indicator">
      <span
        class="dot"
        :style="{ background: health?.llm ? 'var(--success)' : 'var(--danger)' }"
      />
      <span class="label">LLM</span>
      <span class="state">{{ health?.llm ? 'online' : 'offline' }}</span>
    </div>
    <div class="indicator">
      <span
        class="dot"
        :style="{
          background: health?.agent.running ? 'var(--success)' : 'var(--danger)',
        }"
      />
      <span class="label">Agente</span>
      <span class="state">{{ health?.agent.running ? 'online' : 'offline' }}</span>
    </div>
    <div class="indicator">
      <span
        class="dot"
        :style="{
          background:
            whatsapp?.config.enabled &&
            whatsapp.sessions?.some((s) => s.connection.connected)
              ? 'var(--success)'
              : 'var(--danger)',
        }"
      />
      <span class="label">WhatsApp</span>
      <span class="state">
        {{
          whatsapp?.config.enabled &&
          whatsapp.sessions?.some((s) => s.connection.connected)
            ? 'online'
            : 'offline'
        }}
      </span>
    </div>
    <div class="actions">
      <button
        v-if="health?.agent.running"
        type="button"
        class="btn btn-danger"
        :disabled="stopMutation.isPending.value"
        @click="stopMutation.mutate()"
      >
        Parar agente
      </button>
      <button
        v-else
        type="button"
        class="btn btn-primary"
        :disabled="startMutation.isPending.value"
        @click="startMutation.mutate()"
      >
        Iniciar agente
      </button>
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.label {
  color: var(--text-muted);
  font-size: 13px;
}
.state {
  font-family: var(--font-mono);
  font-size: 12px;
}
.actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.btn {
  padding: 7px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
}
.btn-primary {
  background: var(--accent-dim);
  color: var(--bg);
}
.btn-danger {
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
}
</style>
