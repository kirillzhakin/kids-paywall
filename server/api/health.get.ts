import { usePurchasesStore } from '../utils/purchases'

/**
 * GET /api/health
 *
 * Handy after deployment: reports which storage adapter is really in use,
 * so it is obvious whether the production build talks to Postgres or falls
 * back to the ephemeral SQLite file.
 */
export default defineEventHandler(async () => {
  const store = await usePurchasesStore()
  return {
    ok: true,
    driver: store.driver,
    location: store.location,
    time: new Date().toISOString(),
  }
})
