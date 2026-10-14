/**
 * Renders the paywall in real Chrome at mobile widths, saves PNGs to
 * design/screenshots and writes a metrics report used to verify the
 * implementation against the Figma frame (390 x 844).
 *
 *   node scripts/screenshots.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { sleep, startServer } from './dev-server.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 3210
const OUT = resolve(process.cwd(), 'design/screenshots')

const WIDTHS = [360, 375, 390, 430]

const METRICS_SCRIPT = () => {
  const box = (selector) => {
    const el = document.querySelector(selector)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const round = (n) => Math.round(n * 100) / 100
    return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) }
  }
  const styles = (selector) => {
    const el = document.querySelector(selector)
    if (!el) return null
    const s = getComputedStyle(el)
    return {
      font: `${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${s.fontFamily.split(',')[0]}`,
      color: s.color,
      background: s.backgroundColor,
      radius: s.borderRadius,
      padding: s.padding,
      border: `${s.borderTopWidth} ${s.borderTopColor}`,
    }
  }
  const cta = document.querySelector('.cta__button')
  const ctaBox = cta ? cta.getBoundingClientRect() : null

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    screen: box('.stage__screen'),
    topbar: box('.topbar'),
    title: box('.hero__title'),
    subtitle: box('.hero__subtitle'),
    unlocks: box('.unlocks'),
    offersHead: box('.offers__head'),
    cardFirst: box('.offers__list .card'),
    cards: [...document.querySelectorAll('.offers__list .card')].map((el) => {
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 }
    }),
    ctaBar: box('.cta'),
    ctaButton: ctaBox
      ? {
          x: Math.round(ctaBox.x * 100) / 100,
          y: Math.round(ctaBox.y * 100) / 100,
          w: Math.round(ctaBox.width * 100) / 100,
          h: Math.round(ctaBox.height * 100) / 100,
        }
      : null,
    restoreLink: box('.cta__link'),
    legal: box('.cta__legal'),
    type: {
      title: styles('.hero__title'),
      subtitle: styles('.hero__subtitle'),
      cardTitle: styles('.card__title'),
      cardAmount: styles('.card__amount'),
      cta: styles('.cta__button-label'),
    },
    fontsLoaded: document.fonts ? document.fonts.status : 'unknown',
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 0.5,
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const { baseUrl, stop } = await startServer({ port: PORT, cwd: process.cwd() })
  const browser = await chromium.launch({ executablePath: CHROME, headless: true })

  const report = { baseUrl, generatedAt: new Date().toISOString(), widths: {} }

  try {
    for (const width of WIDTHS) {
      const context = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        locale: 'ru-RU',
        timezoneId: 'Europe/Moscow',
      })
      const page = await context.newPage()

      // ---- default state -------------------------------------------------
      await page.goto(baseUrl, { waitUntil: 'networkidle' })
      await page.waitForSelector('.offers__list .card')
      await page.waitForFunction(() => document.fonts?.status === 'loaded')
      await sleep(450)

      const tag = `${width}`
      const scroll = page.locator('.paywall__scroll')

      if (width === 390) await page.screenshot({ path: `${OUT}/01-paywall-${tag}-full.png` })
      await scroll.screenshot({ path: `${OUT}/02-paywall-${tag}-content.png` })
      report.widths[tag] = await page.evaluate(METRICS_SCRIPT)

      if (width === 390) {
        await page.locator('.cta').screenshot({ path: `${OUT}/03-cta-${tag}.png` })

        // ---- loading state ---------------------------------------------
        await page.goto(`${baseUrl}/?demo=slow`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.skeleton')
        await sleep(500)
        await page.screenshot({ path: `${OUT}/04-loading-${tag}.png` })

        // ---- error state -----------------------------------------------
        await page.goto(`${baseUrl}/?demo=error`, { waitUntil: 'domcontentloaded' })
        await page.waitForSelector('.banner')
        await sleep(400)
        await page.screenshot({ path: `${OUT}/05-error-${tag}.png` })

        // ---- purchase -> success ---------------------------------------
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.waitForSelector('.offers__list .card')
        await page.locator('.cta__button').click()
        await page.waitForSelector('.success__title', { timeout: 20000 })
        await sleep(600)
        await page.screenshot({ path: `${OUT}/06-success-${tag}.png` })

        // ---- purchases sheet (now backed by a real row) -----------------
        await page.getByRole('button', { name: 'Продолжить игру' }).click()
        await page.waitForSelector('.offers__list .card')
        await page.getByRole('button', { name: 'Мои покупки' }).click()
        await page.waitForSelector('.sheet__item', { timeout: 15000 })
        await sleep(500)
        await page.screenshot({ path: `${OUT}/07-sheet-${tag}.png` })

        // ---- restore toast ---------------------------------------------
        await page.locator('.sheet__backdrop').click()
        await sleep(350)
        await page.getByRole('button', { name: /Восстановить покупки/ }).click()
        await page.waitForSelector('.toast')
        await sleep(350)
        await page.screenshot({ path: `${OUT}/08-restore-${tag}.png` })

        // ---- in-flight purchase (spinner) ------------------------------
        // Fresh device: the previous purchase already unlocked the CTA.
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.evaluate(() => window.localStorage.clear())
        await page.reload({ waitUntil: 'networkidle' })
        await page.waitForSelector('.offers__list .card')
        await page.route('**/api/purchase', async (route) => {
          await sleep(4000)
          await route.continue()
        })
        await page.locator('.cta__button').click({ timeout: 10000 })
        await sleep(700)
        await page.screenshot({ path: `${OUT}/09-purchasing-${tag}.png` })
        await page.unroute('**/api/purchase')
      }

      await context.close()
    }

    await writeFile(`${OUT}/metrics.json`, JSON.stringify(report, null, 2), 'utf8')
    console.log(`\nSaved screenshots to ${OUT}`)
    console.log(JSON.stringify(report.widths['390'], null, 2))
  } finally {
    await browser.close()
    stop()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
