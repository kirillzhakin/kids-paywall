<script setup lang="ts">
import type { PurchaseRecord } from '../../shared/types/paywall'

const props = defineProps<{
  open: boolean
  items: PurchaseRecord[]
  loading?: boolean
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const close = () => emit('update:open', false)

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100)

const date = (iso: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

const totalLabel = computed(() => {
  if (!props.items.length) return null
  const first = props.items[0]!
  return money(first.amountMinor, first.currency)
})
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="sheet" role="dialog" aria-modal="true" aria-label="Мои покупки">
      <div class="sheet__backdrop" @click="close" />

      <div class="sheet__panel">
        <span class="sheet__handle" aria-hidden="true" />

        <div class="sheet__head">
          <h2 class="sheet__title">Мои покупки</h2>
          <button class="sheet__close" type="button" aria-label="Закрыть" @click="close">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M2.5 2.5l11 11m0-11l-11 11"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <p class="sheet__subtitle">
          Строки из таблицы <code>purchases</code> — их вернул
          <code>GET /api/purchases</code>.
        </p>

        <div v-if="loading" class="sheet__loading">
          <span class="cta-spinner" aria-hidden="true" />
          Загружаем историю…
        </div>

        <p v-else-if="!items.length" class="sheet__empty">
          Покупок пока нет. Оформите тестовую покупку — запись появится здесь.
        </p>

        <ul v-else class="sheet__list">
          <li v-for="item in items" :key="item.id" class="sheet__item">
            <div class="sheet__item-main">
              <span class="sheet__item-title">{{ item.planTitle }}</span>
              <span class="sheet__item-meta">
                {{ date(item.createdAt) }} · {{ item.id }}
              </span>
            </div>
            <span class="sheet__item-amount">{{ money(item.amountMinor, item.currency) }}</span>
          </li>
        </ul>

        <p v-if="totalLabel && items.length" class="sheet__total">
          Всего записей: <strong>{{ items.length }}</strong>
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sheet {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
}

.sheet__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(24, 20, 40, 0.42);
  backdrop-filter: blur(2px);
}

.sheet__panel {
  position: relative;
  width: 100%;
  max-height: 72%;
  overflow-y: auto;
  padding: 10px var(--pad) calc(18px + env(safe-area-inset-bottom, 0px));
  background: var(--c-surface);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
  box-shadow: 0 -10px 30px rgba(24, 20, 40, 0.22);
}

.sheet__handle {
  display: block;
  width: 40px;
  height: 4px;
  margin: 0 auto 10px;
  border-radius: var(--r-pill);
  background: var(--c-line);
}

.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sheet__title {
  font-size: 17px;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.sheet__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-pill);
  background: var(--c-surface-soft);
  color: var(--c-ink-soft);
}

.sheet__subtitle {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.4;
  font-weight: 600;
  color: var(--c-muted);
}

.sheet__subtitle code {
  padding: 1px 4px;
  border-radius: 5px;
  background: var(--c-surface-soft);
  font-size: 10.5px;
}

.sheet__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c-muted);
}

.cta-spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 2px solid rgba(106, 69, 255, 0.25);
  border-top-color: var(--c-brand);
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.sheet__empty {
  margin-top: 14px;
  padding: 14px;
  border-radius: var(--r-md);
  background: var(--c-surface-soft);
  font-size: 12.5px;
  line-height: 1.45;
  font-weight: 600;
  color: var(--c-ink-soft);
}

.sheet__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 14px;
}

.sheet__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  background: var(--c-surface-soft);
  border: 1px solid var(--c-line);
}

.sheet__item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sheet__item-title {
  font-size: 12.5px;
  font-weight: 800;
}

.sheet__item-meta {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--c-muted);
  word-break: break-all;
}

.sheet__item-amount {
  flex: none;
  font-size: 13px;
  font-weight: 900;
}

.sheet__total {
  margin-top: 10px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--c-muted);
  text-align: center;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-enter-active .sheet__panel,
.sheet-leave-active .sheet__panel {
  transition: transform 0.24s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet__panel,
.sheet-leave-to .sheet__panel {
  transform: translateY(100%);
}
</style>
