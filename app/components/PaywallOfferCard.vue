<script setup lang="ts">
import type { Offer } from '../../shared/types/paywall'

defineProps<{
  offer: Offer
  active: boolean
  disabled?: boolean
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <div
    class="card"
    :class="{ 'card--active': active, 'card--disabled': disabled }"
    role="radio"
    :aria-checked="active"
    :tabindex="disabled ? -1 : 0"
    :aria-label="`${offer.name}, ${offer.title}, ${offer.priceLabel} ${offer.periodLabel}`"
    @click="!disabled && $emit('select')"
    @keydown.enter.prevent="!disabled && $emit('select')"
    @keydown.space.prevent="!disabled && $emit('select')"
  >
    <span v-if="offer.badge" class="card__badge">{{ offer.badge }}</span>

    <span class="card__radio" :class="{ 'card__radio--on': active }" aria-hidden="true">
      <svg v-if="active" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.2 6.3l2.3 2.3 5-5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>

    <div class="card__body">
      <div class="card__head">
        <span class="card__name">{{ offer.name }}</span>
        <span class="card__price">
          <span class="card__amount">{{ offer.priceLabel }}</span>
          <span class="card__period">{{ offer.periodLabel }}</span>
          <span v-if="offer.comparePriceLabel" class="card__compare">
            {{ offer.comparePriceLabel }}
          </span>
        </span>
      </div>

      <p class="card__desc">{{ offer.description }}</p>

      <ul class="card__highlights">
        <li v-for="highlight in offer.highlights" :key="highlight">
          <span aria-hidden="true">✓</span>
          {{ highlight }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 15px 15px 13px;
  border-radius: var(--r-lg);
  background: var(--c-surface);
  border: 1.5px solid var(--c-line);
  box-shadow: var(--sh-card);
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.card--active {
  border-color: var(--c-brand);
  background: linear-gradient(180deg, #f8f6ff 0%, #ffffff 58%);
  box-shadow: 0 8px 22px rgba(106, 69, 255, 0.16);
}

.card--disabled {
  opacity: 0.62;
}

.card__badge {
  position: absolute;
  top: -9px;
  right: 13px;
  padding: 3px 10px;
  border-radius: var(--r-pill);
  background: linear-gradient(135deg, var(--c-green) 0%, #0ea96c 100%);
  color: #fff;
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.01em;
  white-space: nowrap;
  box-shadow: 0 4px 10px rgba(20, 192, 123, 0.32);
}

.card__radio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: none;
  margin-top: 2px;
  border-radius: var(--r-pill);
  border: 2px solid var(--c-brand-line);
  background: #fff;
  color: #fff;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.card__radio--on {
  background: var(--c-brand);
  border-color: var(--c-brand);
}

.card__body {
  flex: 1 1 auto;
  min-width: 0;
}

.card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.card__name {
  padding-top: 1px;
  font-size: 15.5px;
  font-weight: 900;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.card__price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: none;
  text-align: right;
}

.card__amount {
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1.15;
  white-space: nowrap;
}

.card__period {
  font-size: 11px;
  font-weight: 700;
  color: var(--c-muted);
  white-space: nowrap;
}

.card__compare {
  margin-top: 2px;
  font-size: 11px;
  font-weight: 700;
  color: var(--c-muted);
  text-decoration: line-through;
  white-space: nowrap;
}

.card__desc {
  margin-top: 3px;
  font-size: 11.5px;
  line-height: 1.32;
  font-weight: 600;
  color: var(--c-muted);
}

.card__highlights {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--c-line);
}

.card__highlights li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--c-ink-soft);
}

.card__highlights span {
  color: var(--c-green);
  font-size: 12px;
  font-weight: 900;
}
</style>
