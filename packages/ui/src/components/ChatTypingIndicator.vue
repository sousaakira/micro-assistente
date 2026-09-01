<template>
  <div class="fade-in">
    <div class="row">
      <div class="bubble assistant">
        <div class="typing">
          <span v-for="i in 3" :key="i" class="dot" :style="{ animationDelay: `${i * 0.2}s` }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fadeIn 0.35s var(--ease-out);
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.row {
  display: flex;
  margin-bottom: 12px;
}
.bubble {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
}
.typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}
</style>
