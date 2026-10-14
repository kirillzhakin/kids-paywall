/**
 * Checks a deployed paywall: renders it in real Chrome at mobile widths and
 * compares the measured layout with the local golden metrics.
 *
 *   node scripts/check-deploy.mjs https://kids-paywall-one.vercel.app
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const base = (process.argv[2] || '').replace(/\/$/, '')
if (!base) throw new Error('Pass the deployment URL, e.g. node scripts/check-deploy.mjs https://app.vercel.app')

const OUT = resolve(process.cwd(), 'design/screenshots/deployed')
await mkdir(OUT, { recursive: true })

const golden = JSON.parse(
  await readFile(resolve(process.cwd(), 'design/screenshots/metrics.json'), 'utf8'),
)

const MEASURE = () => {
  const box = (selector) => {
    const el = document.querySelector(selector)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const round = (n) => Math.round(n * 100) / 100
    return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) }
  }
  return {
    topbar: box('.topbar'),
    title: box('.hero__title'),
    cardFirst: box('.offers__list .card'),
    cards: [...document.querySelectorAll('.offers__list .card')].map((el) => Math.round(el.getBoundingClientRect().height * 100) / 100),
    ctaButton: box('.cta__button'),
    restoreLink: box('.cta__link'),
    titleFont: getComputedStyle(document.querySelector('.hero__title')).fontFamily.split(',')[0],
    fontsLoaded: document.fonts?.status,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 0.5,
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const report = { base, widths: {}, api: {} }

for (const width of [360, 390, 430]) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
  })
  const page = await context.newPage()
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForSelector('.offers__list .card')
  await page.waitForFunction(() => document.fonts?.status === 'loaded')
  await page.waitForTimeout(400)

  report.widths[width] = await page.evaluate(MEASURE)
  await page.screenshot({ path: `${OUT}/deployed-${width}.png` })

  if (width === 390) {
    // buying flow on the deployed build
    await page.locator('.cta__button').click()
    await page.waitForSelector('.success__title', { timeout: 25000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/deployed-390-success.png` })
    report.purchaseOk = true

    await page.getByRole('button', { name: 'Продолжить игру' }).click()
    await page.waitForSelector('.offers__list .card')
    await page.getByRole('button', { name: 'Мои покупки' }).click()
    await page.waitForTimeout(1200)
    const rows = await page.locator('.sheet__item').count()
    report.sheetRows = rows
    await page.screenshot({ path: `${OUT}/deployed-390-sheet.png` })

    // restore link
    await page.locator('.sheet__backdrop').click()
    await page.waitForTimeout(350)
    await page.getByRole('button', { name: /Восстановить покупки/ }).click()
    await page.waitForSelector('.toast', { timeout: 15000 })
    report.restoreToast = (await page.locator('.toast').innerText()).trim()
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/deployed-390-restore.png` })
  }

  await context.close()
}

await browser.close()

// ---- compare with the local golden metrics -------------------------------
const local390 = golden.widths['390']
const live390 = report.widths[390]
const deltas = {}
for (const key of ['topbar', 'title', 'cardFirst', 'ctaButton', 'restoreLink']) {
  const local = local390[key]
  const live = live390[key]
  if (!local || !live) continue
  deltas[key] = {
    x: Math.round((live.x - local.x) * 100) / 100,
    y: Math.round((live.y - local.y) * 100) / 100,
    w: Math.round((live.w - local.w) * 100) / 100,
    h: Math.round((live.h - local.h) * 100) / 100,
  }
}
report.deltas390 = deltas

await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2), 'utf8')

console.log(`\nURL: ${base}`)
console.log(`шрифт            : ${live390.titleFont} (${live390.fontsLoaded})`)
console.log(`гориз. оверфлоу  : ${[360, 390, 430].map(w => `${w}:${report.widths[w].horizontalOverflow}`).join(' ')}`)
console.log(`карточки 390     : ${JSON.stringify(live390.cards)} (локально ${JSON.stringify(local390.cards)})`)
console.log(`CTA 390          : ${JSON.stringify(live390.ctaButton)} (локально ${JSON.stringify(local390.ctaButton)})`)
console.log(`покупка на проде : ${report.purchaseOk ? 'да' : 'нет'}`)
console.log(`строк в листе    : ${report.sheetRows}`)
console.log(`тост restore     : ${report.restoreToast}`)
console.log('\nрасхождение с локальными метриками (px):')
for (const [key, value] of Object.entries(deltas)) {
  console.log(`  ${key.padEnd(12)} x:${String(value.x).padStart(6)} y:${String(value.y).padStart(6)} w:${String(value.w).padStart(6)} h:${String(value.h).padStart(6)}`)
}
console.log(`\nскриншоты: ${OUT}`)
