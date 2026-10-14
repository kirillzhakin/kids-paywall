import type { RestoreResponse } from '../../shared/types/paywall'
import { delay, entitlementFrom, readDeviceId, tooSoon } from '../utils/paywall'
import { usePurchasesStore } from '../utils/purchases'

interface RestoreBody {
  deviceId?: string
}

/**
 * POST /api/restore
 *
 * "Восстановить покупки": looks the device up in the database and returns
 * whatever entitlement was stored earlier.
 */
export default defineEventHandler(async (event): Promise<RestoreResponse> => {
  const body = await readBody<RestoreBody>(event).catch(() => ({}) as RestoreBody)
  const deviceId = readDeviceId(body?.deviceId)

  if (tooSoon(`restore:${deviceId}`, 500)) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      message: 'Проверяем покупки, секунду…',
    })
  }

  const store = await usePurchasesStore()
  await delay(450)

  const purchases = await store.listByDevice(deviceId, 20)

  return {
    ok: true,
    entitlement: entitlementFrom(purchases),
    purchases,
  }
})
