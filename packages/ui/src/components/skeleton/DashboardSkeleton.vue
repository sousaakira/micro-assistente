<script setup lang="ts">
import SkeletonBlock from '../SkeletonBlock.vue';
</script>

<template>
  <div class="stack">
    <div v-for="i in 4" :key="i" class="card">
      <SkeletonBlock width="60%" :height="14" />
      <SkeletonBlock width="40%" :height="12" class="gap-sm" />
    </div>
  </div>
</template>

<style scoped>
.stack { display: flex; flex-direction: column; gap: 12px; }
.card {
  padding: 16px;
  background: var(--surface);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.gap-sm { margin-top: 8px; }
</style>
