/**
 * Integration test for the Neon Postgres adapter.
 *
 * There is no Postgres in this environment and no Neon account, so the test
 * stubs the driver's HTTP endpoint using the same wire format Neon itself uses:
 *
 *   POST <endpoint>/sql  { queries: [{ query, params }] }  ->  { fields, rows }
 *
 * It proves the adapter takes the Postgres path, issues the expected SQL with
 * bound parameters, and normalises the response into PurchaseRecord rows.
 *
 *   node scripts/test-postgres.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'

const ROOT = process.cwd()
const SQL_PATH = resolve(ROOT, '.data/test-postgres.sql')

globalThis.useRuntimeConfig = () => ({
  databaseUrl: 'postgresql://user:secret@ep-test-1.eu-central-1.aws.neon.tech/neondb?sslmode=require',
  sqlitePath: '.data/should-not-be-used.sqlite',
})

const statementLog = []
const rowStore = []

const FIELDS = [
  ['id', 25],
  ['device_id', 25],
  ['offer_id', 25],
  ['plan_title', 25],
  ['amount_minor', 20],
  ['currency', 25],
  ['status', 25],
  ['provider', 25],
  ['created_at', 25],
]

/** Mimics Postgres returning the ISO string produced by to_char(). */
const NOW_ISO = new Date().toISOString()

function result(fields, rows) {
  return {
    command: 'SELECT',
    fields: fields.map(([name, dataTypeID]) => ({ name, dataTypeID, tableID: 0 })),
    rows,
    rowCount: rows.length,
  }
}

function respond(payload) {
  return {
    ok: true,
    status: 200,
    async json() {
      return payload
    },
    async text() {
      return JSON.stringify(payload)
    },
  }
}

globalThis.fetch = async (url, init) => {
  assert.match(String(url), /\/sql$/, 'the neon driver must POST to the /sql endpoint')

  const body = JSON.parse(init.body)
  // `sql.query(text, params)` sends a single statement; template usage sends a batch.
  const statements = Array.isArray(body.queries)
    ? body.queries
    : [{ query: body.query, params: body.params ?? [] }]
  assert.ok(statements.length > 0, 'the neon HTTP driver must send at least one statement')

  const results = statements.map((statement) => {
    const sql = String(statement.query)
    const params = statement.params ?? []
    statementLog.push({ sql, params })

    if (/CREATE TABLE/i.test(sql) || /CREATE INDEX/i.test(sql)) {
      return { command: 'CREATE', fields: [], rows: [], rowCount: null }
    }

    if (/INSERT INTO purchases/i.test(sql)) {
      assert.match(sql, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, 'succeeded', \$7\)/)
      assert.match(sql, /to_char\(created_at AT TIME ZONE 'UTC'/)
      const [id, deviceId, offerId, planTitle, amountMinor, currency, provider] = params
      const record = {
        id,
        device_id: deviceId,
        offer_id: offerId,
        plan_title: planTitle,
        amount_minor: String(amountMinor), // bigint arrives as text
        currency,
        status: 'succeeded',
        provider,
        created_at: NOW_ISO,
      }
      rowStore.unshift(record)
      return result(FIELDS, [FIELDS.map(([name]) => record[name])])
    }

    if (/FROM purchases/i.test(sql)) {
      const [deviceId, limit] = params
      const rows = rowStore
        .filter(row => row.device_id === deviceId)
        .slice(0, Number(limit ?? 1))
        .map(row => FIELDS.map(([name]) => row[name]))
      return result(FIELDS, rows)
    }

    throw new Error(`Unexpected SQL in the adapter: ${sql.slice(0, 90)}`)
  })

  return respond(Array.isArray(body.queries) ? { results } : results[0])
}

const { build } = await import('esbuild')

const bundlePath = resolve(ROOT, '.data/purchases-adapter.mjs')
await build({
  entryPoints: [resolve(ROOT, 'server/utils/purchases.ts')],
  outfile: bundlePath,
  bundle: true,
  format: 'esm',
  platform: 'node',
  packages: 'external', // keep @neondatabase/serverless external so the real driver runs
  logLevel: 'error',
})

const { usePurchasesStore } = await import(`${bundlePath}?test=${Date.now()}`)

const store = await usePurchasesStore()

assert.equal(store.driver, 'postgres', 'DATABASE_URL must select the Postgres adapter')
assert.equal(store.location, 'neon:postgres')

await mkdir(resolve(ROOT, '.data'), { recursive: true })
await writeFile(
  SQL_PATH,
  statementLog.map(s => `${s.sql}\n-- params: ${JSON.stringify(s.params)}\n`).join('\n'),
  'utf8',
)

const inserted = await store.insert({
  id: 'pur_test_postgres',
  deviceId: 'dev_pg_test',
  offerId: 'yearly',
  planTitle: 'Полный доступ · раз в год',
  amountMinor: 179000,
  currency: 'RUB',
  provider: 'test-provider',
})

assert.equal(inserted.id, 'pur_test_postgres')
assert.equal(inserted.amountMinor, 179000, 'bigint text must be parsed into a number')
assert.equal(inserted.status, 'succeeded')
assert.equal(inserted.planTitle, 'Полный доступ · раз в год')
assert.equal(
  inserted.createdAt,
  new Date(NOW_ISO).toISOString(),
  'createdAt must be normalised to ISO-8601',
)

const list = await store.listByDevice('dev_pg_test', 20)
assert.equal(list.length, 1)
assert.equal(list[0].deviceId, 'dev_pg_test')

const latest = await store.findLatestByDevice('dev_pg_test')
assert.equal(latest?.id, 'pur_test_postgres')

const insertStatement = statementLog.find(s => /INSERT INTO purchases/i.test(s.sql))
assert.ok(insertStatement, 'an INSERT must be issued')
assert.equal(insertStatement.params.length, 7, 'INSERT must bind 7 parameters — no interpolation')

const dataQueries = statementLog.filter(s => !/CREATE/i.test(s.sql))
assert.ok(
  dataQueries.every(s => s.params.length > 0),
  'every data query must use bound parameters',
)
assert.ok(
  dataQueries.every(s => !/pur_test_postgres|dev_pg_test/.test(s.sql)),
  'no value may be interpolated straight into SQL text',
)

console.log(`driver        : ${store.driver} (${store.location})`)
console.log(`statements    : ${statementLog.length} queries → .data/test-postgres.sql`)
console.log(`insert params : ${JSON.stringify(insertStatement.params).slice(0, 110)}…`)
console.log(`row round-trip: ${inserted.planTitle} / ${inserted.amountMinor} / ${inserted.createdAt}`)
console.log('\nPOSTGRES ADAPTER TEST OK')
