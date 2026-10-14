/**
 * End-to-end test of the server routes against the real Nitro server.
 *
 * Boots `nuxt dev`, exercises every API route and asserts the purchases really
 * land in the database. Covers the happy path plus the documented error paths.
 *
 *   node scripts/test-api.mjs
 */
import assert from 'node:assert/strict'
import { startServer } from './dev-server.mjs'

const { baseUrl, stop } = await startServer({ port: 3211, cwd: process.cwd(), log: false })

const api = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

const deviceId = `dev_e2e_${Date.now().toString(36)}`
const results = []

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail })
  if (!condition) throw new Error(`FAILED: ${name} ${detail}`)
}

try {
  /* ---------------- GET /api/offers ---------------- */
  const offers = await api('/api/offers')
  check('GET /api/offers → 200', offers.status === 200, `status ${offers.status}`)
  check('два тарифа', offers.body.offers.length === 2, `got ${offers.body.offers.length}`)
  check(
    'годовой тариф первый и выбран по умолчанию',
    offers.body.offers[0].id === 'yearly' && offers.body.defaultOfferId === 'yearly',
  )
  check(
    'цены отформатированы для UI',
    offers.body.offers[0].priceLabel === '1 790 ₽' && offers.body.offers[1].priceLabel === '399 ₽',
    `${offers.body.offers[0].priceLabel} / ${offers.body.offers[1].priceLabel}`,
  )
  check('скидка посчитана', offers.body.offers[0].discountPercent === 63, `${offers.body.offers[0].discountPercent}%`)
  check('список выгод отдан сервером', offers.body.unlocks.length === 4)

  /* ---------------- GET /api/purchases (empty) ---------------- */
  const before = await api(`/api/purchases?deviceId=${deviceId}`)
  check('GET /api/purchases для нового устройства пуст', before.body.purchases.length === 0)

  /* ---------------- POST /api/purchase ---------------- */
  const purchase = await api('/api/purchase', {
    method: 'POST',
    body: JSON.stringify({ offerId: 'yearly', deviceId }),
  })
  check('POST /api/purchase → 200', purchase.status === 200, `status ${purchase.status}`)
  check('запись создана', Boolean(purchase.body.purchase?.id))
  check('сумма в копейках', purchase.body.purchase.amountMinor === 179000)
  check('entitlement активен', purchase.body.entitlement.active === true)
  check('createdAt — валидная дата', !Number.isNaN(Date.parse(purchase.body.purchase.createdAt)))

  /* ---------------- GET /api/purchases (after) ---------------- */
  const after = await api(`/api/purchases?deviceId=${deviceId}`)
  check('покупка читается из БД', after.body.purchases.length === 1)
  check('deviceId сохранён', after.body.purchases[0].deviceId === deviceId)
  check('offerId сохранён', after.body.purchases[0].offerId === 'yearly')

  /* ---------------- POST /api/restore ---------------- */
  await new Promise(resolve => setTimeout(resolve, 600))
  const restore = await api('/api/restore', {
    method: 'POST',
    body: JSON.stringify({ deviceId }),
  })
  check('POST /api/restore → 200', restore.status === 200)
  check('восстановление находит покупку', restore.body.entitlement.active === true)

  const emptyRestore = await api('/api/restore', {
    method: 'POST',
    body: JSON.stringify({ deviceId: `dev_empty_${Date.now().toString(36)}` }),
  })
  check('восстановление на чужом устройстве пусто', emptyRestore.body.entitlement.active === false)

  /* ---------------- error paths ---------------- */
  const badOffer = await api('/api/purchase', {
    method: 'POST',
    body: JSON.stringify({ offerId: 'does-not-exist', deviceId }),
  })
  check('неизвестный тариф → 400', badOffer.status === 400, `status ${badOffer.status}`)
  check('ошибка переведена на русский', /тариф/i.test(badOffer.body.message ?? ''))

  const noBody = await api('/api/purchase', { method: 'POST', body: '{}' })
  check('пустое тело → 400', noBody.status === 400, `status ${noBody.status}`)

  /* ---------------- GET /api/health ---------------- */
  const health = await api('/api/health')
  check('GET /api/health → 200', health.status === 200)
  check(
    'драйвер БД определён',
    ['sqlite', 'postgres', 'memory'].includes(health.body.driver),
    health.body.driver,
  )

  /* ---------------- SSR page ---------------- */
  const page = await fetch(baseUrl)
  const html = await page.text()
  check('страница рендерится на сервере', page.status === 200)
  check('заголовок в SSR-разметке', html.includes('Открой все 120 уровней'))
  check('подключены server routes', html.includes('Выберите тариф'))

  console.log('\nAPI E2E — все проверки пройдены:')
  for (const item of results) console.log(`  ✓ ${item.name}${item.detail ? ` (${item.detail})` : ''}`)
  console.log(`\nБД: ${health.body.driver} → ${health.body.location}`)
  console.log(`deviceId в тесте: ${deviceId}`)
} finally {
  stop()
}
