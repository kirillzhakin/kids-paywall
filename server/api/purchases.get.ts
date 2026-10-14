import type { PurchasesResponse } from '../../shared/types/paywall'
import { readDeviceId } from '../utils/paywall'
import { usePurchasesStore } from '../utils/purchases'

/**
 * GET /api/purchases?deviceId=...
 *
 * Read-back endpoint: proves the rows really landed in the database.
 * Powers the "Мои покупки" sheet on the paywall.
 */
export default defineEventHandler(async (event): Promise<PurchasesResponse> => {
  const query = getQuery(event)
  const deviceId = readDeviceId(query.deviceId)

  const store = await usePurchasesStore()
  const purchases = await store.listByDevice(deviceId, 20)

  return { purchases }
})
