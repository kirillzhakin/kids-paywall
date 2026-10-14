<script setup lang="ts">
/**
 * Paywall screen — "Чудо-Остров" (fictional kids game).
 *
 * Reference frame: 390 x 844 (iPhone 14 / webview), mobile-first,
 * verified at 360 / 375 / 390 / 430 px.
 */
import type { PurchasesResponse } from '../../shared/types/paywall'

const {
  offers,
  unlocks,
  selectedOfferId,
  selectedOffer,
  entitlement,
  phase,
  isLoadingOffers,
  isPurchasing,
  isRestoring,
  errorMessage,
  purchaseError,
  successDetails,
  select,
  loadOffers,
  purchase,
  restore,
  closeSuccess,
} = usePaywall()

// "Восстановить покупки" is a compact text link -> opens the purchases sheet.
const sheetOpen = ref(false)
const history = ref<PurchaseRecord[]>([])
const historyLoading = ref(false)

async function openHistory() {
  sheetOpen.value = true
  historyLoading.value = true
  try {
    const data = await $fetch<PurchasesResponse>('/api/purchases', {
      query: { deviceId: getDeviceId() },
    })
    history.value = data.purchases
  } catch {
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

async function onRestore() {
  await restore()
  if (sheetOpen.value) await openHistory()
}
</script>

<template>
  <PaywallStage>
    <div class="paywall">
      <PaywallTopBar @close="sheetOpen = false" />

      <main class="paywall__scroll">
        <!-- success state replaces the whole scrollable body -->
        <PaywallSuccess
          v-if="phase === 'success' && successDetails"
          :details="successDetails"
          @continue="closeSuccess"
        />

        <template v-else>
          <PaywallHero />

          <PaywallFeatures v-if="unlocks.length && phase !== 'error'" :items="unlocks" />

          <section class="offers" aria-labelledby="offers-title">
            <div class="offers__head">
              <h2 id="offers-title" class="offers__title">Выберите тариф</h2>
              <span class="offers__hint">Отмена в любой момент</span>
            </div>

            <PaywallErrorBanner
              v-if="phase === 'error'"
              :message="errorMessage || 'Не удалось загрузить тарифы'"
              @retry="loadOffers()"
            />

            <div v-if="isLoadingOffers" class="offers__list">
              <PaywallOfferSkeleton v-for="n in 2" :key="n" />
            </div>

            <div v-else class="offers__list" role="radiogroup" aria-label="Тарифы">
              <PaywallOfferCard
                v-for="offer in offers"
                :key="offer.id"
                :offer="offer"
                :active="offer.id === selectedOfferId"
                :disabled="isPurchasing"
                @select="select(offer.id)"
              />
            </div>

            <p v-if="entitlement?.active && phase !== 'success'" class="offers__owned">
              <span aria-hidden="true">✅</span>
              Полный доступ уже открыт на этом устройстве
              <template v-if="entitlement.planTitle"> — {{ entitlement.planTitle }}</template>
            </p>
          </section>
        </template>
      </main>

      <PaywallCta
        v-if="phase !== 'success'"
        :title="selectedOffer?.ctaTitle || 'Открыть полный доступ'"
        :subtitle="selectedOffer?.ctaSubtitle"
        :loading="isPurchasing"
        :disabled="isLoadingOffers || !selectedOffer || phase === 'error'"
        :restoring="isRestoring"
        :purchased="Boolean(entitlement?.active)"
        :error="purchaseError"
        @purchase="purchase()"
        @restore="onRestore"
        @show-history="openHistory"
      />
    </div>

    <PaywallPurchasesSheet
      v-model:open="sheetOpen"
      :items="history"
      :loading="historyLoading"
    />

    <PaywallToast />
  </PaywallStage>

  <PaywallQaPanel />
</template>

<style scoped>
.paywall {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background:
    radial-gradient(120% 46% at 50% 0%, #efe7ff 0%, rgba(239, 231, 255, 0) 62%),
    linear-gradient(180deg, #f7f4ff 0%, #fdfbff 42%, #ffffff 100%);
  color: var(--c-ink);
}

.paywall__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 4px var(--pad) 18px;
}

.offers {
  margin-top: 20px;
}

.offers__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 11px;
}

.offers__title {
  margin: 0;
  font-size: 17px;
  font-weight: 900;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.offers__hint {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-muted);
  text-align: right;
  white-space: nowrap;
}

.offers__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.offers__owned {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 12px 2px 0;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c-green-700);
}
</style>
