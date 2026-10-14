<script setup lang="ts">
import type { SuccessDetails } from '../composables/usePaywall'

const props = defineProps<{ details: SuccessDetails }>()
defineEmits<{ continue: [] }>()

const confetti = [
  { emoji: '🎉', x: -52, y: -34, r: -18 },
  { emoji: '⭐️', x: -28, y: -50, r: 12 },
  { emoji: '🏝️', x: 2, y: -54, r: -6 },
  { emoji: '🎈', x: 30, y: -48, r: 16 },
  { emoji: '✨', x: 52, y: -28, r: 24 },
  { emoji: '🧭', x: 56, y: 10, r: -12 },
]
</script>

<template>
  <section class="success" role="status" aria-live="polite">
    <div class="success__art" aria-hidden="true">
      <span class="success__ring" />
      <span class="success__check">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <path
            d="M8 17.6l6 6L26 11"
            stroke="currentColor"
            stroke-width="3.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span
        v-for="piece in confetti"
        :key="piece.emoji"
        class="success__confetti"
        :style="{
          transform: `translate(${piece.x}px, ${piece.y}px) rotate(${piece.r}deg)`,
        }"
        >{{ piece.emoji }}</span
      >
    </div>

    <h1 class="success__title">Полный доступ открыт!</h1>
    <p class="success__subtitle">
      Все 120 уровней и шесть островов разблокированы. Приятной игры!
    </p>

    <button class="success__button" type="button" @click="$emit('continue')">
      Продолжить игру
    </button>

    <dl class="success__receipt">
      <div class="success__row">
        <dt>Тариф</dt>
        <dd>{{ props.details.planTitle }}</dd>
      </div>
      <div class="success__row">
        <dt>Сумма</dt>
        <dd>{{ props.details.amountLabel }}</dd>
      </div>
      <div class="success__row">
        <dt>Дата</dt>
        <dd>{{ props.details.purchasedAtLabel }}</dd>
      </div>
      <div class="success__row">
        <dt>Номер покупки</dt>
        <dd class="success__mono">{{ props.details.purchaseId }}</dd>
      </div>
    </dl>

    <p class="success__stored">
      <span aria-hidden="true">🎮</span>
      Доступ привязан к этому устройству
    </p>
  </section>
</template>

<style scoped>
.success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4px 0 8px;
}

.success__art {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 124px;
  height: 124px;
}

.success__ring {
  position: absolute;
  inset: 0;
  border-radius: var(--r-pill);
  background: radial-gradient(circle at 50% 45%, #dcf9ea 0%, rgba(220, 249, 234, 0) 70%);
}

.success__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 76px;
  height: 76px;
  border-radius: var(--r-pill);
  background: linear-gradient(135deg, var(--c-green) 0%, #0ea96c 100%);
  color: #fff;
  box-shadow: 0 10px 24px rgba(20, 192, 123, 0.34);
  animation: pop 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.success__confetti {
  position: absolute;
  font-size: 15px;
  line-height: 1;
  opacity: 0.92;
}

.success__title {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.02em;
}

.success__subtitle {
  margin-top: 8px;
  max-width: 300px;
  font-size: 13.5px;
  line-height: 1.45;
  font-weight: 600;
  color: var(--c-ink-soft);
}

.success__receipt {
  width: 100%;
  margin: 16px 0 0;
  padding: 11px 14px;
  border-radius: var(--r-md);
  background: var(--c-surface-soft);
  border: 1px solid var(--c-line);
  text-align: left;
}

.success__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 5px 0;
}

.success__row + .success__row {
  border-top: 1px dashed rgba(233, 229, 245, 0.9);
}

.success__row dt {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--c-muted);
  white-space: nowrap;
}

.success__row dd {
  margin: 0;
  font-size: 12.5px;
  font-weight: 800;
  color: var(--c-ink);
  text-align: right;
}

.success__mono {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  word-break: break-all;
}

.success__stored {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 6px 12px;
  border-radius: var(--r-pill);
  background: var(--c-green-soft);
  color: var(--c-green-700);
  font-size: 11.5px;
  font-weight: 800;
}

.success__button {
  width: 100%;
  min-height: 52px;
  margin-top: 16px;
  border-radius: var(--r-pill);
  background: linear-gradient(135deg, var(--c-brand) 0%, var(--c-brand-700) 100%);
  color: #fff;
  font-size: 15.5px;
  font-weight: 900;
  box-shadow: var(--sh-raised);
}

.success__button:active {
  transform: translateY(1px);
}

@keyframes pop {
  from {
    transform: scale(0.6);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
