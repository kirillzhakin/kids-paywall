import type { PurchaseRecord } from '../../shared/types/paywall'

/**
 * Purchase persistence.
 *
 * Two interchangeable adapters behind one tiny interface:
 *
 *  - SQLite  (better-sqlite3)  → local development, `pnpm dev`, no cloud needed.
 *  - Postgres (Neon serverless) → production on Vercel, where the filesystem is
 *    ephemeral and a real persistent store is required. Uses the HTTP driver,
 *    which works from serverless functions without TCP pooling.
 *
 * Selection is automatic: set `NUXT_DATABASE_URL` (Nitro maps it onto
 * `runtimeConfig.databaseUrl`; a plain `DATABASE_URL` also works as a fallback)
 * and Neon is used, otherwise the local SQLite file is created on demand.
 */

export interface NewPurchase {
  id: string
  deviceId: string
  offerId: string
  planTitle: string
  amountMinor: number
  currency: string
  provider: string
}

export interface PurchasesStore {
  readonly driver: 'sqlite' | 'postgres' | 'memory'
  readonly location: string
  listByDevice(deviceId: string, limit: number): Promise<PurchaseRecord[]>
  insert(row: NewPurchase): Promise<PurchaseRecord>
  findLatestByDevice(deviceId: string): Promise<PurchaseRecord | null>
}

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

export const newId = (): string =>
  `pur_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/** SQLite stores ISO strings, Postgres may hand back Date objects. */
const toIso = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return new Date(value).toISOString()
  return new Date(String(value)).toISOString()
}

const toMinor = (value: unknown): number => {
  if (typeof value === 'number') return value
  return Number.parseInt(String(value), 10)
}

const CREATE_TABLE_SQLITE = `
  CREATE TABLE IF NOT EXISTS purchases (
    id           TEXT PRIMARY KEY,
    device_id    TEXT NOT NULL,
    offer_id     TEXT NOT NULL,
    plan_title   TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'succeeded',
    provider     TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_purchases_device_created
    ON purchases (device_id, created_at DESC);
`

const CREATE_TABLE_POSTGRES = `
  CREATE TABLE IF NOT EXISTS purchases (
    id           TEXT PRIMARY KEY,
    device_id    TEXT NOT NULL,
    offer_id     TEXT NOT NULL,
    plan_title   TEXT NOT NULL,
    amount_minor BIGINT NOT NULL,
    currency     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'succeeded',
    provider     TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`

const CREATE_INDEX_POSTGRES = `
  CREATE INDEX IF NOT EXISTS idx_purchases_device_created
    ON purchases (device_id, created_at DESC)
`

/**
 * Ask Postgres for an ISO-8601 UTC string instead of letting the HTTP driver
 * pick a text representation for timestamptz.
 *
 * Written as full statements (no `sql.unsafe`) so every value stays a bound
 * parameter and the Neon driver receives plain `{ query, params }` payloads.
 */
const PG_SELECT_COLUMNS = `id, device_id, offer_id, plan_title, amount_minor, currency, status, provider,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at`

/* ------------------------------------------------------------------ */
/* SQLite adapter (local dev)                                          */
/* ------------------------------------------------------------------ */

interface SqliteRow {
  id: string
  device_id: string
  offer_id: string
  plan_title: string
  amount_minor: number
  currency: string
  status: string
  provider: string
  created_at: string
}

const rowToPurchase = (row: SqliteRow | Record<string, unknown>): PurchaseRecord => {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id),
    deviceId: String(r.device_id),
    offerId: String(r.offer_id),
    planTitle: String(r.plan_title),
    amountMinor: toMinor(r.amount_minor),
    currency: String(r.currency),
    status: 'succeeded',
    provider: String(r.provider),
    createdAt: toIso(r.created_at),
  }
}

async function createSqliteStore(file: string): Promise<PurchasesStore> {
  const { default: Database } = await import('better-sqlite3')
  const { mkdirSync } = await import('node:fs')
  const { dirname, resolve } = await import('node:path')

  const absolute = resolve(process.cwd(), file)
  mkdirSync(dirname(absolute), { recursive: true })

  const db = new Database(absolute)
  db.pragma('journal_mode = WAL')
  db.exec(CREATE_TABLE_SQLITE)

  const insertStmt = db.prepare(`
    INSERT INTO purchases
      (id, device_id, offer_id, plan_title, amount_minor, currency, status, provider, created_at)
    VALUES
      (@id, @deviceId, @offerId, @planTitle, @amountMinor, @currency, 'succeeded', @provider, @createdAt)
  `)
  const listStmt = db.prepare(`
    SELECT * FROM purchases
    WHERE device_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `)
  const latestStmt = db.prepare(`
    SELECT * FROM purchases
    WHERE device_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `)

  return {
    driver: 'sqlite',
    location: absolute,
    async listByDevice(deviceId, limit) {
      return (listStmt.all(deviceId, limit) as SqliteRow[]).map(rowToPurchase)
    },
    async insert(row) {
      const createdAt = new Date().toISOString()
      insertStmt.run({ ...row, createdAt })
      return { ...row, status: 'succeeded', createdAt }
    },
    async findLatestByDevice(deviceId) {
      const row = latestStmt.get(deviceId) as SqliteRow | undefined
      return row ? rowToPurchase(row) : null
    },
  }
}

/* ------------------------------------------------------------------ */
/* Neon Postgres adapter (production)                                  */
/* ------------------------------------------------------------------ */

async function createPostgresStore(connectionString: string): Promise<PurchasesStore> {
  const { neon } = await import('@neondatabase/serverless')
  const sql = neon(connectionString)

  await sql.query(CREATE_TABLE_POSTGRES)
  await sql.query(CREATE_INDEX_POSTGRES)

  return {
    driver: 'postgres',
    location: 'neon:postgres',
    async listByDevice(deviceId, limit) {
      const rows = await sql.query(
        `SELECT ${PG_SELECT_COLUMNS}
         FROM purchases
         WHERE device_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [deviceId, limit],
      )
      return rows.map(rowToPurchase)
    },
    async insert(row) {
      const rows = await sql.query(
        `INSERT INTO purchases
           (id, device_id, offer_id, plan_title, amount_minor, currency, status, provider)
         VALUES ($1, $2, $3, $4, $5, $6, 'succeeded', $7)
         RETURNING ${PG_SELECT_COLUMNS}`,
        [
          row.id,
          row.deviceId,
          row.offerId,
          row.planTitle,
          row.amountMinor,
          row.currency,
          row.provider,
        ],
      )
      return rowToPurchase(rows[0] as Record<string, unknown>)
    },
    async findLatestByDevice(deviceId) {
      const rows = await sql.query(
        `SELECT ${PG_SELECT_COLUMNS}
         FROM purchases
         WHERE device_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [deviceId],
      )
      return rows.length ? rowToPurchase(rows[0] as Record<string, unknown>) : null
    },
  }
}

/* ------------------------------------------------------------------ */
/* memory adapter (last-resort fallback)                               */
/* ------------------------------------------------------------------ */

/**
 * Used when neither Postgres nor SQLite is available — for example a
 * serverless deploy without DATABASE_URL. Keeps the server routes working and
 * fails loudly in /api/health instead of returning a 500 to the webview.
 */
function createMemoryStore(): PurchasesStore {
  const rows: PurchaseRecord[] = []

  return {
    driver: 'memory',
    location: 'in-process (not persistent — set DATABASE_URL)',
    async listByDevice(deviceId, limit) {
      return rows
        .filter(row => row.deviceId === deviceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
    },
    async insert(row) {
      const record: PurchaseRecord = {
        ...row,
        status: 'succeeded',
        createdAt: new Date().toISOString(),
      }
      rows.unshift(record)
      return record
    },
    async findLatestByDevice(deviceId) {
      return rows.find(row => row.deviceId === deviceId) ?? null
    },
  }
}

/* ------------------------------------------------------------------ */
/* factory                                                             */
/* ------------------------------------------------------------------ */

let storePromise: Promise<PurchasesStore> | null = null

export function usePurchasesStore(): Promise<PurchasesStore> {
  if (!storePromise) {
    const config = useRuntimeConfig()
    const connectionString = String(config.databaseUrl || process.env.DATABASE_URL || '').trim()

    storePromise = connectionString
      ? createPostgresStore(connectionString)
      : createSqliteStore(String(config.sqlitePath || '.data/paywall.sqlite')).catch((error) => {
          console.warn(
            '[paywall] SQLite unavailable, falling back to in-memory storage:',
            (error as Error).message,
          )
          return createMemoryStore()
        })

    // Never cache a failed initialisation (e.g. Postgres temporarily down).
    storePromise.catch(() => {
      storePromise = null
    })
  }
  return storePromise
}
