/**
 * Renders the paywall specification to a standalone SVG.
 *
 * Why SVG: Figma imports SVG (and .fig) through "Import" / drag-and-drop
 * WITHOUT executing a plugin, and SVG text stays editable. That makes this a
 * reliable delivery path even when the Plugin API misbehaves in the sandbox.
 *
 *   node scripts/build-svg.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const OUT_DIR = resolve(ROOT, 'design/svg')

/* ------------------------------------------------------------------ */
/* tokens — identical to app/assets/css/main.css                       */
/* ------------------------------------------------------------------ */

const C = {
  ink: '#1E1A2E',
  inkSoft: '#4A4560',
  muted: '#8B86A3',
  brand: '#6A45FF',
  brand700: '#4A27D6',
  brandSoft: '#EFEAFF',
  brandLine: '#DED4FF',
  line: '#E9E5F5',
  surface: '#FFFFFF',
  surfaceSoft: '#F6F3FF',
  green: '#14C07B',
  greenSoft: '#E4F9EF',
  green700: '#0B8F5B',
  danger: '#E0413F',
  dangerSoft: '#FDECEB',
  gradientTop: '#EFE7FF',
}

/*
 * A single font name on purpose: the SVG importer in Figma does not resolve a
 * comma-separated font stack and silently drops every <text> element, which is
 * exactly what happened on the first import. Roboto is always available in
 * Figma, including Cyrillic.
 */
const FONT = process.env.SVG_FONT || 'Roboto'
const W = 390
const H = 844
const PAD = 20
const CONTENT = W - PAD * 2

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function text(x, y, value, { size, weight = 700, fill = C.ink, anchor = 'start', opacity } = {}) {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${FONT}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
  ]
  if (anchor !== 'start') attrs.push(`text-anchor="${anchor}"`)
  if (opacity !== undefined) attrs.push(`opacity="${opacity}"`)
  return `  <text ${attrs.join(' ')}>${esc(value)}</text>`
}

const rect = (x, y, w, h, { fill, rx = 0, stroke, strokeWidth = 1, opacity } = {}) => {
  const attrs = [`x="${x}"`, `y="${y}"`, `width="${w}"`, `height="${h}"`]
  if (rx) attrs.push(`rx="${rx}"`)
  attrs.push(`fill="${fill || 'none'}"`)
  if (stroke) {
    attrs.push(`stroke="${stroke}"`)
    attrs.push(`stroke-width="${strokeWidth}"`)
  }
  if (opacity !== undefined) attrs.push(`opacity="${opacity}"`)
  return `  <rect ${attrs.join(' ')} />`
}

const check = (x, y, size, color) => {
  const p = size
  return `  <path d="M ${x + p * 0.16} ${y + p * 0.55} L ${x + p * 0.4} ${y + p * 0.79} L ${x + p * 0.85} ${y + p * 0.2}" fill="none" stroke="${color}" stroke-width="${(p / 6).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`
}

const circle = (cx, cy, r, { fill, opacity } = {}) => {
  const attrs = [`cx="${cx}"`, `cy="${cy}"`, `r="${r}"`, `fill="${fill || 'none'}"`]
  if (opacity !== undefined) attrs.push(`opacity="${opacity}"`)
  return `  <circle ${attrs.join(' ')} />`
}


/* ------------------------------------------------------------------ */
/* vector icons — emoji would need a separate colour font, which makes */
/* Figma's first paint noticeably slower                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */

async function loadOffers() {
  const file = resolve(ROOT, 'server/data/offers.ts')
  const source = await readFile(file, 'utf8')

  // The catalogue is the single source of truth: reuse its price literals
  // instead of duplicating numbers inside the SVG builder.
  const yearlyPrice = source.match(/YEARLY_PRICE_MINOR = ([\d_]+)/)?.[1]
  const monthlyPrice = source.match(/MONTHLY_PRICE_MINOR = ([\d_]+)/)?.[1]
  if (!yearlyPrice || !monthlyPrice) throw new Error('cannot read prices from server/data/offers.ts')

  const rub = (minor) =>
    `${(minor / 100).toLocaleString('ru-RU', { maximumFractionDigits: 0 }).replace(/\u00a0/g, ' ')} ₽`

  const yearly = Number(yearlyPrice.replace(/_/g, ''))
  const monthly = Number(monthlyPrice.replace(/_/g, ''))
  const discount = Math.round((1 - yearly / (monthly * 12)) * 100)

  return [
    {
      name: 'Год',
      amount: rub(yearly),
      compare: rub(monthly * 12),
      period: 'раз в год',
      description: 'Оплата раз в год, списаний больше не будет',
      highlights: ['2 месяца в подарок', 'Цена не изменится весь год'],
      badge: `Выгодно −${discount}%`,
      active: true,
    },
    {
      name: 'Месяц',
      amount: rub(monthly),
      compare: null,
      period: 'каждый месяц',
      description: 'Оплата каждый месяц, отмена в один тап',
      highlights: ['Отмена в любой момент', 'Сначала попробуйте месяц'],
      badge: null,
      active: false,
    },
  ]
}

function buildScreenParts({ offers, title, variant = 'main' }) {
  const parts = []
  let y = 0

  parts.push(`  <!-- status bar -->`)
  parts.push(text(28, 32, '9:41', { size: 14, weight: 700 }))
  parts.push(rect(W - 96, 22, 52, 14, { fill: C.ink, rx: 4, opacity: 0.85 }))

  y = 44
  parts.push(`  <!-- top bar -->`)
  parts.push(circle(38, y + 24, 17, { fill: C.surface, opacity: 0.72 }))
  parts.push(
    `  <path d="M32 ${y + 18} l12 12 M44 ${y + 18} l-12 12" stroke="${C.inkSoft}" stroke-width="1.8" stroke-linecap="round" fill="none" />`,
  )
  parts.push(text(W / 2, y + 29, '🏝️ Чудо-Остров', { size: 13.5, weight: 800, fill: C.inkSoft, anchor: 'middle' }))
  parts.push(circle(W - 38, y + 24, 17, { fill: C.surface, opacity: 0.72 }))

  y += 44
  if (variant === 'main' || variant === 'loading' || variant === 'error') {
    parts.push(`  <!-- hero -->`)
    const badgeY = y + 10
    parts.push(rect(PAD, badgeY, 236, 38, { fill: C.surface, rx: 19, stroke: C.line }))
    parts.push(circle(PAD + 21, badgeY + 19, 13, { fill: C.brandSoft }))
    parts.push(text(PAD + 21, badgeY + 23, '🚀', { size: 13, anchor: 'middle' }))
    parts.push(text(PAD + 42, badgeY + 17, 'Уровень 3 из 120', { size: 12, weight: 800 }))
    parts.push(text(PAD + 42, badgeY + 31, 'Пробные уровни закончились', { size: 10.5, weight: 600, fill: C.muted }))

    parts.push(text(PAD, y + 78, 'Открой все 120 уровней', { size: 27, weight: 900 }))
    parts.push(text(PAD, y + 110, 'Полный доступ открывает все острова,', { size: 14, weight: 600, fill: C.inkSoft }))
    parts.push(text(PAD, y + 130, 'боссов и ежедневные задания.', { size: 14, weight: 600, fill: C.inkSoft }))
    y += 146

    parts.push(`  <!-- unlocks -->`)
    const unlocks = [
      'Все 120 уровней и 6 островов',
      'Без рекламы и ожидания энергии',
      'Ежедневные задания и боссы',
      'Игра без интернета',
    ]
    const boxH = 26 + unlocks.length * 26
    parts.push(rect(PAD, y, CONTENT, boxH, { fill: C.surface, rx: 16, stroke: C.line }))
    unlocks.forEach((item, index) => {
      const itemY = y + 16 + index * 26
      parts.push(circle(PAD + 24, itemY + 6, 10.5, { fill: C.greenSoft }))
      parts.push(check(PAD + 19, itemY + 1, 11, C.green700))
      parts.push(text(PAD + 42, itemY + 10, item, { size: 13, weight: 700, fill: C.inkSoft }))
    })
    y += boxH + 20

    parts.push(text(PAD, y + 14, 'Выберите тариф', { size: 17, weight: 900 }))
    parts.push(text(W - PAD, y + 14, 'Отмена в любой момент', { size: 11, weight: 600, fill: C.muted, anchor: 'end' }))
    y += 24
  }

  if (variant === 'loading') {
    for (let index = 0; index < 2; index += 1) {
      const cardH = 154
      parts.push(rect(PAD, y, CONTENT, cardH, { fill: C.surface, rx: 22, stroke: C.line, strokeWidth: 1.5 }))
      parts.push(circle(PAD + 26, y + 26, 11, { fill: C.surfaceSoft }))
      parts.push(rect(PAD + 46, y + 18, 130, 11, { fill: C.surfaceSoft, rx: 6 }))
      parts.push(rect(PAD + 46, y + 36, 170, 9, { fill: C.surfaceSoft, rx: 6 }))
      parts.push(rect(W - PAD - 84, y + 18, 68, 20, { fill: C.surfaceSoft, rx: 8 }))
      parts.push(rect(PAD + 16, y + 70, CONTENT - 32, 1, { fill: C.line }))
      parts.push(rect(PAD + 16, y + 86, 190, 11, { fill: C.surfaceSoft, rx: 6 }))
      y += cardH + 10
    }
  } else if (variant === 'error') {
    parts.push(rect(PAD, y, CONTENT, 62, { fill: C.dangerSoft, rx: 16, stroke: 'rgba(224,65,63,0.25)' }))
    parts.push(circle(PAD + 26, y + 31, 14, { fill: C.surface }))
    parts.push(text(PAD + 26, y + 36, '!', { size: 14, weight: 900, fill: C.danger, anchor: 'middle' }))
    parts.push(text(PAD + 48, y + 24, 'Что-то пошло не так', { size: 12.5, weight: 800, fill: '#9C2422' }))
    parts.push(text(PAD + 48, y + 41, 'Не удалось загрузить тарифы.', { size: 11.5, weight: 600, fill: '#B04A48' }))
    parts.push(rect(W - PAD - 96, y + 14, 80, 34, { fill: C.surface, rx: 17, stroke: 'rgba(224,65,63,0.3)' }))
    parts.push(text(W - PAD - 56, y + 36, 'Повторить', { size: 12, weight: 800, fill: '#9C2422', anchor: 'middle' }))
  } else if (variant === 'success') {
    parts.push(`  <!-- success -->`)
    const artY = y + 16
    parts.push(circle(W / 2, artY + 62, 62, { fill: C.greenSoft, opacity: 0.7 }))
    parts.push(circle(W / 2, artY + 62, 38, { fill: C.green }))
    parts.push(check(W / 2 - 17, artY + 45, 34, '#FFFFFF'))
    parts.push(text(W / 2, artY + 150, 'Полный доступ открыт!', { size: 24, weight: 900, anchor: 'middle' }))
    parts.push(text(W / 2, artY + 178, 'Все 120 уровней и шесть островов', { size: 13.5, weight: 600, fill: C.inkSoft, anchor: 'middle' }))
    parts.push(text(W / 2, artY + 197, 'разблокированы. Приятной игры!', { size: 13.5, weight: 600, fill: C.inkSoft, anchor: 'middle' }))

    const buttonY = artY + 216
    parts.push(rect(PAD, buttonY, CONTENT, 52, { fill: C.brand, rx: 26 }))
    parts.push(text(W / 2, buttonY + 32, 'Продолжить игру', { size: 15.5, weight: 900, fill: '#FFFFFF', anchor: 'middle' }))

    const receiptY = buttonY + 68
    const rows = [
      ['Тариф', 'Полный доступ · раз в год'],
      ['Сумма', offers[0].amount],
      ['Дата', '14 октября в 19:04'],
      ['Номер покупки', 'pur_mv8a1xj6m5pa8y'],
    ]
    const receiptH = 24 + rows.length * 24
    parts.push(rect(PAD, receiptY, CONTENT, receiptH, { fill: C.surfaceSoft, rx: 16, stroke: C.line }))
    rows.forEach(([key, value], index) => {
      const rowY = receiptY + 26 + index * 24
      parts.push(text(PAD + 14, rowY, key, { size: 11.5, weight: 700, fill: C.muted }))
      parts.push(text(W - PAD - 14, rowY, value, { size: 12.5, weight: 800, anchor: 'end' }))
    })

    const pillY = receiptY + receiptH + 12
    parts.push(rect(PAD + 40, pillY, CONTENT - 80, 28, { fill: C.greenSoft, rx: 14 }))
    parts.push(text(W / 2, pillY + 19, '🎮  Доступ привязан к этому устройству', { size: 11.5, weight: 800, fill: C.green700, anchor: 'middle' }))
  } else {
    // ---- main: the two tariff cards ----------------------------------
    for (const offer of offers) {
      const cardH = offer.active ? 154 : 137
      parts.push(`  <!-- offer: ${esc(offer.name)} -->`)
      parts.push(
        rect(PAD, y, CONTENT, cardH, {
          fill: C.surface,
          rx: 22,
          stroke: offer.active ? C.brand : C.line,
          strokeWidth: offer.active ? 1.5 : 1.5,
        }),
      )

      if (offer.badge) {
        const badgeW = 118
        parts.push(rect(W - PAD - badgeW - 13, y - 9, badgeW, 20, { fill: C.green, rx: 10 }))
        parts.push(text(W - PAD - badgeW / 2 - 13, y + 5, offer.badge, { size: 10.5, weight: 800, fill: '#FFFFFF', anchor: 'middle' }))
      }

      parts.push(circle(PAD + 26, y + 27, 11, { fill: offer.active ? C.brand : C.surface }))
      if (offer.active) {
        parts.push(check(PAD + 21, y + 22, 11, '#FFFFFF'))
      } else {
        parts.push(circle(PAD + 26, y + 27, 10, { fill: 'none' }))
        parts.push(`  <circle cx="${PAD + 26}" cy="${y + 27}" r="10" fill="none" stroke="${C.brandLine}" stroke-width="2" />`)
      }

      parts.push(text(PAD + 46, y + 32, offer.name, { size: 15.5, weight: 900 }))
      parts.push(text(W - PAD - 16, y + 30, offer.amount, { size: 19, weight: 900, anchor: 'end' }))
      parts.push(text(W - PAD - 16, y + 46, offer.period, { size: 11, weight: 700, fill: C.muted, anchor: 'end' }))
      if (offer.compare) {
        parts.push(text(W - PAD - 16, y + 62, offer.compare, { size: 11, weight: 700, fill: C.muted, anchor: 'end' }))
      }

      parts.push(text(PAD + 16, y + (offer.compare ? 84 : 76), offer.description, { size: 11.5, weight: 600, fill: C.muted }))
      parts.push(rect(PAD + 16, y + cardH - 58, CONTENT - 32, 1, { fill: C.line }))
      offer.highlights.forEach((item, index) => {
        const itemY = y + cardH - 40 + index * 17
        parts.push(check(PAD + 16, itemY - 9, 10, C.green))
        parts.push(text(PAD + 32, itemY, item, { size: 11.5, weight: 700, fill: C.inkSoft }))
      })

      y += cardH + 10
    }
  }

  // ---- CTA bar pinned to the bottom (never clipped) --------------------
  const barH = 155
  const barY = H - barH
  parts.push(`  <!-- CTA bar -->`)
  parts.push(rect(0, barY, W, barH, { fill: C.surface, opacity: 0.97 }))
  parts.push(rect(0, barY, W, 1, { fill: C.line }))
  parts.push(rect(PAD, barY + 13, CONTENT, 54, { fill: C.brand, rx: 27 }))
  const ctaLabel = variant === 'purchasing' ? 'Оформляем…' : `Открыть за ${offers[0].amount}`
  // The CTA mixes two type sizes, so centre the pair manually instead of
  // anchoring both halves on the same point (that overlapped them).
  const gap = 8
  const labelWidth = ctaLabel.length * 8.6 + 10
  const note = 'Полный доступ на год'
  const noteWidth = note.length * 6.2
  const pairLeft = W / 2 - (labelWidth + gap + noteWidth) / 2
  parts.push(text(pairLeft, barY + 45, ctaLabel, { size: 16, weight: 900, fill: '#FFFFFF' }))
  parts.push(
    text(pairLeft + labelWidth + gap, barY + 44, note, {
      size: 12,
      weight: 700,
      fill: '#FFFFFF',
      opacity: 0.82,
    }),
  )

  parts.push(
    text(W / 2 - 88, barY + 89, 'Восстановить покупки', {
      size: 12.5, weight: 700, fill: C.brand700, anchor: 'middle',
    }),
  )
  parts.push(text(W / 2, barY + 88, '•', { size: 15, weight: 700, fill: C.muted, anchor: 'middle' }))
  parts.push(
    text(W / 2 + 84, barY + 89, 'Мои покупки', {
      size: 12.5, weight: 700, fill: C.brand700, anchor: 'middle',
    }),
  )
  parts.push(text(W / 2, barY + 112, 'Тестовая покупка без списания денег.', { size: 10, weight: 600, fill: C.muted, anchor: 'middle' }))
  parts.push(text(W / 2, barY + 126, 'Подписку можно отменить в настройках.', { size: 10, weight: 600, fill: C.muted, anchor: 'middle' }))

  return parts.join('\n')
}

function buildScreen(...args) {
  const all = buildScreenParts(...args)
  const lines = all.split('\n')
  const cut = lines.findIndex(line => line.includes('<!-- CTA bar -->'))
  return {
    body: lines.slice(0, cut).join('\n'),
    ctaBar: lines.slice(cut).join('\n'),
  }
}

function svgDocument(name, offers, variant) {
  const { body, ctaBar } = buildScreen({ offers, title: name, variant })
  // The app hides the CTA bar on the success screen, so the mock must too.
  const bar = variant === 'success' ? '' : `  <g>\n${ctaBar}\n  </g>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
  <title>${esc(name)}</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F7F4FF" />
      <stop offset="0.42" stop-color="#FDFBFF" />
      <stop offset="1" stop-color="#FFFFFF" />
    </linearGradient>
    <radialGradient id="wash" cx="0.5" cy="0" r="0.62">
      <stop offset="0" stop-color="${C.gradientTop}" stop-opacity="0.95" />
      <stop offset="1" stop-color="${C.gradientTop}" stop-opacity="0" />
    </radialGradient>
    <!-- the implementation scrolls its body under a fixed CTA bar; clip the
         mock the same way so content cannot bleed over the button -->
    <clipPath id="scrollArea">
      <rect x="0" y="0" width="${W}" height="${H - 155}" />
    </clipPath>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#bg)" />
  <rect x="0" y="0" width="${W}" height="360" fill="url(#wash)" />
  <g clip-path="url(#scrollArea)">
${body}
  </g>
${bar}
</svg>
`
}


/* ------------------------------------------------------------------ */
/* overview sheet: all four screens in one importable file             */
/* ------------------------------------------------------------------ */

const SHEET_GAP = 40
const SHEET_LABEL = 26
const sheetWidth = W * 4 + SHEET_GAP * 5
const sheetHeight = H + SHEET_GAP * 2 + SHEET_LABEL

function overviewSheet(screens) {
  const panels = screens
    .map(([file, name, variant], index) => {
      const x = SHEET_GAP + index * (W + SHEET_GAP)
      const y = SHEET_GAP + SHEET_LABEL
      const body = buildScreenParts({ offers, title: name, variant })
      const inner = body
        .replace(/<\/svg>\s*$/, '')
        .split('\n')
        .filter(line => !line.trim().startsWith('<!--'))
        .join('\n')
      return `  <g transform="translate(${x} ${y})">
    <text x="0" y="-10" font-family="${FONT}" font-size="14" font-weight="700" fill="${C.muted}">${esc(name)}</text>
    <svg x="0" y="0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none">
${inner}
    </svg>
  </g>`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F7F4FF" />
      <stop offset="0.42" stop-color="#FDFBFF" />
      <stop offset="1" stop-color="#FFFFFF" />
    </linearGradient>
    <radialGradient id="wash" cx="0.5" cy="0" r="0.62">
      <stop offset="0" stop-color="${C.gradientTop}" stop-opacity="0.95" />
      <stop offset="1" stop-color="${C.gradientTop}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="${sheetWidth}" height="${sheetHeight}" fill="#FFFFFF" />
${panels}
</svg>
`
}

const offers = await loadOffers()
await mkdir(OUT_DIR, { recursive: true })

const screens = [
  ['01-main', 'Paywall / 390x844 — основной', 'main'],
  ['02-loading', 'Paywall / загрузка тарифов', 'loading'],
  ['03-error', 'Paywall / ошибка загрузки', 'error'],
  ['04-success', 'Paywall / успешная покупка', 'success'],
]

for (const [file, name, variant] of screens) {
  const svg = svgDocument(name, offers, variant)
  await writeFile(resolve(OUT_DIR, `${file}.svg`), svg, 'utf8')
  console.log(`  design/svg/${file}.svg  (${name})`)
}

const sheet = overviewSheet(screens)
await writeFile(resolve(OUT_DIR, '00-overview.svg'), sheet, 'utf8')
console.log('  design/svg/00-overview.svg  (все четыре экрана одним листом)')

console.log(`\nSVG собран из server/data/offers.ts: ${offers.map(o => `${o.name} ${o.amount}`).join(', ')}`)
