<script setup lang="ts">
defineProps<{ message: string }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="banner" role="alert">
    <span class="banner__icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 5.2v3.6"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
        <circle cx="8" cy="11.4" r="1" fill="currentColor" />
        <circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.4" />
      </svg>
    </span>

    <p class="banner__text">
      <strong>Что-то пошло не так</strong>
      <span>{{ message }}</span>
    </p>

    <button class="banner__retry" type="button" @click="$emit('retry')">Повторить</button>
  </div>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  background: var(--c-danger-soft);
  border: 1px solid rgba(224, 65, 63, 0.22);
}

.banner__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: var(--r-pill);
  background: #fff;
  color: var(--c-danger);
}

.banner__text {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.3;
}

.banner__text strong {
  font-size: 12.5px;
  font-weight: 800;
  color: #9c2422;
}

.banner__text span {
  font-size: 11.5px;
  font-weight: 600;
  color: #b04a48;
}

.banner__retry {
  flex: none;
  min-height: 34px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  background: #fff;
  border: 1px solid rgba(224, 65, 63, 0.3);
  color: #9c2422;
  font-size: 12px;
  font-weight: 800;
}

.banner__retry:active {
  background: #fff5f4;
}
</style>
