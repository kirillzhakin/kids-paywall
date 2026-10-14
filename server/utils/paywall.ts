import type { Entitlement, PurchaseRecord } from '../../shared/types/paywall'

/** Small helper used to keep loading states visible in the webview. */
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms))

/** Normalise a device/user identifier coming from the client. */
export function readDeviceId(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (raw.length >= 6 && raw.length <= 128) return raw
  return 'anonymous-device'
}

/** Latest purchase wins — enough for a one-plan test entitlement. */
export function entitlementFrom(records: PurchaseRecord[]): Entitlement {
  const latest = records[0] ?? null
  if (!latest) {
    return { active: false, offerId: null, planTitle: null, purchasedAt: null }
  }
  return {
    active: true,
    offerId: latest.offerId,
    planTitle: latest.planTitle,
    purchasedAt: latest.createdAt,
  }
}

/** Simple in-process throttle keyed by device, good enough for a test flow. */
const lastCall = new Map<string, number>()

export function tooSoon(key: string, windowMs = 800): boolean {
  const now = Date.now()
  const previous = lastCall.get(key) ?? 0
  lastCall.set(key, now)
  return now - previous < windowMs
}
