<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import QRCode from 'qrcode';

const props = withDefaults(
  defineProps<{
    value: string;
    size?: number;
  }>(),
  { size: 220 }
);

const dataUrl = ref<string | null>(null);
let cancelled = false;

async function renderQr() {
  if (!props.value) {
    dataUrl.value = null;
    return;
  }
  cancelled = false;
  try {
    const url = await QRCode.toDataURL(props.value, {
      width: props.size,
      margin: 2,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    });
    if (!cancelled) dataUrl.value = url;
  } catch {
    if (!cancelled) dataUrl.value = null;
  }
}

watch(() => [props.value, props.size], renderQr, { immediate: true });
onUnmounted(() => {
  cancelled = true;
});
</script>

<template>
  <img
    v-if="dataUrl"
    :src="dataUrl"
    alt="QR code para parear WhatsApp"
    :width="size"
    :height="size"
    class="qr"
  />
  <div v-else class="placeholder" :style="{ width: `${size}px`, height: `${size}px` }" />
</template>

<style scoped>
.qr {
  border-radius: 12px;
  border: 1px solid var(--border);
}
.placeholder {
  background: var(--surface);
  border-radius: 12px;
  border: 1px solid var(--border);
}
</style>
