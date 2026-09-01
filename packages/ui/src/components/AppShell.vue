<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { api } from '../lib/api';
import type { AppView } from '../types/app';
import ChatPage from '../pages/ChatPage.vue';
import SettingsPage from '../pages/SettingsPage.vue';
import TasksPage from '../pages/TasksPage.vue';
import WhatsAppPage from '../pages/WhatsAppPage.vue';
import Sidebar from './Sidebar.vue';
import StatusBar from './StatusBar.vue';
import { useRealtime } from '../composables/useRealtime';

const LAST_SEEN_KEY = 'whatsapp-inbox-last-seen';

const view = ref<AppView>('chat');

useRealtime();

const { data: tasks } = useQuery({
  queryKey: ['tasks'],
  queryFn: api.tasks,
});

const { data: whatsappStatus } = useQuery({
  queryKey: ['whatsapp'],
  queryFn: api.whatsappStatus,
  refetchInterval: 60_000,
});

const { data: inboxSnapshots } = useQuery({
  queryKey: ['whatsapp-unread'],
  queryFn: async () => {
    const status = whatsappStatus.value ?? (await api.whatsappStatus());
    const connected = status.sessions.filter((s) => s.connection.connected);
    return Promise.all(
      connected.map(async (s) => ({
        sessionId: s.session.id,
        inbox: await api.whatsappInbox(s.session.id),
      }))
    );
  },
  enabled: computed(() => (whatsappStatus.value?.sessions.some((s) => s.connection.connected) ?? false)),
  refetchInterval: 30_000,
});

function getLastSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

function markWhatsAppSeen(updates: Record<string, number>): void {
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify({ ...getLastSeen(), ...updates }));
}

const pendingCount = computed(
  () => tasks.value?.filter((t) => t.status === 'pending').length ?? 0
);

const whatsappUnread = computed(() => {
  if (view.value === 'whatsapp') return 0;
  const lastSeen = getLastSeen();
  let count = 0;
  for (const snapshot of inboxSnapshots.value ?? []) {
    const seen = lastSeen[snapshot.sessionId] ?? 0;
    for (const chat of snapshot.inbox) {
      if (chat.last_timestamp > seen) count++;
    }
  }
  return count;
});

watch(
  [view, inboxSnapshots],
  ([currentView, snapshots]) => {
    if (currentView !== 'whatsapp' || !snapshots?.length) return;
    const updates: Record<string, number> = {};
    for (const snapshot of snapshots) {
      const maxTs = Math.max(0, ...snapshot.inbox.map((c) => c.last_timestamp));
      updates[snapshot.sessionId] = maxTs;
    }
    markWhatsAppSeen(updates);
  },
  { deep: true }
);
</script>

<template>
  <div class="shell">
    <Sidebar
      :active="view"
      :pending-count="pendingCount"
      :whatsapp-unread="whatsappUnread"
      @navigate="view = $event"
    />
    <div class="main">
      <StatusBar />
      <div class="content">
        <Transition name="page" mode="out-in">
          <div :key="view" class="page">
            <ChatPage v-if="view === 'chat'" />
            <TasksPage v-else-if="view === 'tasks'" />
            <WhatsAppPage v-else-if="view === 'whatsapp'" />
            <SettingsPage v-else-if="view === 'settings'" />
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg);
}
.content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.page {
  height: 100%;
  min-height: 0;
}
.page-enter-active,
.page-leave-active {
  transition: opacity 0.28s var(--ease-out), transform 0.28s var(--ease-out);
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
