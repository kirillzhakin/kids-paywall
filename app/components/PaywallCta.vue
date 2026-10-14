<script setup lang="ts">
const props = defineProps<{
  title: string
  subtitle?: string | null
  loading?: boolean
  disabled?: boolean
  restoring?: boolean
  purchased?: boolean
  error?: string | null
}>()

defineEmits<{ purchase: []; restore: []; 'show-history': [] }>()

const buttonLabel = computed(() => {
  if (props.purchased) return 'Полный доступ открыт'
  if (props.loading) return 'Оформляем…'
  return props.title
})
</script>

<template>
  <footer class="cta">
    <button
      class="cta__button"
      type="button"
      :disabled="disabled || loading || purchased"
      :aria-busy="loading"
      @click="$emit('purchase')"
    >
      <span v-if="loading" class="cta__spinner" aria-hidden="true" />
      <span class="cta__button-label">{{ buttonLabel }}</span>
      <span v-if="subtitle && !loading" class="cta__button-note">{{ subtitle }}</span>
    </button>

    <p v-if="error" class="cta__hint cta__hint--error" role="status">{{ error }}</p>

    <div class="cta__links">
      <button class="cta__link" type="button" :disabled="restoring" @click="$emit('restore')">
        <span v-if="restoring" class="cta__spinner cta__spinner--dark" aria-hidden="true" />
        {{ restoring ? 'Проверяем…' : 'Восстановить покупки' }}
      </button>

      <span class="cta__dot" aria-hidden="true">•</span>

      <button class="cta__link" type="button" @click="$emit('show-history')">Мои покупки</button>
    </div>

    <p class="cta__legal">
      Тестовая покупка без списания денег. Подписку можно отменить в настройках в любой момент.
    </p>
  </footer>
</template>

<style scoped>
.cta {
  flex: none;
  padding: 12px var(--pad) calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 255, 255, 0.96);
  border-top: 1px solid var(--c-line);
  box-shadow: var(--sh-bar);
  backdrop-filter: blur(8px);
}

.cta__button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 54px;
  padding: 8px 18px;
  border-radius: var(--r-pill);
  background: linear-gradient(135deg, var(--c-brand) 0%, var(--c-brand-700) 100%);
  color: #fff;
  box-shadow: var(--sh-raised);
  transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.12s ease;
}

.cta__button:disabled {
  cursor: default;
  opacity: 0.72;
  box-shadow: none;
}

.cta__button:not(:disabled):active {
  transform: translateY(1px) scale(0.995);
}

.cta__button-label {
  font-size: clamp(14.5px, 4.1vw, 16px);
  font-weight: 900;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.cta__button-note {
  font-size: clamp(10.5px, 3vw, 12px);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  white-space: nowrap;
}

.cta__spinner {
  width: 16px;
  height: 16px;
  flex: none;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}

.cta__spinner--dark {
  width: 12px;
  height: 12px;
  border-color: rgba(106, 69, 255, 0.3);
  border-top-color: var(--c-brand);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.cta__hint {
  margin-top: 8px;
  font-size: 11.5px;
  font-weight: 700;
  text-align: center;
}

.cta__hint--error {
  color: var(--c-danger);
}

.cta__links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

.cta__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 4px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c-brand-600);
  text-decoration: none;
}

.cta__link:disabled {
  opacity: 0.6;
}

.cta__link:active {
  text-decoration: underline;
}

.cta__dot {
  color: var(--c-muted);
  font-size: 12px;
}

.cta__legal {
  margin-top: 6px;
  font-size: 10px;
  line-height: 1.4;
  font-weight: 600;
  color: var(--c-muted);
  text-align: center;
}
</style>
