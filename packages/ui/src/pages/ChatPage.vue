<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import ChatInput from '../components/ChatInput.vue';
import ChatMessageBubble from '../components/ChatMessageBubble.vue';
import ChatTypingIndicator from '../components/ChatTypingIndicator.vue';
import ChatSkeleton from '../components/skeleton/ChatSkeleton.vue';
import { api, type ChatMessage, type ToolActivity } from '../lib/api';

interface DisplayMessage extends ChatMessage {
  toolActivities?: ToolActivity[];
}

const queryClient = useQueryClient();
const sessionId = ref<string | null>(null);
const pendingMessages = ref<DisplayMessage[]>([]);
const bottomRef = ref<HTMLElement | null>(null);

const { data: sessions, isLoading: sessionsLoading } = useQuery({
  queryKey: ['chat-sessions'],
  queryFn: api.chatSessions,
});

const { data: messages, isLoading: messagesLoading } = useQuery({
  queryKey: computed(() => ['chat-messages', sessionId.value]),
  queryFn: () => api.chatMessages(sessionId.value!),
  enabled: computed(() => !!sessionId.value),
});

watch(sessions, (list) => {
  if (!sessionId.value && list && list.length > 0) {
    sessionId.value = list[0].id;
  }
});

watch([messages, pendingMessages], () => {
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' });
});

const sendMutation = useMutation({
  mutationFn: api.sendChat,
  onMutate: (vars) => {
    pendingMessages.value.push({
      id: `temp-${Date.now()}`,
      sessionId: vars.sessionId ?? 'temp',
      role: 'user',
      content: vars.message,
      createdAt: new Date().toISOString(),
    });
  },
  onSuccess: (reply) => {
    sessionId.value = reply.sessionId;
    pendingMessages.value = [];
    queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['chat-messages', reply.sessionId] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  },
  onError: () => {
    pendingMessages.value = [];
  },
});

const allMessages = computed<DisplayMessage[]>(() => [
  ...(messages.value ?? []),
  ...pendingMessages.value,
]);

const isLoading = computed(
  () => sessionsLoading.value || (!!sessionId.value && messagesLoading.value)
);

async function handleNewSession() {
  const session = await api.createChatSession();
  sessionId.value = session.id;
  queryClient.invalidateQueries({ queryKey: ['chat-sessions'] });
}
</script>

<template>
  <div class="container">
    <header class="header fade-in">
      <div>
        <h2 class="title">Chat</h2>
        <p class="subtitle">
          Converse com a IA — ela conhece suas tarefas e pode criar, listar e verificar a fila
        </p>
      </div>
      <button type="button" class="new-btn" @click="handleNewSession">+ Nova conversa</button>
    </header>

    <div class="messages">
      <ChatSkeleton v-if="isLoading && allMessages.length === 0" />
      <div v-else-if="allMessages.length === 0" class="empty fade-in">
        <p class="empty-title">Olá! Sou o Micro Assistente.</p>
        <p class="empty-text">
          Pergunte sobre suas tarefas, peça para criar uma nova, ou diga "verifique a fila".
        </p>
      </div>
      <template v-else>
        <ChatMessageBubble
          v-for="msg in allMessages"
          :key="msg.id"
          :message="msg"
          :tool-activities="msg.toolActivities"
        />
      </template>
      <ChatTypingIndicator v-if="sendMutation.isPending.value" />
      <div ref="bottomRef" />
    </div>

    <ChatInput
      :disabled="sendMutation.isPending.value"
      @send="(message) => sendMutation.mutate({ message, sessionId: sessionId ?? undefined })"
    />
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 20px 12px;
  gap: 16px;
}
.title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
  max-width: 480px;
}
.new-btn {
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-muted);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  white-space: nowrap;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 16px;
  min-height: 0;
}
.empty {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted);
}
.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}
.empty-text {
  font-size: 14px;
  line-height: 1.6;
}
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
</style>
