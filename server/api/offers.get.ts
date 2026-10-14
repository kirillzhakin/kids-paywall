import type { OffersResponse } from '../../shared/types/paywall'
import { defaultOfferId, offers, unlocks } from '../data/offers'
import { delay } from '../utils/paywall'

/**
 * GET /api/offers
 *
 * Returns the tariff catalogue for the paywall. Prices are test values.
 * A short delay keeps the loading state observable when the screen opens
 * inside a webview.
 */
export default defineEventHandler(async (event): Promise<OffersResponse> => {
  await delay(280)

  setHeader(event, 'cache-control', 'no-store')

  return {
    offers: [...offers].sort((a, b) => a.sortOrder - b.sortOrder),
    unlocks,
    defaultOfferId,
    currency: 'RUB',
    fetchedAt: new Date().toISOString(),
  }
})
