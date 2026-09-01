<script setup lang="ts">
import { ref } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { api } from '../lib/api';

const open = ref(false);
const title = ref('');
const description = ref('');
const cron = ref('0 9 * * *');
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: () =>
    api.createSchedule({
      title: title.value,
      description: description.value || undefined,
      cron: cron.value,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    title.value = '';
    description.value = '';
    cron.value = '0 9 * * *';
    open.value = false;
  },
});

function submit() {
  if (title.value.trim() && cron.value.trim()) mutation.mutate();
}
</script>

<template>
  <button v-if="!open" type="button" class="add-btn" @click="open = true">+ Novo agendamento</button>
  <form v-else class="form" @submit.prevent="submit">
    <input v-model="title" class="input" placeholder="Título da tarefa recorrente" autofocus />
    <textarea
      v-model="description"
      class="input area"
      placeholder="Descrição (opcional)"
    />
    <label class="field">
      <span class="label">Cron (min hora dia mês dia-semana)</span>
      <input v-model="cron" class="input mono" placeholder="0 9 * * *" />
      <span class="hint">Ex: 0 9 * * * = todo dia às 9h · 0 */2 * * * = a cada 2 horas</span>
    </label>
    <div class="actions">
      <button type="button" class="cancel" @click="open = false">Cancelar</button>
      <button type="submit" class="submit" :disabled="!title.trim() || !cron.trim() || mutation.isPending.value">
        {{ mutation.isPending.value ? 'Criando...' : 'Criar' }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.add-btn {
  padding: 10px 16px;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 14px;
  width: 100%;
}
.form {
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}
.hint {
  font-size: 11px;
  color: var(--text-muted);
}
.input {
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 14px;
  outline: none;
}
.mono {
  font-family: var(--font-mono);
}
.area {
  min-height: 50px;
  resize: vertical;
}
.actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.cancel {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-muted);
}
.submit {
  padding: 8px 16px;
  background: var(--accent-dim);
  color: var(--bg);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
}
.submit:disabled {
  opacity: 0.5;
}
</style>
