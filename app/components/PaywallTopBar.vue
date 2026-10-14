<script setup lang="ts">
defineEmits<{ close: [] }>()
</script>

<template>
  <header class="topbar">
    <button class="topbar__icon" type="button" aria-label="Закрыть" @click="$emit('close')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 2.5l11 11m0-11l-11 11"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <div class="topbar__brand">
      <span class="topbar__logo" aria-hidden="true">🏝️</span>
      <span class="topbar__name">Чудо-Остров</span>
    </div>

    <span class="topbar__icon topbar__icon--ghost" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M3.5 6.5a5 5 0 119 0v3.2l1 1.3H2.5l1-1.3V6.5z"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
        <path d="M6.5 13a1.6 1.6 0 003 0" stroke="currentColor" stroke-width="1.4" />
      </svg>
    </span>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex: none;
  padding: 10px var(--pad) 4px;
}

.topbar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--c-line);
  color: var(--c-ink-soft);
  transition: background 0.15s ease;
}

.topbar__icon:active {
  background: var(--c-brand-soft);
}

.topbar__icon--ghost {
  color: var(--c-muted);
}

.topbar__brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--c-ink-soft);
}

.topbar__logo {
  font-size: 15px;
  line-height: 1;
}
</style>
