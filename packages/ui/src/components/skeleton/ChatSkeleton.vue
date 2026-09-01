<script setup lang="ts">
import SkeletonBlock from '../SkeletonBlock.vue';

defineProps<{ full?: boolean }>();
</script>

<template>
  <div v-if="full" class="full">
    <div class="side">
      <SkeletonBlock width="80%" :height="36" :border-radius="10" />
      <SkeletonBlock :height="40" :border-radius="8" class="gap-top" />
      <SkeletonBlock :height="40" :border-radius="8" class="gap-sm" />
    </div>
    <div class="main">
      <div class="messages">
        <SkeletonBlock width="70%" :height="48" :border-radius="12" />
        <SkeletonBlock width="50%" :height="48" :border-radius="12" class="gap-sm" />
      </div>
    </div>
  </div>
  <div v-else class="messages">
    <SkeletonBlock width="70%" :height="48" :border-radius="12" />
    <SkeletonBlock width="55%" :height="48" :border-radius="12" class="gap-sm" />
    <SkeletonBlock width="65%" :height="48" :border-radius="12" class="gap-sm" />
  </div>
</template>

<style scoped>
.full { display: flex; height: 100vh; }
.side { width: 220px; border-right: 1px solid var(--border); padding: 20px; }
.main { flex: 1; padding: 20px; }
.messages { display: flex; flex-direction: column; }
.gap-top { margin-top: 24px; }
.gap-sm { margin-top: 8px; }
</style>
