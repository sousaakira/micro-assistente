<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import DashboardSkeleton from '../components/skeleton/DashboardSkeleton.vue';
import { api } from '../lib/api';

const queryClient = useQueryClient();
const saved = ref(false);

const { data, isLoading } = useQuery({
  queryKey: ['agent-config'],
  queryFn: api.agentConfig,
});

const local = ref({
  provider: 'llama-cpp' as 'llama-cpp' | 'ollama' | 'openai',
  baseUrl: '',
  model: '',
  maxTokens: 2048,
  apiKey: '',
  disabledPlugins: [] as string[],
});

watch(
  data,
  (value) => {
    if (!value) return;
    local.value = {
      provider: value.effectiveLlm.provider,
      baseUrl: value.effectiveLlm.baseUrl,
      model: value.effectiveLlm.model,
      maxTokens: value.effectiveLlm.maxTokens,
      apiKey: value.config.llm.apiKey ?? '',
      disabledPlugins: [...value.config.disabledPlugins],
    };
  },
  { immediate: true }
);

const saveMutation = useMutation({
  mutationFn: () =>
    api.updateAgentConfig({
      llm: {
        provider: local.value.provider,
        baseUrl: local.value.baseUrl,
        model: local.value.model,
        maxTokens: local.value.maxTokens,
        apiKey: local.value.apiKey || undefined,
      },
      disabledPlugins: local.value.disabledPlugins,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['agent-config'] });
    queryClient.invalidateQueries({ queryKey: ['health'] });
    saved.value = true;
    setTimeout(() => {
      saved.value = false;
    }, 2000);
  },
});

function togglePlugin(id: string) {
  const set = new Set(local.value.disabledPlugins);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  local.value.disabledPlugins = [...set];
}
</script>

<template>
  <div class="container">
    <header class="header fade-in">
      <h2 class="title">Configurações</h2>
      <p class="subtitle">Modelo LLM, plugins e parâmetros do agente</p>
    </header>

    <DashboardSkeleton v-if="isLoading" />
    <section v-else-if="data" class="section fade-in">
      <form class="form" @submit.prevent="saveMutation.mutate()">
        <h3 class="section-title">LLM</h3>
        <label class="field">
          <span class="label">Provedor</span>
          <select v-model="local.provider" class="input">
            <option value="llama-cpp">llama-cpp</option>
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI-compatível</option>
          </select>
        </label>
        <label class="field">
          <span class="label">Base URL</span>
          <input v-model="local.baseUrl" class="input mono" />
        </label>
        <label class="field">
          <span class="label">Modelo</span>
          <input v-model="local.model" class="input mono" />
        </label>
        <label class="field">
          <span class="label">Max tokens</span>
          <input v-model.number="local.maxTokens" class="input" type="number" min="256" max="32768" />
        </label>
        <label class="field">
          <span class="label">API Key (opcional)</span>
          <input v-model="local.apiKey" class="input mono" type="password" />
        </label>

        <h3 class="section-title">Plugins</h3>
        <div class="plugins">
          <label v-for="plugin in data.plugins" :key="plugin.id" class="plugin-row">
            <input
              type="checkbox"
              :checked="!local.disabledPlugins.includes(plugin.id)"
              @change="togglePlugin(plugin.id)"
            />
            <span>
              <strong>{{ plugin.name }}</strong>
              <span class="plugin-desc">{{ plugin.description }}</span>
            </span>
          </label>
        </div>

        <div class="actions">
          <button type="submit" class="btn-primary" :disabled="saveMutation.isPending.value">
            {{ saveMutation.isPending.value ? 'Salvando…' : 'Salvar' }}
          </button>
          <span v-if="saved" class="saved">Salvo</span>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.container {
  height: 100%;
  overflow-y: auto;
}
.header {
  padding: 20px 20px 12px;
}
.title {
  font-size: 18px;
  font-weight: 700;
}
.subtitle {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}
.section {
  padding: 0 20px 32px;
}
.form {
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
}
.mono {
  font-family: var(--font-mono);
}
.plugins {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.plugin-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 14px;
}
.plugin-desc {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.btn-primary {
  padding: 9px 16px;
  background: var(--accent-dim);
  color: var(--bg);
  border-radius: var(--radius);
  font-weight: 600;
}
.saved {
  color: var(--success);
  font-size: 13px;
  font-weight: 600;
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
