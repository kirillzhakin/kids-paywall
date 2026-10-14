import type { PurchaseResponse } from '../../shared/types/paywall'
import { findOffer } from '../data/offers'
import { delay, entitlementFrom, readDeviceId, tooSoon } from '../utils/paywall'
import { newId, usePurchasesStore } from '../utils/purchases'

interface PurchaseBody {
  offerId?: string
  deviceId?: string
}

/**
 * POST /api/purchase
 *
 * Test "payment": validates the selected tariff, writes the purchase row
 * (SQLite locally, Neon Postgres in production) and returns the entitlement.
 *
 * No real payment SDK, no real money, no secrets — see README.
 */
export default defineEventHandler(async (event): Promise<PurchaseResponse> => {
  const body = await readBody<PurchaseBody>(event).catch(() => ({}) as PurchaseBody)
  const offerId = String(body?.offerId ?? '')
  const deviceId = readDeviceId(body?.deviceId)

  const offer = findOffer(offerId)
  if (!offer || !offer.active) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Unknown offer',
      message: 'Такого тарифа нет. Обновите экран и попробуйте снова.',
    })
  }

  // Guards against double-taps inside the webview.
  if (tooSoon(`purchase:${deviceId}`)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      message: 'Покупка уже обрабатывается. Подождите секунду.',
    })
  }

  const store = await usePurchasesStore()

  // Simulated provider round-trip.
  await delay(650)

  const purchase = await store.insert({
    id: newId(),
    deviceId,
    offerId: offer.id,
    planTitle: `${offer.title} · ${offer.periodLabel}`,
    amountMinor: offer.priceMinor,
    currency: offer.currency,
    provider: 'test-provider',
  })

  return {
    ok: true,
    purchase,
    entitlement: entitlementFrom([purchase]),
  }
})
