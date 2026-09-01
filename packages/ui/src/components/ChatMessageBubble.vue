<script setup lang="ts">
import type { ChatMessage, ToolActivity } from '../lib/api';

defineProps<{
  message: ChatMessage;
  toolActivities?: ToolActivity[];
}>();
</script>

<template>
  <div class="fade-in">
    <div class="row" :class="message.role === 'user' ? 'end' : 'start'">
      <div class="bubble" :class="message.role === 'user' ? 'user' : 'assistant'">
        <div v-if="message.role !== 'user'" class="role">Assistente</div>
        <div class="content">{{ message.content }}</div>
        <div v-if="toolActivities?.length" class="tools">
          <div v-for="(t, i) in toolActivities" :key="`${t.name}-${i}`" class="tool-card">
            <div class="tool-name">⚙ {{ t.name }}</div>
            <div class="tool-output">{{ t.output.slice(0, 400) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.35s var(--ease-out);
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.row {
  display: flex;
  margin-bottom: 12px;
}
.start {
  justify-content: flex-start;
}
.end {
  justify-content: flex-end;
}
.bubble {
  max-width: 85%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
}
.user {
  background: rgba(52, 211, 153, 0.12);
  border-color: rgba(52, 211, 153, 0.25);
}
.assistant {
  background: var(--surface);
}
.role {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.content {
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}
.tools {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tool-card {
  padding: 8px 10px;
  background: var(--bg);
  border-radius: 8px;
  border: 1px solid var(--border);
}
.tool-name {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  margin-bottom: 4px;
}
.tool-output {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  white-space: pre-wrap;
}
</style>
