/**
 * Stable per-device identifier for the test purchase flow.
 *
 * In a real webview this would arrive from the host app / store receipt;
 * here it is generated once and kept in localStorage so that
 * "Восстановить покупки" has something to look up.
 */
const STORAGE_KEY = 'chudo-ostrov.device-id'

let cached: string | null = null

function createId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14)
  return `dev_${random}`
}

export function getDeviceId(): string {
  if (cached) return cached
  if (import.meta.server) return 'server-device'

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing) {
      cached = existing
      return existing
    }
    const created = createId()
    window.localStorage.setItem(STORAGE_KEY, created)
    cached = created
    return created
  } catch {
    // Private mode / storage disabled: keep an in-memory id for this session.
    cached = createId()
    return cached
  }
}

/** Test helper: wipes the device id so the flow can be replayed from scratch. */
export function resetDeviceId(): void {
  cached = null
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
