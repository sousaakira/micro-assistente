<script setup lang="ts">
import type { AppView } from '../types/app';

defineProps<{
  active: AppView;
  pendingCount?: number;
  whatsappUnread?: number;
}>();

defineEmits<{
  navigate: [view: AppView];
}>();

const NAV: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'chat', label: 'Chat', icon: '◌' },
  { id: 'tasks', label: 'Tarefas', icon: '☰' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '◉' },
  { id: 'settings', label: 'Config', icon: '⚙' },
];
</script>

<template>
  <aside class="aside">
    <div class="brand">
      <span class="logo">μ</span>
      <div>
        <div class="brand-title">Micro</div>
        <div class="brand-sub">Assistente</div>
      </div>
    </div>

    <nav class="nav">
      <button
        v-for="item in NAV"
        :key="item.id"
        type="button"
        class="nav-item"
        :class="{ active: active === item.id }"
        @click="$emit('navigate', item.id)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        {{ item.label }}
        <span v-if="item.id === 'tasks' && (pendingCount ?? 0) > 0" class="badge">
          {{ pendingCount }}
        </span>
        <span v-if="item.id === 'whatsapp' && (whatsappUnread ?? 0) > 0" class="badge whatsapp">
          {{ whatsappUnread }}
        </span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.aside {
  width: 220px;
  min-width: 220px;
  border-right: 1px solid var(--border);
  background: var(--surface);
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  gap: 24px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 8px;
}
.logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-dim);
  color: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  font-family: var(--font-mono);
}
.brand-title {
  font-weight: 700;
  font-size: 14px;
  line-height: 1.2;
}
.brand-sub {
  font-size: 12px;
  color: var(--text-muted);
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  text-align: left;
  width: 100%;
  transition: background 0.18s var(--ease-out);
}
.nav-item:hover {
  background: var(--surface-hover);
}
.nav-item.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
}
.nav-icon {
  font-family: var(--font-mono);
  font-size: 13px;
  opacity: 0.8;
}
.badge {
  margin-left: auto;
  background: var(--accent-dim);
  color: var(--bg);
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  font-family: var(--font-mono);
}
.badge.whatsapp {
  background: #25d366;
}
</style>
