<script setup lang="ts">
/**
 * Hero: progress proof + value proposition.
 * Title scales with the viewport so it stays on one line at 430 px and wraps
 * gracefully at 360 px.
 */
</script>

<template>
  <section class="hero">
    <div class="hero__badge">
      <span class="hero__badge-emoji" aria-hidden="true">🚀</span>
      <span class="hero__badge-text">
        <strong>Уровень 3 из 120</strong>
        <span>Пробные уровни закончились</span>
      </span>
    </div>

    <h1 class="hero__title">Открой все 120 уровней</h1>
    <p class="hero__subtitle">
      Полный доступ открывает все острова, боссов и ежедневные задания.
    </p>
  </section>
</template>

<style scoped>
.hero {
  padding-top: 10px;
}

.hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 13px 6px 8px;
  border-radius: var(--r-pill);
  background: var(--c-surface);
  border: 1px solid var(--c-line);
  box-shadow: var(--sh-card);
}

.hero__badge-emoji {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--r-pill);
  background: var(--c-brand-soft);
  font-size: 14px;
  line-height: 1;
}

.hero__badge-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.hero__badge-text strong {
  font-size: 12px;
  font-weight: 800;
}

.hero__badge-text span {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--c-muted);
}

.hero__title {
  margin-top: 14px;
  font-size: clamp(22px, 6.6vw, 27px);
  line-height: 1.14;
  font-weight: 900;
  letter-spacing: -0.025em;
  color: var(--c-ink);
  text-wrap: balance;
}

.hero__subtitle {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.42;
  font-weight: 600;
  color: var(--c-ink-soft);
}
</style>
