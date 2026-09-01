<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  disabled?: boolean;
  placeholder?: string;
}>();

const emit = defineEmits<{
  send: [message: string];
}>();

const value = ref('');

function submit() {
  const trimmed = value.value.trim();
  if (!trimmed || props.disabled) return;
  emit('send', trimmed);
  value.value = '';
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <textarea
      v-model="value"
      class="input"
      :placeholder="
        placeholder ?? 'Converse com a IA… (Enter envia, Shift+Enter quebra linha)'
      "
      :disabled="disabled"
      rows="2"
      @keydown="onKeyDown"
    />
    <button type="submit" class="btn" :disabled="disabled || !value.trim()">
      Enviar
    </button>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  align-items: flex-end;
}
.input {
  flex: 1;
  padding: 12px 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 14px;
  resize: none;
  outline: none;
  line-height: 1.5;
}
.btn {
  padding: 12px 18px;
  background: var(--accent-dim);
  color: var(--bg);
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
}
.btn:disabled {
  opacity: 0.5;
}
</style>
