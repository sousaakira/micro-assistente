<script setup lang="ts">
import { ref } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { api } from '../lib/api';

const open = ref(false);
const title = ref('');
const description = ref('');
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: () => api.createTask({ title: title.value, description: description.value || undefined }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    title.value = '';
    description.value = '';
    open.value = false;
  },
});

function submit() {
  if (title.value.trim()) mutation.mutate();
}
</script>

<template>
  <button v-if="!open" type="button" class="add-btn" @click="open = true">+ Nova tarefa</button>
  <form v-else class="form" @submit.prevent="submit">
    <input v-model="title" class="input" placeholder="Título da tarefa" autofocus />
    <textarea
      v-model="description"
      class="input area"
      placeholder="Descrição (opcional)"
    />
    <div class="actions">
      <button type="button" class="cancel" @click="open = false">Cancelar</button>
      <button type="submit" class="submit" :disabled="!title.trim() || mutation.isPending.value">
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
  animation: fadeIn 0.35s var(--ease-out);
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.input {
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 14px;
  outline: none;
}
.area {
  min-height: 60px;
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
