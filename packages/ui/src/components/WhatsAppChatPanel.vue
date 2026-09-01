<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import ChatInput from './ChatInput.vue';
import { api, type InboxChat, type WhatsAppStoredMessage } from '../lib/api';

const props = defineProps<{
  sessionId: string;
  sessionLabel: string;
  connected: boolean;
  apiOnline: boolean;
}>();

const queryClient = useQueryClient();
const selectedChat = ref<InboxChat | null>(null);
const pendingMessages = ref<WhatsAppStoredMessage[]>([]);
const bottomRef = ref<HTMLElement | null>(null);
const searchQuery = ref('');
const searchResults = ref<Array<{ message_id: string; chat_jid: string; body: string; score: number }>>([]);
const searching = ref(false);

const { data: inbox, isLoading: inboxLoading } = useQuery({
  queryKey: computed(() => ['whatsapp-inbox', props.sessionId]),
  queryFn: () => api.whatsappInbox(props.sessionId),
  enabled: computed(() => props.apiOnline),
  refetchInterval: 8000,
});

watch(inbox, (list) => {
  if (!selectedChat.value && list && list.length > 0) {
    selectedChat.value = list[0];
  }
});

watch(
  () => props.sessionId,
  () => {
    selectedChat.value = null;
    pendingMessages.value = [];
  }
);

const chatJid = computed(() => selectedChat.value?.chat_jid ?? '');

const { data: messages, isLoading: messagesLoading } = useQuery({
  queryKey: computed(() => ['whatsapp-messages', props.sessionId, chatJid.value]),
  queryFn: () => api.whatsappMessages(props.sessionId, chatJid.value, 60),
  enabled: computed(() => props.apiOnline && !!chatJid.value),
  refetchInterval: computed(() => (props.apiOnline && chatJid.value ? 4000 : false)),
});

watch([messages, pendingMessages, selectedChat], () => {
  bottomRef.value?.scrollIntoView({ behavior: 'smooth' });
});

const sendMutation = useMutation({
  mutationFn: api.whatsappSendMessage,
  onMutate: (vars) => {
    pendingMessages.value.push({
      id: `pending-${Date.now()}`,
      chat_jid: vars.chat,
      sender_jid: 'me',
      is_from_me: true,
      timestamp: Math.floor(Date.now() / 1000),
      type: 'text',
      body: vars.message,
      is_media: false,
    });
  },
  onSuccess: () => {
    pendingMessages.value = [];
    queryClient.invalidateQueries({
      queryKey: ['whatsapp-messages', props.sessionId, chatJid.value],
    });
    queryClient.invalidateQueries({ queryKey: ['whatsapp-inbox', props.sessionId] });
  },
  onError: () => {
    pendingMessages.value = [];
  },
});

const allMessages = computed(() => [...(messages.value ?? []), ...pendingMessages.value]);
const canUseChat = computed(() => props.connected);

function displayChatName(chat: InboxChat): string {
  const name = chat.display_name?.trim();
  if (name) return name;
  return chat.chat_jid.split('@')[0] || chat.chat_jid;
}

function selectChat(chat: InboxChat) {
  selectedChat.value = chat;
  pendingMessages.value = [];
}

function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function runSearch() {
  const q = searchQuery.value.trim();
  if (!q) {
    searchResults.value = [];
    return;
  }
  searching.value = true;
  try {
    searchResults.value = await api.whatsappSearchMessages(props.sessionId, q, 15);
  } catch {
    searchResults.value = [];
  } finally {
    searching.value = false;
  }
}

function openSearchHit(hit: { chat_jid: string }) {
  const chat = inbox.value?.find((c) => c.chat_jid === hit.chat_jid);
  if (chat) selectChat(chat);
  searchResults.value = [];
  searchQuery.value = '';
}
</script>

<template>
  <div v-if="!apiOnline" class="empty">
    <p>Serviço offline — inicie a sessão em Configuração.</p>
  </div>
  <div v-else class="wrapper">
    <div v-if="!canUseChat" class="banner">
      Sincronizando WhatsApp… se persistir, verifique a aba Configuração.
    </div>
    <div class="root">
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Conversas</span>
          <span class="sidebar-sub">{{ sessionLabel }}</span>
          <div class="search-row">
            <input
              v-model="searchQuery"
              class="search-input"
              placeholder="Buscar no histórico…"
              @keydown.enter.prevent="runSearch"
            />
            <button type="button" class="search-btn" :disabled="searching" @click="runSearch">
              {{ searching ? '…' : 'Buscar' }}
            </button>
          </div>
          <div v-if="searchResults.length > 0" class="search-results">
            <button
              v-for="hit in searchResults"
              :key="hit.message_id"
              type="button"
              class="search-hit"
              @click="openSearchHit(hit)"
            >
              <span class="search-hit-body">{{ hit.body.slice(0, 80) }}</span>
              <span class="search-hit-meta">{{ hit.chat_jid.split('@')[0] }}</span>
            </button>
          </div>
        </div>
        <div class="chat-list">
          <p v-if="inboxLoading" class="hint">Carregando…</p>
          <p v-else-if="!inbox || inbox.length === 0" class="hint">Nenhum chat capturado ainda.</p>
          <button
            v-for="chat in inbox"
            :key="chat.chat_jid"
            type="button"
            class="chat-item"
            :class="{ active: selectedChat?.chat_jid === chat.chat_jid }"
            @click="selectChat(chat)"
          >
            <div class="chat-item-name">
              {{ displayChatName(chat) }}
              <span v-if="chat.is_group" class="badge">grupo</span>
            </div>
            <div class="chat-item-preview">{{ chat.last_preview?.slice(0, 48) || '—' }}</div>
          </button>
        </div>
      </aside>

      <section class="thread">
        <template v-if="selectedChat">
          <header class="thread-header">
            <div class="thread-title">{{ displayChatName(selectedChat) }}</div>
            <div class="thread-meta">{{ selectedChat.chat_jid }}</div>
          </header>

          <div class="messages">
            <p v-if="messagesLoading && allMessages.length === 0" class="hint">Carregando mensagens…</p>
            <p v-else-if="allMessages.length === 0" class="hint">Sem mensagens neste chat.</p>
            <div
              v-for="msg in allMessages"
              :key="msg.id"
              class="msg-row"
              :class="msg.is_from_me ? 'me' : 'them'"
            >
              <div class="msg-bubble">
                <div v-if="!msg.is_from_me" class="msg-sender">
                  {{ msg.sender_jid.split('@')[0] }}
                </div>
                <div class="msg-body">
                  {{ msg.body || (msg.is_media ? `(${msg.type})` : '') }}
                </div>
                <div class="msg-time">{{ formatTime(msg.timestamp) }}</div>
              </div>
            </div>
            <div ref="bottomRef" />
          </div>

          <ChatInput
            :disabled="!canUseChat || sendMutation.isPending.value"
            :placeholder="
              canUseChat ? 'Responder no WhatsApp… (Enter envia)' : 'Aguardando conexão do WhatsApp…'
            "
            @send="
              (message) =>
                sendMutation.mutate({
                  sessionId,
                  chat: selectedChat!.chat_jid,
                  message,
                })
            "
          />
        </template>
        <div v-else class="empty-thread">
          <p>Selecione uma conversa à esquerda.</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 8px;
}
.banner {
  padding: 10px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 13px;
  color: var(--text-muted);
}
.root {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}
.sidebar {
  width: 280px;
  min-width: 240px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.sidebar-header {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.sidebar-title {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}
.sidebar-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.chat-item {
  text-align: left;
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  background: transparent;
  width: 100%;
}
.chat-item.active {
  background: var(--surface);
  border-color: var(--border);
}
.chat-item-name {
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}
.chat-item-preview {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-muted);
  font-family: var(--font-mono);
}
.thread {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.thread-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}
.thread-title {
  font-size: 15px;
  font-weight: 600;
}
.thread-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  margin-top: 2px;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
}
.msg-row {
  display: flex;
  margin-bottom: 10px;
}
.msg-row.me {
  justify-content: flex-end;
}
.msg-row.them {
  justify-content: flex-start;
}
.msg-bubble {
  max-width: 78%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--border);
}
.msg-row.me .msg-bubble {
  background: rgba(52, 211, 153, 0.14);
  border-color: rgba(52, 211, 153, 0.28);
}
.msg-row.them .msg-bubble {
  background: var(--bg);
}
.msg-sender {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
  font-family: var(--font-mono);
}
.msg-body {
  font-size: 14px;
  line-height: 1.45;
  white-space: pre-wrap;
}
.msg-time {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 6px;
  text-align: right;
  font-family: var(--font-mono);
}
.empty,
.empty-thread {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
  padding: 32px;
  text-align: center;
}
.hint {
  font-size: 13px;
  color: var(--text-muted);
  padding: 12px;
  text-align: center;
}
.search-row {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}
.search-input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  font-size: 12px;
}
.search-btn {
  padding: 8px 10px;
  font-size: 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
}
.search-results {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 140px;
  overflow-y: auto;
}
.search-hit {
  text-align: left;
  padding: 8px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
}
.search-hit-body {
  display: block;
  font-size: 12px;
}
.search-hit-meta {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  margin-top: 2px;
}
</style>
