<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { api, type InboxChat } from '../lib/api';

const props = defineProps<{
  sessionId: string;
  connected: boolean;
}>();

const queryClient = useQueryClient();
const newProjectName = ref('');
const mapJid = ref('');
const mapProjectId = ref<number | ''>('');

const { data: projects, isLoading: projectsLoading } = useQuery({
  queryKey: ['whatsapp-projects', props.sessionId],
  queryFn: () => api.whatsappProjects(props.sessionId),
  enabled: computed(() => props.connected),
});

const { data: inbox } = useQuery({
  queryKey: ['whatsapp-inbox', props.sessionId],
  queryFn: () => api.whatsappInbox(props.sessionId),
  enabled: computed(() => props.connected),
});

const createMutation = useMutation({
  mutationFn: () =>
    api.createWhatsAppProject({
      sessionId: props.sessionId,
      name: newProjectName.value.trim(),
    }),
  onSuccess: () => {
    newProjectName.value = '';
    queryClient.invalidateQueries({ queryKey: ['whatsapp-projects', props.sessionId] });
  },
});

const mapMutation = useMutation({
  mutationFn: () =>
    api.mapWhatsAppContact({
      sessionId: props.sessionId,
      jid: mapJid.value,
      projectId: Number(mapProjectId.value),
    }),
  onSuccess: () => {
    mapJid.value = '';
    mapProjectId.value = '';
  },
});

function selectChat(chat: InboxChat) {
  mapJid.value = chat.chat_jid;
}
</script>

<template>
  <section class="panel">
    <h3 class="section-title">Projetos akira-brain</h3>
    <p v-if="!connected" class="hint">Conecte o WhatsApp para gerenciar projetos.</p>
    <template v-else>
      <div class="create-row">
        <input
          v-model="newProjectName"
          class="input"
          placeholder="Nome do projeto"
        />
        <button
          type="button"
          class="btn-primary"
          :disabled="!newProjectName.trim() || createMutation.isPending.value"
          @click="createMutation.mutate()"
        >
          {{ createMutation.isPending.value ? 'Criando…' : 'Criar projeto' }}
        </button>
      </div>

      <div v-if="projectsLoading" class="hint">Carregando projetos…</div>
      <ul v-else-if="projects && projects.length > 0" class="project-list">
        <li v-for="p in projects" :key="p.id" class="project-item">
          <span class="project-name">{{ p.name }}</span>
          <span v-if="p.description" class="project-desc">{{ p.description }}</span>
        </li>
      </ul>
      <p v-else class="hint">Nenhum projeto ainda.</p>

      <div class="map-section">
        <h4 class="map-title">Vincular chat a projeto</h4>
        <div class="map-form">
          <select v-model="mapProjectId" class="input">
            <option disabled value="">Selecione o projeto</option>
            <option v-for="p in projects ?? []" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
          <input v-model="mapJid" class="input mono" placeholder="JID ou selecione abaixo" />
          <button
            type="button"
            class="btn-secondary"
            :disabled="!mapJid || !mapProjectId || mapMutation.isPending.value"
            @click="mapMutation.mutate()"
          >
            {{ mapMutation.isPending.value ? 'Vinculando…' : 'Vincular' }}
          </button>
        </div>
        <p v-if="mapMutation.isSuccess.value" class="success">Chat vinculado ao projeto.</p>
        <div v-if="inbox && inbox.length > 0" class="chat-pick">
          <button
            v-for="chat in inbox.slice(0, 8)"
            :key="chat.chat_jid"
            type="button"
            class="chat-chip"
            :class="{ active: mapJid === chat.chat_jid }"
            @click="selectChat(chat)"
          >
            {{ chat.display_name || chat.chat_jid }}
          </button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.panel {
  max-width: 520px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.hint {
  font-size: 13px;
  color: var(--text-muted);
}
.create-row,
.map-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.input {
  padding: 10px 12px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 14px;
  flex: 1;
  min-width: 140px;
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.btn-primary,
.btn-secondary {
  padding: 9px 14px;
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
.project-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.project-item {
  padding: 10px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.project-name {
  font-size: 14px;
  font-weight: 600;
}
.project-desc {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
.map-section {
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.map-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.success {
  font-size: 12px;
  color: var(--success);
  margin-bottom: 8px;
}
.chat-pick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chat-chip {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
}
.chat-chip.active {
  border-color: var(--accent-dim);
  background: var(--bg);
  font-weight: 600;
}
</style>
