<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import WhatsAppChatPanel from '../components/WhatsAppChatPanel.vue';
import WhatsAppPairingPanel from '../components/WhatsAppPairingPanel.vue';
import WhatsAppProjectsPanel from '../components/WhatsAppProjectsPanel.vue';
import DashboardSkeleton from '../components/skeleton/DashboardSkeleton.vue';
import { api, type WhatsAppPanelConfig } from '../lib/api';

type PageView = 'chat' | 'settings';

const queryClient = useQueryClient();
const pageView = ref<PageView>('chat');
const form = ref<WhatsAppPanelConfig | null>(null);
const saved = ref(false);
const newSessionLabel = ref('');
const activeSessionId = ref<string | null>(null);
const deletingSessionId = ref<string | null>(null);

const { data, isLoading, isFetching } = useQuery({
  queryKey: ['whatsapp'],
  queryFn: api.whatsappStatus,
  refetchInterval: (query) => {
    const sessions = query.state.data?.sessions ?? [];
    const needsPoll = sessions.some(
      (s) =>
        !s.connection.connected ||
        s.akiraBrain?.qr_status === 'code' ||
        s.akiraBrain?.qr_status === 'timeout' ||
        s.connection.state === 'awaiting_qr' ||
        s.connection.state === 'connecting' ||
        !s.connection.apiOnline
    );
    return needsPoll ? 5000 : false;
  },
});

watch(
  () => data.value?.config,
  (config) => {
    if (config) {
      form.value = { ...config, sessions: config.sessions.map((s) => ({ ...s })) };
      if (!activeSessionId.value) activeSessionId.value = config.defaultSessionId;
    }
  },
  { immediate: true }
);

const saveMutation = useMutation({
  mutationFn: api.updateWhatsAppConfig,
  onSuccess: (config) => {
    form.value = config;
    saved.value = true;
    queryClient.invalidateQueries({ queryKey: ['whatsapp'] });
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  },
});

const startMutation = useMutation({
  mutationFn: api.startWhatsApp,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp'] }),
});

const stopMutation = useMutation({
  mutationFn: api.stopWhatsApp,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp'] }),
});

const restartMutation = useMutation({
  mutationFn: api.restartWhatsApp,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp'] }),
});

const addSessionMutation = useMutation({
  mutationFn: api.addWhatsAppSession,
  onSuccess: (config) => {
    form.value = config;
    newSessionLabel.value = '';
    queryClient.invalidateQueries({ queryKey: ['whatsapp'] });
  },
});

const deleteSessionMutation = useMutation({
  mutationFn: api.deleteWhatsAppSession,
  onMutate: (sessionId) => {
    deletingSessionId.value = sessionId;
  },
  onSuccess: (config) => {
    form.value = config;
    activeSessionId.value = config.defaultSessionId;
    queryClient.invalidateQueries({ queryKey: ['whatsapp'] });
  },
  onSettled: () => {
    deletingSessionId.value = null;
  },
});

const canDeleteSessions = computed(() => (form.value?.sessions.length ?? 0) > 1);

function confirmDeleteSession(sessionId: string, label: string) {
  if (!canDeleteSessions.value) return;
  const ok = window.confirm(
    `Remover a conta "${label}"?\n\nO pareamento, mensagens e dados locais dessa sessão serão apagados.`
  );
  if (ok) deleteSessionMutation.mutate(sessionId);
}

const activeSession = computed(
  () =>
    data.value?.sessions.find((s) => s.session.id === activeSessionId.value) ??
    data.value?.sessions[0] ??
    null
);

const servicesRunning = computed(
  () => data.value?.runtime.sessions.some((s) => s.running) ?? false
);

const actionPending = computed(
  () =>
    startMutation.isPending.value ||
    stopMutation.isPending.value ||
    restartMutation.isPending.value
);

const needsPairing = computed(
  () =>
    !!activeSession.value &&
    activeSession.value.connection.apiOnline &&
    !activeSession.value.connection.connected &&
    !activeSession.value.akiraBrain?.logged_out
);

const showQr = computed(
  () =>
    needsPairing.value &&
    activeSession.value?.akiraBrain?.qr_status === 'code' &&
    !!activeSession.value.akiraBrain.qr_code
);

const qrTimedOut = computed(
  () => needsPairing.value && activeSession.value?.akiraBrain?.qr_status === 'timeout'
);

const qrWaiting = computed(
  () =>
    needsPairing.value &&
    !showQr.value &&
    !qrTimedOut.value &&
    activeSession.value?.akiraBrain?.qr_status !== 'error'
);

function saveForm() {
  if (form.value) saveMutation.mutate(form.value);
}
</script>

<template>
  <div v-if="isLoading || !form || !data" class="container">
    <DashboardSkeleton />
  </div>
  <div v-else class="container">
    <header class="header fade-in">
      <div class="header-row">
        <div>
          <h2 class="title">WhatsApp</h2>
          <p class="subtitle">akira-brain integrado — múltiplas contas, chat e envio</p>
        </div>
        <div class="header-actions">
          <span v-if="isFetching" class="polling">atualizando…</span>
          <div class="view-toggle">
            <button
              type="button"
              class="view-btn"
              :class="{ active: pageView === 'chat' }"
              @click="pageView = 'chat'"
            >
              Conversas
            </button>
            <button
              type="button"
              class="view-btn"
              :class="{ active: pageView === 'settings' }"
              @click="pageView = 'settings'"
            >
              Configuração
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="session-bar">
      <div class="session-tabs">
        <button
          v-for="s in data.sessions"
          :key="s.session.id"
          type="button"
          class="session-tab"
          :class="{ active: activeSessionId === s.session.id }"
          @click="activeSessionId = s.session.id"
        >
          {{ s.session.label }}
          <span
            class="session-dot"
            :style="{
              background: s.connection.connected
                ? 'var(--success)'
                : s.connection.apiOnline
                  ? '#c9a227'
                  : 'var(--danger)',
            }"
          />
        </button>
      </div>
      <div v-if="pageView === 'settings'" class="add-session-row">
        <input
          v-model="newSessionLabel"
          class="input"
          placeholder="Nova conta"
          style="flex: 1; max-width: 200px"
        />
        <button
          type="button"
          class="btn-secondary"
          :disabled="!newSessionLabel.trim() || addSessionMutation.isPending.value"
          @click="addSessionMutation.mutate({ label: newSessionLabel.trim() })"
        >
          + Conta
        </button>
      </div>
    </div>

    <WhatsAppPairingPanel
      v-if="pageView === 'chat' && activeSession && needsPairing"
      class="fade-in"
      :session-label="activeSession.session.label"
      :show-qr="showQr"
      :qr-code="activeSession.akiraBrain?.qr_code ?? ''"
      :qr-timed-out="qrTimedOut"
      :qr-waiting="qrWaiting"
      :restarting="restartMutation.isPending.value"
      @restart="restartMutation.mutate()"
    />

    <div v-if="pageView === 'chat' && activeSession" class="chat-area">
      <WhatsAppChatPanel
        :session-id="activeSession.session.id"
        :session-label="activeSession.session.label"
        :connected="activeSession.connection.connected"
        :api-online="activeSession.connection.apiOnline"
      />
    </div>

    <div v-if="pageView === 'settings'" class="settings-scroll">
      <section class="section fade-in">
        <div class="service-actions">
          <button
            v-if="!servicesRunning"
            type="button"
            class="btn-primary"
            :disabled="actionPending"
            @click="startMutation.mutate()"
          >
            {{ startMutation.isPending.value ? 'Iniciando…' : 'Iniciar serviços' }}
          </button>
          <template v-else>
            <button
              type="button"
              class="btn-secondary"
              :disabled="actionPending"
              @click="restartMutation.mutate()"
            >
              Reiniciar
            </button>
            <button
              type="button"
              class="btn-danger-outline"
              :disabled="actionPending"
              @click="stopMutation.mutate()"
            >
              Parar
            </button>
          </template>
        </div>
      </section>

      <section v-if="activeSession" class="section fade-in delay">
        <div class="status-grid">
          <div class="status-card">
            <div class="status-header">
              <span
                class="dot"
                :style="{
                  background: activeSession.connection.apiOnline
                    ? 'var(--success)'
                    : 'var(--danger)',
                }"
              />
              <span class="status-label">akira-brain · {{ activeSession.session.label }}</span>
            </div>
            <p class="status-detail">
              {{
                activeSession.runtime?.running
                  ? `pid ${activeSession.runtime.pid ?? '—'} · :${activeSession.session.port}`
                  : activeSession.runtime?.lastError ?? 'parado'
              }}
            </p>
          </div>
          <div class="status-card">
            <div class="status-header">
              <span
                class="dot"
                :style="{
                  background: activeSession.connection.connected
                    ? 'var(--success)'
                    : 'var(--danger)',
                }"
              />
              <span class="status-label">WhatsApp</span>
            </div>
            <p class="status-detail">
              {{
                activeSession.connection.connected
                  ? 'conectado'
                  : activeSession.connection.state
              }}
            </p>
          </div>
        </div>
      </section>

      <WhatsAppPairingPanel
        v-if="needsPairing && activeSession"
        class="fade-in delay2"
        :session-label="activeSession.session.label"
        :show-qr="showQr"
        :qr-code="activeSession.akiraBrain?.qr_code ?? ''"
        :qr-timed-out="qrTimedOut"
        :qr-waiting="qrWaiting"
        :restarting="restartMutation.isPending.value"
        @restart="restartMutation.mutate()"
      />

      <section class="section fade-in delay3">
        <h3 class="section-title">Contas</h3>
        <div class="accounts-list">
          <div v-for="s in form.sessions" :key="s.id" class="account-row">
            <div class="account-info">
              <span class="account-label">{{ s.label }}</span>
              <span class="account-meta">:{{ s.port }} · {{ s.id }}</span>
              <span v-if="s.id === form.defaultSessionId" class="account-badge">padrão</span>
            </div>
            <button
              type="button"
              class="btn-danger-outline btn-sm"
              :disabled="!canDeleteSessions || deletingSessionId === s.id"
              :title="
                canDeleteSessions
                  ? 'Remover conta e apagar dados locais'
                  : 'É necessário manter ao menos uma conta'
              "
              @click="confirmDeleteSession(s.id, s.label)"
            >
              {{ deletingSessionId === s.id ? 'Removendo…' : 'Remover' }}
            </button>
          </div>
        </div>
      </section>

      <section class="section fade-in delay4">
        <WhatsAppProjectsPanel
          v-if="activeSession"
          :session-id="activeSession.session.id"
          :connected="activeSession.connection.connected"
        />
      </section>

      <section class="section fade-in delay5">
        <h3 class="section-title">Configuração</h3>
        <form class="form" @submit.prevent="saveForm">
          <label class="checkbox-row">
            <input v-model="form.autoStart" type="checkbox" />
            <span>Iniciar serviços com o agente</span>
          </label>
          <label class="checkbox-row">
            <input v-model="form.enabled" type="checkbox" />
            <span>Plugin ativo para o agente</span>
          </label>
          <label class="field">
            <span class="label">Sessão padrão do agente</span>
            <select v-model="form.defaultSessionId" class="input">
              <option v-for="s in form.sessions" :key="s.id" :value="s.id">
                {{ s.label }} (:{{ s.port }})
              </option>
            </select>
          </label>
          <label class="field">
            <span class="label">Timeout HTTP (ms)</span>
            <input
              v-model.number="form.timeoutMs"
              class="input"
              type="number"
              min="1000"
              max="120000"
            />
          </label>
          <div class="form-actions">
            <button type="submit" class="btn-primary" :disabled="saveMutation.isPending.value">
              {{ saveMutation.isPending.value ? 'Salvando…' : 'Salvar' }}
            </button>
            <span v-if="saved" class="saved">Salvo</span>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.header {
  padding: 16px 20px 8px;
  flex-shrink: 0;
}
.header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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
}
.polling {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
.view-toggle {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.view-btn {
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  background: var(--surface);
  color: var(--text-muted);
}
.view-btn.active {
  background: var(--bg);
  color: var(--text);
  font-weight: 600;
}
.session-bar {
  padding: 0 20px 12px;
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}
.session-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.session-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 13px;
  font-weight: 500;
}
.session-tab.active {
  background: var(--bg);
  border-color: var(--accent-dim);
  font-weight: 600;
}
.session-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.add-session-row {
  display: flex;
  gap: 8px;
}
.chat-area {
  flex: 1;
  min-height: 0;
  padding: 0 20px 16px;
  display: flex;
  flex-direction: column;
}
.settings-scroll {
  flex: 1;
  overflow-y: auto;
}
.section {
  padding: 0 20px 16px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.service-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}
.status-card {
  padding: 14px;
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.status-label {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-mono);
}
.status-detail {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 480px;
  padding: 16px;
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
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
.input {
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 14px;
  font-family: var(--font-mono);
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-primary,
.btn-secondary,
.btn-danger-outline {
  padding: 9px 16px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 600;
}
.btn-primary {
  background: var(--accent-dim);
  color: var(--bg);
}
.btn-secondary {
  background: var(--surface);
  border: 1px solid var(--border);
}
.btn-danger-outline {
  background: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
}
.saved {
  font-size: 13px;
  color: var(--success);
  font-weight: 600;
}
.fade-in {
  animation: fadeIn 0.35s var(--ease-out);
}
.delay {
  animation-delay: 0.05s;
  animation-fill-mode: both;
}
.delay2 {
  animation-delay: 0.08s;
  animation-fill-mode: both;
}
.delay3 {
  animation-delay: 0.1s;
  animation-fill-mode: both;
}
.delay4 {
  animation-delay: 0.12s;
  animation-fill-mode: both;
}
.delay5 {
  animation-delay: 0.14s;
  animation-fill-mode: both;
  padding-bottom: 32px;
}
.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 480px;
}
.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.account-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.account-label {
  font-size: 14px;
  font-weight: 600;
}
.account-meta {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}
.account-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg);
  color: var(--accent);
  font-family: var(--font-mono);
}
.btn-sm {
  padding: 7px 12px;
  font-size: 12px;
  white-space: nowrap;
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
