<script setup lang="ts">
/**
 * Device frame for the webview. On phones the screen fills the viewport;
 * on desktop previews it is centred at a phone width so the design can be
 * judged 1:1 against the Figma frame.
 */
const { phase } = usePaywall()
</script>

<template>
  <div class="stage">
    <div class="stage__screen screen" :data-phase="phase">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 0;
}

.stage__screen {
  position: relative;
  width: 100%;
  max-width: 430px;
  height: 100dvh;
  max-height: 100dvh;
  background: var(--c-surface);
  overflow: hidden;
}

@media (min-width: 480px) {
  .stage {
    padding: 24px 16px;
  }

  .stage__screen {
    height: min(844px, calc(100dvh - 48px));
    max-height: 844px;
    border-radius: 34px;
    box-shadow: 0 24px 60px rgba(30, 26, 46, 0.18);
    border: 1px solid rgba(30, 26, 46, 0.06);
  }
}
</style>
