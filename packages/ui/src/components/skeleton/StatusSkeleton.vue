<script setup lang="ts">
import SkeletonBlock from '../SkeletonBlock.vue';
</script>

<template>
  <div class="bar">
    <SkeletonBlock :width="12" :height="12" :border-radius="999" />
    <SkeletonBlock :width="120" :height="14" />
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 12px 20px;
}
</style>
