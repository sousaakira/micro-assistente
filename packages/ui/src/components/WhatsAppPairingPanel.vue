<script setup lang="ts">
import QrDisplay from './QrDisplay.vue';

defineProps<{
  sessionLabel: string;
  showQr: boolean;
  qrCode: string;
  qrTimedOut: boolean;
  qrWaiting: boolean;
  restarting: boolean;
}>();

defineEmits<{
  restart: [];
}>();
</script>

<template>
  <section class="section">
    <h3 class="section-title">Parear · {{ sessionLabel }}</h3>
    <div class="qr-box">
      <template v-if="showQr && qrCode">
        <QrDisplay :value="qrCode" />
        <p class="qr-text">WhatsApp → Aparelhos conectados → Conectar aparelho</p>
        <p class="qr-hint">
          Cada QR fica válido por cerca de 20–60 segundos. Se expirar, aguarde o próximo ou use
          "Gerar novo QR".
        </p>
      </template>
      <template v-else-if="qrTimedOut">
        <p class="qr-text">O QR code expirou antes de ser escaneado.</p>
        <button type="button" class="btn-primary" :disabled="restarting" @click="$emit('restart')">
          {{ restarting ? 'Reiniciando…' : 'Gerar novo QR' }}
        </button>
      </template>
      <p v-else-if="qrWaiting" class="qr-text">Gerando QR code… aguarde alguns segundos.</p>
      <template v-else>
        <p class="qr-text">Não foi possível gerar o QR code.</p>
        <button type="button" class="btn-secondary" :disabled="restarting" @click="$emit('restart')">
          {{ restarting ? 'Reiniciando…' : 'Tentar novamente' }}
        </button>
      </template>
    </div>
  </section>
</template>

<style scoped>
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
.qr-box {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: 16px;
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.qr-text {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-muted);
}
.qr-hint {
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-muted);
  opacity: 0.85;
}
.btn-primary,
.btn-secondary {
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
</style>
