<script setup lang="ts">
defineProps<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}>();
</script>

<template>
  <div
    class="skeleton"
    aria-hidden="true"
    :style="{
      width: width ?? '100%',
      height: typeof height === 'number' ? `${height}px` : (height ?? '16px'),
      borderRadius:
        typeof borderRadius === 'number' ? `${borderRadius}px` : (borderRadius ?? '4px'),
    }"
  />
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface) 25%,
    var(--surface-hover) 50%,
    var(--surface) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s linear infinite;
}
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
