<script setup lang="ts">
defineProps<{ items: string[] }>()
</script>

<template>
  <ul class="unlocks">
    <li v-for="item in items" :key="item" class="unlocks__item">
      <span class="unlocks__check" aria-hidden="true">✓</span>
      <span class="unlocks__label">{{ item }}</span>
    </li>
  </ul>
</template>

<style scoped>
.unlocks {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
  padding: 13px 14px;
  border-radius: var(--r-md);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  box-shadow: var(--sh-card);
}

.unlocks__item {
  display: flex;
  align-items: center;
  gap: 9px;
}

.unlocks__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 21px;
  height: 21px;
  flex: none;
  border-radius: var(--r-pill);
  background: var(--c-green-soft);
  color: var(--c-green-700);
  font-size: 11.5px;
  font-weight: 900;
  line-height: 1;
}

.unlocks__label {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-ink-soft);
}
</style>
