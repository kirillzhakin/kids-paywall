<script setup lang="ts">
/** Placeholder shown while GET /api/offers is in flight. */
</script>

<template>
  <div class="skeleton" aria-hidden="true">
    <div class="skeleton__row">
      <span class="skeleton__circle sk" />
      <span class="skeleton__lines">
        <span class="skeleton__line sk" style="width: 58%" />
        <span class="skeleton__line skeleton__line--sm sk" style="width: 78%" />
      </span>
      <span class="skeleton__price sk" />
    </div>
    <span class="skeleton__divider" />
    <span class="skeleton__line sk" style="width: 66%" />
  </div>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: var(--r-lg);
  background: var(--c-surface);
  border: 1.5px solid var(--c-line);
  box-shadow: var(--sh-card);
}

.skeleton__row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.skeleton__circle {
  width: 22px;
  height: 22px;
  flex: none;
  border-radius: var(--r-pill);
}

.skeleton__lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 auto;
}

.skeleton__line {
  height: 11px;
  border-radius: 6px;
}

.skeleton__line--sm {
  height: 9px;
}

.skeleton__price {
  width: 68px;
  height: 20px;
  border-radius: 8px;
  flex: none;
}

.skeleton__divider {
  height: 1px;
  background: var(--c-line);
  opacity: 0.8;
}

.sk {
  background: linear-gradient(90deg, #eeeaf9 0%, #f7f5ff 45%, #eeeaf9 100%);
  background-size: 220% 100%;
  animation: shimmer 1.25s ease-in-out infinite;
}

@keyframes shimmer {
  0% {
    background-position: 120% 0;
  }
  100% {
    background-position: -20% 0;
  }
}
</style>
