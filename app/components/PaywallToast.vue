<script setup lang="ts">
const { toast } = usePaywall()
</script>

<template>
  <Transition name="toast">
    <div
      v-if="toast"
      class="toast"
      :class="`toast--${toast.tone}`"
      role="status"
      aria-live="polite"
    >
      <span class="toast__icon" aria-hidden="true">
        {{ toast.tone === 'ok' ? '✓' : '!' }}
      </span>
      {{ toast.text }}
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: absolute;
  left: 50%;
  bottom: calc(140px + env(safe-area-inset-bottom, 0px));
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 40px);
  padding: 9px 14px 9px 10px;
  border-radius: var(--r-pill);
  background: rgba(30, 26, 46, 0.94);
  color: #fff;
  font-size: 12.5px;
  font-weight: 700;
  transform: translateX(-50%);
  box-shadow: 0 10px 24px rgba(24, 20, 40, 0.28);
}

.toast__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex: none;
  border-radius: var(--r-pill);
  background: var(--c-green);
  font-size: 11px;
  font-weight: 900;
}

.toast--error .toast__icon {
  background: var(--c-danger);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
