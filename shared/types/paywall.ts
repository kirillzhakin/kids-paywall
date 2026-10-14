/**
 * Shared API contract between the paywall UI and the server routes.
 * Lives in `shared/` so both the Nitro server and the Vue app import one type.
 */

export interface Offer {
  id: string
  plan: 'monthly' | 'yearly'
  /** Short plan name shown on the card, e.g. «Год». */
  name: string
  /** Card heading, e.g. «Полный доступ». */
  title: string
  /** One-line billing explanation. */
  description: string
  /** Price in minor units (kopecks). Test money only. */
  priceMinor: number
  /** ISO-4217 code, rendered by the API as `priceLabel`. */
  currency: 'RUB'
  /** Billing period label, e.g. «раз в год». */
  periodLabel: string
  /** Ready-to-render price, e.g. «1 790 ₽». */
  priceLabel: string
  /** Ready-to-render "was" price for the crossed-out value, when discounted. */
  comparePriceLabel: string | null
  discountPercent: number
  /** Ribbon on the card, e.g. «Выгодно −62%». */
  badge: string | null
  /** Short perks list rendered inside the card. */
  highlights: string[]
  ctaTitle: string
  ctaSubtitle: string
  /** Price shown next to the CTA button, e.g. «за 1 790 ₽ / год». */
  ctaPriceLabel: string
  active: boolean
  sortOrder: number
}

export interface OffersResponse {
  offers: Offer[]
  /** What full access unlocks — rendered as a list under the cards. */
  unlocks: string[]
  /** Default selection computed server-side (recommended plan first). */
  defaultOfferId: string
  currency: 'RUB'
  fetchedAt: string
}

export interface PurchaseRecord {
  id: string
  deviceId: string
  offerId: string
  planTitle: string
  amountMinor: number
  currency: string
  status: 'succeeded'
  provider: string
  createdAt: string
}

export interface Entitlement {
  active: boolean
  offerId: string | null
  planTitle: string | null
  purchasedAt: string | null
}

export interface PurchaseResponse {
  ok: true
  purchase: PurchaseRecord
  entitlement: Entitlement
}

export interface RestoreResponse {
  ok: true
  entitlement: Entitlement
  purchases: PurchaseRecord[]
}

export interface PurchasesResponse {
  purchases: PurchaseRecord[]
}

export interface ApiError {
  statusCode: number
  statusMessage: string
  message: string
}
