<script setup lang="ts">
/**
 * QA helper (desktop preview only): lets a reviewer replay the loading,
 * error and success branches without touching the network.
 */
const route = useRoute()
const router = useRouter()
const { loadOffers } = usePaywall()

const modes = [
  { value: 'ok', label: 'Обычный экран' },
  { value: 'slow', label: 'Загрузка тарифов' },
  { value: 'error', label: 'Ошибка загрузки' },
] as const

const mode = computed(() => {
  const value = String(route.query.demo ?? 'ok')
  return modes.some(item => item.value === value) ? value : 'ok'
})

async function apply(value: string) {
  const query = { ...route.query }
  if (value === 'ok') delete query.demo
  else query.demo = value
  await router.replace({ query })
  await loadOffers(true)
}
</script>

<template>
  <aside class="qa">
    <span class="qa__label">Состояния</span>
    <div class="qa__row">
      <button
        v-for="item in modes"
        :key="item.value"
        class="qa__button"
        :class="{ 'qa__button--on': mode === item.value }"
        type="button"
        @click="apply(item.value)"
      >
        {{ item.label }}
      </button>
    </div>
    <span class="qa__hint">
      Ошибка покупки: выключите сеть и нажмите CTA. Успех — после тестовой покупки.
    </span>
  </aside>
</template>

<style scoped>
.qa {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 50;
  display: none;
  flex-direction: column;
  gap: 6px;
  max-width: 260px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(30, 26, 46, 0.92);
  color: #fff;
  box-shadow: 0 16px 36px rgba(24, 20, 40, 0.3);
}

@media (min-width: 1024px) {
  .qa {
    display: flex;
  }
}

.qa__label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
}

.qa__row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.qa__button {
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 11.5px;
  font-weight: 700;
}

.qa__button--on {
  background: #fff;
  color: #1e1a2e;
}

.qa__hint {
  font-size: 10.5px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.66);
}
</style>
