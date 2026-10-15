/**
 * Чудо-Остров — paywall
 * Figma builder plugin: recreates the paywall screen that is implemented in
 * this repository (Nuxt 4, 390 x 844 reference frame).
 *
 * Usage: see design/README.md
 */

/* ------------------------------------------------------------------ */
/* tokens — keep in sync with app/assets/css/main.css                  */
/* ------------------------------------------------------------------ */

const C = {
  brand: { r: 0.416, g: 0.271, b: 1 }, // #6A45FF
  brand700: { r: 0.290, g: 0.153, b: 0.839 }, // #4A27D6
  brandSoft: { r: 0.937, g: 0.918, b: 1 }, // #EFEAFF
  brandLine: { r: 0.871, g: 0.831, b: 1 }, // #DED4FF
  ink: { r: 0.118, g: 0.102, b: 0.180 }, // #1E1A2E
  inkSoft: { r: 0.290, g: 0.271, b: 0.376 }, // #4A4560
  muted: { r: 0.545, g: 0.525, b: 0.639 }, // #8B86A3
  line: { r: 0.914, g: 0.898, b: 0.961 }, // #E9E5F5
  surface: { r: 1, g: 1, b: 1 },
  surfaceSoft: { r: 0.965, g: 0.953, b: 1 }, // #F6F3FF
  green: { r: 0.078, g: 0.753, b: 0.482 }, // #14C07B
  greenSoft: { r: 0.894, g: 0.976, b: 0.937 }, // #E4F9EF
  green700: { r: 0.043, g: 0.561, b: 0.357 }, // #0B8F5B
  danger: { r: 0.878, g: 0.255, b: 0.247 }, // #E0413F
  dangerSoft: { r: 0.992, g: 0.925, b: 0.922 }, // #FDECEB
  gradientTop: { r: 0.937, g: 0.906, b: 1 }, // #EFE7FF
  gradientBottom: { r: 1, g: 1, b: 1 },
}

const R = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 }
const PAD = 20
const FONT = 'Nunito'

let regular = null
let semibold = null
let bold = null
let extraBold = null
let black = null
let fontFamily = FONT

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* fonts — resolved defensively, so one unavailable style cannot abort  */
/* the whole run                                                        */
/* ------------------------------------------------------------------ */

const FONT_CACHE = new Map()
const AVAILABLE_FAMILIES = new Map()

/** Style names used by each role, most wanted first. */
const FONT_STYLES = {
  regular: ['Regular', 'Book', 'Normal', 'Light'],
  semibold: ['SemiBold', 'Semi Bold', 'DemiBold', 'Medium'],
  bold: ['Bold', 'SemiBold', 'Semi Bold', 'Medium'],
  extraBold: ['ExtraBold', 'Extra Bold', 'Bold', 'SemiBold Bold', 'SemiBold'],
  black: ['Black', 'Heavy', 'ExtraBold', 'Extra Bold', 'Bold'],
}

const FONT_ROLES = Object.keys(FONT_STYLES)
const DEFAULTS = {
  regular: { family: 'Roboto', style: 'Regular' },
  semibold: { family: 'Roboto', style: 'Medium' },
  bold: { family: 'Roboto', style: 'Bold' },
  extraBold: { family: 'Roboto', style: 'Bold' },
  black: { family: 'Roboto', style: 'Bold' },
}

function stylesForFamily(family) {
  if (AVAILABLE_FAMILIES.has(family)) return AVAILABLE_FAMILIES.get(family)
  let styles = []
  try {
    styles = figma.listAvailableFontsAsync
      ? null // async, handled by warmFamilies()
      : (figma.getAvailableFonts ? figma.getAvailableFonts() : [])
        .filter(font => font.fontName.family === family)
        .map(font => font.fontName.style)
  } catch {
    styles = []
  }
  const set = new Set(styles || [])
  AVAILABLE_FAMILIES.set(family, set)
  return set
}

async function warmFamilies(families) {
  if (!figma.listAvailableFontsAsync) return
  try {
    const list = await figma.listAvailableFontsAsync()
    for (const family of families) {
      AVAILABLE_FAMILIES.set(
        family,
        new Set(
          list
            .filter(item => item.fontName && item.fontName.family === family)
            .map(item => item.fontName.style),
        ),
      )
    }
  } catch {
    /* keep whatever we have */
  }
}

async function tryLoad(fontName) {
  const key = `${fontName.family}/${fontName.style}`
  if (FONT_CACHE.has(key)) return FONT_CACHE.get(key)
  try {
    await figma.loadFontAsync(fontName)
    FONT_CACHE.set(key, fontName)
    return fontName
  } catch {
    FONT_CACHE.set(key, null)
    return null
  }
}

/** Resolves one role for one family, or null if that family has no such style. */
async function resolveRole(family, role) {
  const available = stylesForFamily(family)
  for (const style of FONT_STYLES[role]) {
    if (available && available.size && !available.has(style)) continue
    const loaded = await tryLoad({ family, style })
    if (loaded) return loaded
  }
  return null
}

/**
 * Prepares Nunito (or the best available fallback) for every role.
 * Never throws: if a style is missing we fall back to another style or family,
 * because a font problem must not prevent the screen from being drawn.
 */
async function loadFonts() {
  const families = ['Nunito', 'Inter', 'Roboto', 'Helvetica Neue', 'Arial']
  await warmFamilies(families)

  const resolved = {}
  let chosen = null

  for (const family of families) {
    const candidate = {}
    for (const role of FONT_ROLES) candidate[role] = await resolveRole(family, role)
    const complete = FONT_ROLES.every(role => candidate[role])
    const partial = FONT_ROLES.some(role => candidate[role])
    if (complete) {
      Object.assign(resolved, candidate)
      chosen = family
      break
    }
    if (partial && !chosen) {
      Object.assign(resolved, candidate)
      chosen = family
    }
  }

  for (const role of FONT_ROLES) {
    if (!resolved[role]) {
      resolved[role] = (await tryLoad(DEFAULTS[role])) || DEFAULTS[role]
    }
  }

  regular = resolved.regular
  semibold = resolved.semibold
  bold = resolved.bold
  extraBold = resolved.extraBold
  black = resolved.black
  fontFamily = chosen || regular.family
  return fontFamily
}

function solid(color, opacity = 1) {
  return [{ type: 'SOLID', color, opacity }]
}

/**
 * Soft lavender wash at the top of the screen, as a fill on the frame itself.
 *
 * It must NOT be a separate absolutely-positioned layer: inside an auto-layout
 * frame such a layer is painted above the content and hides the whole design.
 *
 * Vertical top → bottom gradient, matching the CSS in the implementation:
 *   radial-gradient(120% 46% at 50% 0%, #EFE7FF 0%, transparent 62%),
 *   linear-gradient(180deg, #F7F4FF 0%, #FDFBFF 42%, #FFFFFF 100%)
 */
function screenFills() {
  return [
    {
      type: 'GRADIENT_LINEAR',
      gradientTransform: [
        [0, 1, 0],
        [-1, 0, 1],
      ],
      gradientStops: [
        { position: 0, color: { ...C.gradientTop, a: 1 } },
        { position: 0.42, color: { r: 0.992, g: 0.984, b: 1, a: 1 } }, // #FDFBFF
        { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
      ],
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL',
    },
    {
      type: 'GRADIENT_RADIAL',
      // circle centred on the top edge, fading out by ~62% of the height
      gradientTransform: [
        [1.2, 0, -0.1],
        [0, 2.15, -0.075],
      ],
      gradientStops: [
        { position: 0, color: { ...C.gradientTop, a: 1 } },
        { position: 1, color: { ...C.gradientTop, a: 0 } },
      ],
      opacity: 1,
      visible: true,
      blendMode: 'NORMAL',
    },
  ]
}

function frame(name, options = {}) {
  const node = figma.createFrame()
  node.name = name
  node.fills = options.fills ?? []
  node.clipsContent = options.clipsContent ?? false
  node.layoutMode = options.mode ?? 'VERTICAL'

  const fixedWidth = options.width !== undefined
  const fixedHeight = options.height !== undefined

  // A fixed size only sticks when the matching sizing mode is FIXED as well:
  // with AUTO the plugin API recomputes the axis from the children, which
  // silently turns a 390x844 screen into a content-sized frame.
  node.primaryAxisSizingMode = options.primary ?? (fixedHeight ? 'FIXED' : 'AUTO')
  node.counterAxisSizingMode = options.counter ?? (fixedWidth ? 'FIXED' : 'AUTO')

  node.itemSpacing = options.gap ?? 0
  if (options.padding !== undefined) {
    const p = options.padding
    node.paddingTop = options.paddingTop ?? p
    node.paddingBottom = options.paddingBottom ?? p
    node.paddingLeft = options.paddingLeft ?? p
    node.paddingRight = options.paddingRight ?? p
  }
  if (options.align) node.counterAxisAlignItems = options.align
  if (options.justify) node.primaryAxisAlignItems = options.justify

  // Pass only the axes that were really requested. Supplying `undefined` for
  // the other axis would keep Figma's default 100px instead of letting the
  // AUTO sizing mode compute it from the children.
  if (fixedWidth && fixedHeight) node.resize(options.width, options.height)
  else if (fixedWidth) node.resize(options.width)
  else if (fixedHeight) node.resize(node.width, options.height)

  if (options.radius !== undefined) node.cornerRadius = options.radius
  if (options.stroke) {
    node.strokes = solid(options.stroke.color)
    node.strokeWeight = options.stroke.weight ?? 1
    if (options.stroke.align) node.strokeAlign = options.stroke.align
  }
  if (options.shadow) node.effects = [shadow(options.shadow)]
  return node
}

function shadow({ y = 2, blur = 10, spread = 0, color = C.ink, opacity = 0.05 }) {
  return {
    type: 'DROP_SHADOW',
    color: { ...color, a: opacity },
    offset: { x: 0, y },
    radius: blur,
    spread,
    visible: true,
    blendMode: 'NORMAL',
  }
}

function text(characters, options = {}) {
  const node = figma.createText()
  node.name = options.name ?? characters.slice(0, 24)
  node.fontName = options.font ?? regular
  node.characters = characters
  node.fontSize = options.size ?? 14
  if (options.lineHeight) node.lineHeight = { value: options.lineHeight, unit: 'PIXELS' }
  if (options.letterSpacing) node.letterSpacing = { value: options.letterSpacing, unit: 'PERCENT' }
  node.fills = solid(options.color ?? C.ink)
  if (options.align) node.textAlignHorizontal = options.align
  if (options.width) {
    node.textAutoResize = 'HEIGHT'
    node.resize(options.width, node.height)
  }
  if (options.grow) node.layoutGrow = 1
  return node
}

function rect(name, options = {}) {
  const node = frame(name, { ...options, mode: options.mode ?? 'NONE' })
  return node
}

function row(name, options = {}) {
  return frame(name, { ...options, mode: 'HORIZONTAL' })
}

function col(name, options = {}) {
  return frame(name, { ...options, mode: 'VERTICAL' })
}

function pill(name, textValue, options = {}) {
  const node = row(name, {
    fills: solid(options.bg ?? C.surfaceSoft),
    padding: 0,
    paddingTop: options.padY ?? 5,
    paddingBottom: options.padY ?? 5,
    paddingLeft: options.padX ?? 11,
    paddingRight: options.padX ?? 11,
    radius: R.pill,
    align: 'CENTER',
    justify: 'CENTER',
    stroke: options.stroke,
  })
  node.appendChild(
    text(textValue, {
      size: options.size ?? 11,
      font: options.font ?? extraBold,
      color: options.color ?? C.ink,
      lineHeight: (options.size ?? 11) * 1.3,
    }),
  )
  return node
}

function spacer(height) {
  return frame('spacer', { fills: [], width: 1, height, mode: 'NONE' })
}

function iconCheck(size = 12, color = C.green700, weight = 2) {
  const node = figma.createVector()
  node.name = 'check'
  node.resize(size, size)
  node.vectorPaths = [
    {
      windingRule: 'NONZERO',
      data: `M ${size * 0.16} ${size * 0.55} L ${size * 0.4} ${size * 0.79} L ${size * 0.85} ${size * 0.2}`,
    },
  ]
  node.strokes = solid(color)
  node.strokeWeight = weight
  node.strokeCap = 'ROUND'
  node.strokeJoin = 'ROUND'
  node.fills = []
  return node
}

/* ------------------------------------------------------------------ */
/* screen parts                                                        */
/* ------------------------------------------------------------------ */

function buildStatusBar() {
  const bar = row('status-bar', {
    width: 390,
    height: 44,
    paddingLeft: 26,
    paddingRight: 22,
    align: 'CENTER',
    justify: 'SPACE_BETWEEN',
  })
  bar.appendChild(text('9:41', { size: 14, font: bold, name: 'time' }))

  const icons = row('status-icons', { gap: 6, align: 'CENTER', fills: [] })
  const bars = row('signal', { gap: 2, align: 'CENTER', fills: [], height: 11 })
  ;[4, 6, 8, 10].forEach((height) => {
    const value = rect('bar', { fills: solid(C.ink), radius: 1, width: 3, height })
    bars.appendChild(value)
  })
  icons.appendChild(bars)
  icons.appendChild(rect('wifi', { fills: solid(C.ink), radius: R.pill, width: 15, height: 11 }))
  icons.appendChild(rect('battery', { fills: solid(C.ink), radius: 3, width: 24, height: 11 }))
  bar.appendChild(icons)

  return bar
}

function buildTopBar() {
  const bar = row('top-bar', {
    width: 390,
    paddingLeft: PAD,
    paddingRight: PAD,
    paddingTop: 10,
    paddingBottom: 4,
    align: 'CENTER',
    justify: 'SPACE_BETWEEN',
  })

  const close = frame('close-button', {
    fills: solid(C.surface, 0.72),
    width: 34,
    height: 34,
    radius: R.pill,
    align: 'CENTER',
    justify: 'CENTER',
    stroke: { color: C.line },
  })
  const cross = figma.createVector()
  cross.name = 'cross'
  cross.resize(11, 11)
  cross.vectorPaths = [
    { windingRule: 'NONZERO', data: 'M 0.5 0.5 L 10.5 10.5' },
    { windingRule: 'NONZERO', data: 'M 10.5 0.5 L 0.5 10.5' },
  ]
  cross.strokes = solid(C.inkSoft)
  cross.strokeWeight = 1.8
  cross.strokeCap = 'ROUND'
  cross.fills = []
  close.appendChild(cross)
  bar.appendChild(close)

  const brand = row('brand', { gap: 6, align: 'CENTER', fills: [] })
  brand.appendChild(text('🏝️', { size: 14, name: 'logo' }))
  brand.appendChild(text('Чудо-Остров', { size: 13.5, font: extraBold, color: C.inkSoft }))
  bar.appendChild(brand)

  bar.appendChild(
    frame('bell', {
      fills: solid(C.surface, 0.72),
      width: 34,
      height: 34,
      radius: R.pill,
      stroke: { color: C.line },
    }),
  )

  return bar
}

function buildHero() {
  const hero = col('hero', { width: 350, gap: 8, fills: [] })

  const badge = row('progress-badge', {
    fills: solid(C.surface),
    gap: 8,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 8,
    paddingRight: 13,
    radius: R.pill,
    align: 'CENTER',
    stroke: { color: C.line },
    shadow: { y: 2, blur: 10, opacity: 0.05 },
  })
  const badgeIcon = frame('badge-icon', {
    fills: solid(C.brandSoft),
    width: 26,
    height: 26,
    radius: R.pill,
    align: 'CENTER',
    justify: 'CENTER',
  })
  badgeIcon.appendChild(text('🚀', { size: 13, name: 'rocket' }))
  badge.appendChild(badgeIcon)

  const badgeText = col('badge-text', { gap: 0, fills: [] })
  badgeText.appendChild(text('Уровень 3 из 120', { size: 12, font: extraBold, lineHeight: 15 }))
  badgeText.appendChild(
    text('Пробные уровни закончились', { size: 10.5, font: semibold, color: C.muted, lineHeight: 14 }),
  )
  badge.appendChild(badgeText)
  hero.appendChild(badge)

  hero.appendChild(
    text('Открой все 120 уровней', {
      size: 27,
      font: black,
      lineHeight: 31,
      letterSpacing: -2.5,
      width: 350,
      name: 'h1',
    }),
  )
  hero.appendChild(
    text('Полный доступ открывает все острова, боссов и ежедневные задания.', {
      size: 14,
      font: semibold,
      color: C.inkSoft,
      lineHeight: 20,
      width: 350,
      name: 'subtitle',
    }),
  )

  return hero
}

function buildUnlocks() {
  const items = [
    'Все 120 уровней и 6 островов',
    'Без рекламы и ожидания энергии',
    'Ежедневные задания и боссы',
    'Игра без интернета',
  ]

  const card = col('unlocks', {
    width: 350,
    gap: 10,
    paddingTop: 13,
    paddingBottom: 13,
    paddingLeft: 14,
    paddingRight: 14,
    radius: R.md,
    fills: solid(C.surface),
    stroke: { color: C.line },
    shadow: { y: 2, blur: 10, opacity: 0.05 },
  })

  items.forEach((item) => {
    const line = row('unlock', { gap: 9, align: 'CENTER', fills: [] })
    const check = frame('check-circle', {
      fills: solid(C.greenSoft),
      width: 21,
      height: 21,
      radius: R.pill,
      align: 'CENTER',
      justify: 'CENTER',
    })
    check.appendChild(iconCheck(11, C.green700, 2))
    line.appendChild(check)
    line.appendChild(text(item, { size: 13, font: bold, color: C.inkSoft }))
    card.appendChild(line)
  })

  return card
}

function buildOfferCard({ name, price, period, compare, description, highlights, badge, active }) {
  const card = row('offer-card', {
    width: 350,
    gap: 10,
    paddingTop: 15,
    paddingBottom: 13,
    paddingLeft: 15,
    paddingRight: 15,
    radius: R.lg,
    fills: solid(C.surface),
    stroke: { color: active ? C.brand : C.line, weight: 1.5, align: 'INSIDE' },
    shadow: active ? { y: 8, blur: 22, opacity: 0.16, color: C.brand } : { y: 2, blur: 10, opacity: 0.05 },
  })

  const radio = frame('radio', {
    fills: active ? solid(C.brand) : solid(C.surface),
    width: 22,
    height: 22,
    radius: R.pill,
    align: 'CENTER',
    justify: 'CENTER',
    stroke: { color: active ? C.brand : C.brandLine, weight: 2, align: 'INSIDE' },
  })
  if (active) radio.appendChild(iconCheck(12, C.surface, 2))
  card.appendChild(radio)

  const body = col('body', { gap: 6, width: 0, fills: [] })
  body.layoutGrow = 1

  const head = row('head', { justify: 'SPACE_BETWEEN', align: 'MIN', fills: [], width: 0 })
  head.layoutGrow = 1
  head.appendChild(text(name, { size: 15.5, font: black }))

  const priceBox = col('price', { gap: 1, align: 'MAX', fills: [] })
  priceBox.appendChild(text(price, { size: 19, font: black, letterSpacing: -2 }))
  priceBox.appendChild(text(period, { size: 11, font: bold, color: C.muted }))
  if (compare) {
    const compareText = text(compare, { size: 11, font: bold, color: C.muted })
    compareText.textDecoration = 'STRIKETHROUGH'
    priceBox.appendChild(compareText)
  }
  head.appendChild(priceBox)
  body.appendChild(head)

  body.appendChild(
    text(description, {
      size: 11.5,
      font: semibold,
      color: C.muted,
      lineHeight: 15,
      width: 250,
      name: 'description',
    }),
  )

  const list = col('highlights', {
    gap: 3,
    paddingTop: 8,
    width: 0,
    fills: [],
    stroke: { color: C.line },
  })
  list.layoutGrow = 1
  highlights.forEach((item) => {
    const line = row('highlight', { gap: 6, align: 'CENTER', fills: [] })
    line.appendChild(iconCheck(10, C.green, 2))
    line.appendChild(text(item, { size: 11.5, font: bold, color: C.inkSoft }))
    list.appendChild(line)
  })
  body.appendChild(list)

  card.appendChild(body)

  let wrapper = card
  if (badge) {
    wrapper = frame('offer-card-wrapper', {
      width: 350,
      mode: 'NONE',
      fills: [],
      clipsContent: false,
    })
    card.y = 10
    wrapper.appendChild(card)

    const badgeNode = pill('badge', badge, {
      bg: C.green,
      color: C.surface,
      size: 10.5,
      padX: 10,
      padY: 4,
      font: extraBold,
    })
    badgeNode.x = 350 - badgeNode.width - 13
    badgeNode.y = 0
    wrapper.appendChild(badgeNode)
  }

  return wrapper
}

function buildCtaBar() {
  const bar = col('cta-bar', {
    width: 390,
    paddingTop: 12,
    paddingBottom: 14,
    paddingLeft: PAD,
    paddingRight: PAD,
    gap: 10,
    fills: solid(C.surface, 0.96),
    stroke: { color: C.line },
    shadow: { y: -6, blur: 20, opacity: 0.07 },
  })

  const button = row('cta-button', {
    width: 350,
    height: 54,
    radius: R.pill,
    align: 'CENTER',
    justify: 'CENTER',
    gap: 8,
    fills: solid(C.brand),
    shadow: { y: 8, blur: 20, opacity: 0.24, color: C.brand },
  })
  button.appendChild(text('Открыть за 1 790 ₽', { size: 16, font: black, color: C.surface }))
  button.appendChild(
    text('Полный доступ на год', { size: 12, font: bold, color: C.surface, name: 'note' }),
  )
  bar.appendChild(button)

  const links = row('links', { gap: 10, align: 'CENTER', justify: 'CENTER', fills: [], width: 350 })
  links.appendChild(text('Восстановить покупки', { size: 12.5, font: bold, color: C.brand700 }))
  links.appendChild(text('•', { size: 12, font: bold, color: C.muted }))
  links.appendChild(text('Мои покупки', { size: 12.5, font: bold, color: C.brand700 }))
  bar.appendChild(links)

  bar.appendChild(
    text('Тестовая покупка без списания денег. Подписку можно отменить в настройках в любой момент.', {
      size: 10,
      font: semibold,
      color: C.muted,
      lineHeight: 14,
      width: 350,
      align: 'CENTER',
      name: 'legal',
    }),
  )

  return bar
}

function sectionTitle(value, y) {
  const node = text(value, { size: 12, font: extraBold, color: C.muted, name: 'section-label' })
  node.x = 0
  node.y = y
  return node
}

/* ------------------------------------------------------------------ */
/* screens                                                             */
/* ------------------------------------------------------------------ */

async function buildMainScreen(x, y, label) {
  const frameNode = col('Paywall / 390x844 — основной', {
    width: 390,
    height: 844,
    fills: screenFills(),
    clipsContent: true,
  })
  frameNode.x = x
  frameNode.y = y

  const content = col('content', {
    width: 390,
    paddingLeft: PAD,
    paddingRight: PAD,
    paddingTop: 4,
    paddingBottom: 18,
    gap: 0,
    fills: [],
  })
  content.appendChild(buildHero())
  content.appendChild(spacer(18))
  content.appendChild(buildUnlocks())
  content.appendChild(spacer(20))

  const offersHead = row('offers-head', {
    width: 350,
    justify: 'SPACE_BETWEEN',
    align: 'BASELINE',
    fills: [],
  })
  offersHead.appendChild(text('Выберите тариф', { size: 17, font: black }))
  offersHead.appendChild(text('Отмена в любой момент', { size: 11, font: semibold, color: C.muted }))
  content.appendChild(offersHead)
  content.appendChild(spacer(11))

  const yearly = buildOfferCard({
    name: 'Год',
    price: '1 790 ₽',
    period: 'раз в год',
    compare: '4 788 ₽',
    description: 'Оплата раз в год, списаний больше не будет',
    highlights: ['2 месяца в подарок', 'Цена не изменится весь год'],
    badge: 'Выгодно −63%',
    active: true,
  })
  content.appendChild(yearly)
  content.appendChild(spacer(10))
  content.appendChild(
    buildOfferCard({
      name: 'Месяц',
      price: '399 ₽',
      period: 'каждый месяц',
      description: 'Оплата каждый месяц, отмена в один тап',
      highlights: ['Отмена в любой момент', 'Сначала попробуйте месяц'],
      active: false,
    }),
  )

  frameNode.appendChild(buildStatusBar())
  frameNode.appendChild(buildTopBar())
  frameNode.appendChild(content)
  frameNode.appendChild(buildCtaBar())

  const labelNode = sectionTitle(label, y - 22)
  labelNode.x = x
  return [frameNode, labelNode]
}

async function buildStateScreen(x, y, label, variant) {
  const frameNode = col(`Paywall / 390x844 — ${variant}`, {
    width: 390,
    height: 844,
    fills: screenFills(),
    clipsContent: true,
  })
  frameNode.x = x
  frameNode.y = y

  const content = col('content', {
    width: 390,
    paddingLeft: PAD,
    paddingRight: PAD,
    paddingTop: 4,
    gap: 0,
    fills: [],
  })

  if (variant === 'loading') {
    content.appendChild(buildHero())
    content.appendChild(spacer(20))
    const head = row('offers-head', { width: 350, align: 'BASELINE', fills: [] })
    head.appendChild(text('Выберите тариф', { size: 17, font: black }))
    content.appendChild(head)
    content.appendChild(spacer(11))

    for (let index = 0; index < 2; index += 1) {
      const skeleton = col('skeleton-card', {
        width: 350,
        gap: 10,
        padding: 16,
        radius: R.lg,
        fills: solid(C.surface),
        stroke: { color: C.line, weight: 1.5 },
        shadow: { y: 2, blur: 10, opacity: 0.05 },
      })
      const top = row('skeleton-top', { gap: 10, align: 'CENTER', fills: [] })
      top.appendChild(rect('circle', { fills: solid(C.surfaceSoft), width: 22, height: 22, radius: R.pill }))
      const lines = col('lines', { gap: 6, width: 180, fills: [] })
      lines.appendChild(rect('line', { fills: solid(C.surfaceSoft), width: 140, height: 11, radius: 6 }))
      lines.appendChild(rect('line-sm', { fills: solid(C.surfaceSoft), width: 190, height: 9, radius: 6 }))
      top.appendChild(lines)
      top.appendChild(rect('price', { fills: solid(C.surfaceSoft), width: 68, height: 20, radius: 8 }))
      skeleton.appendChild(top)
      skeleton.appendChild(rect('divider', { fills: solid(C.line), width: 318, height: 1 }))
      skeleton.appendChild(rect('line', { fills: solid(C.surfaceSoft), width: 190, height: 11, radius: 6 }))
      content.appendChild(skeleton)
      content.appendChild(spacer(10))
    }
  }

  if (variant === 'error') {
    content.appendChild(buildHero())
    content.appendChild(spacer(20))
    const head = row('offers-head', { width: 350, align: 'BASELINE', fills: [] })
    head.appendChild(text('Выберите тариф', { size: 17, font: black }))
    content.appendChild(head)
    content.appendChild(spacer(11))

    const banner = row('error-banner', {
      width: 350,
      gap: 10,
      padding: 12,
      radius: R.md,
      align: 'CENTER',
      fills: solid(C.dangerSoft),
      stroke: { color: C.danger, weight: 1 },
    })
    const icon = frame('error-icon', {
      fills: solid(C.surface),
      width: 28,
      height: 28,
      radius: R.pill,
      align: 'CENTER',
      justify: 'CENTER',
    })
    icon.appendChild(text('!', { size: 14, font: black, color: C.danger }))
    banner.appendChild(icon)

    const copy = col('copy', { gap: 2, width: 190, fills: [] })
    copy.appendChild(text('Что-то пошло не так', { size: 12.5, font: extraBold, color: C.danger }))
    copy.appendChild(
      text('Не удалось загрузить тарифы. Проверьте соединение.', {
        size: 11.5,
        font: semibold,
        color: C.danger,
        lineHeight: 15,
      }),
    )
    banner.appendChild(copy)
    banner.appendChild(pill('retry', 'Повторить', { bg: C.surface, color: C.danger, size: 12 }))
    content.appendChild(banner)
  }

  if (variant === 'success') {
    const success = col('success', {
      width: 350,
      gap: 0,
      align: 'CENTER',
      fills: [],
      paddingTop: 16,
    })
    const art = frame('success-art', {
      fills: solid(C.greenSoft),
      width: 124,
      height: 124,
      radius: R.pill,
      align: 'CENTER',
      justify: 'CENTER',
    })
    const circle = frame('check-circle', {
      fills: solid(C.green),
      width: 76,
      height: 76,
      radius: R.pill,
      align: 'CENTER',
      justify: 'CENTER',
      shadow: { y: 10, blur: 24, opacity: 0.34, color: C.green },
    })
    circle.appendChild(iconCheck(34, C.surface, 4))
    art.appendChild(circle)
    success.appendChild(art)
    success.appendChild(spacer(6))
    success.appendChild(text('Полный доступ открыт!', { size: 24, font: black, letterSpacing: -2 }))
    success.appendChild(spacer(8))
    success.appendChild(
      text('Все 120 уровней и шесть островов разблокированы. Приятной игры!', {
        size: 13.5,
        font: semibold,
        color: C.inkSoft,
        lineHeight: 20,
        width: 300,
        align: 'CENTER',
      }),
    )
    success.appendChild(spacer(16))

    const button = row('success-button', {
      width: 350,
      height: 52,
      radius: R.pill,
      align: 'CENTER',
      justify: 'CENTER',
      fills: solid(C.brand),
      shadow: { y: 8, blur: 20, opacity: 0.24, color: C.brand },
    })
    button.appendChild(text('Продолжить игру', { size: 15.5, font: black, color: C.surface }))
    success.appendChild(button)
    success.appendChild(spacer(16))

    const receipt = col('receipt', {
      width: 350,
      gap: 0,
      padding: 14,
      radius: R.md,
      fills: solid(C.surfaceSoft),
      stroke: { color: C.line },
    })
    const rows = [
      ['Тариф', 'Полный доступ · раз в год'],
      ['Сумма', '1 790 ₽'],
      ['Дата', '14 октября в 18:09'],
      ['Покупка', 'pur_mv88xfiswr935f'],
      ['Устройство', 'dev_28d51ff4dc8e'],
    ]
    rows.forEach(([key, value]) => {
      const line = row('receipt-row', { width: 322, justify: 'SPACE_BETWEEN', align: 'BASELINE', fills: [] })
      line.appendChild(text(key, { size: 11.5, font: bold, color: C.muted }))
      line.appendChild(text(value, { size: 12.5, font: extraBold }))
      receipt.appendChild(line)
      receipt.appendChild(spacer(6))
    })
    success.appendChild(receipt)

    const stored = pill('stored', '🗄️  Запись сохранена в базе данных', {
      bg: C.greenSoft,
      color: C.green700,
      size: 11.5,
      padX: 12,
      padY: 6,
    })
    success.appendChild(spacer(12))
    success.appendChild(stored)

    content.appendChild(success)
  }

  frameNode.appendChild(buildStatusBar())
  frameNode.appendChild(buildTopBar())
  frameNode.appendChild(content)
  const ctaBar = buildCtaBar()
  if (variant === 'success') ctaBar.visible = false
  frameNode.appendChild(ctaBar)

  const labelNode = sectionTitle(label, y - 22)
  labelNode.x = x
  return [frameNode, labelNode]
}

function buildTokensSection(x, y) {
  const wrap = col('Design tokens', { gap: 14, fills: [] })
  wrap.x = x
  wrap.y = y

  const label = text('Design tokens — палитра', { size: 12, font: extraBold, color: C.muted })
  wrap.appendChild(label)

  const swatches = row('swatches', { gap: 10, fills: [] })
  const palette = [
    ['Brand', C.brand],
    ['Brand 700', C.brand700],
    ['Ink', C.ink],
    ['Ink soft', C.inkSoft],
    ['Muted', C.muted],
    ['Green', C.green],
    ['Danger', C.danger],
    ['Line', C.line],
  ]
  palette.forEach(([name, color]) => {
    const item = col('swatch', { gap: 5, width: 74, align: 'CENTER', fills: [] })
    item.appendChild(rect('color', { fills: solid(color), width: 74, height: 44, radius: R.sm, stroke: { color: C.line } }))
    item.appendChild(text(name, { size: 10, font: bold, color: C.inkSoft, align: 'CENTER' }))
    const hex = `#${[color.r, color.g, color.b]
      .map((value) => Math.round(value * 255).toString(16).padStart(2, '0'))
      .join('')}`
    item.appendChild(text(hex.toUpperCase(), { size: 9, font: regular, color: C.muted, align: 'CENTER' }))
    swatches.appendChild(item)
  })
  wrap.appendChild(swatches)

  wrap.appendChild(text('Типографика', { size: 12, font: extraBold, color: C.muted }))
  const type = col('type-scale', { gap: 8, fills: [] })
  ;[
    ['H1 / 27 Black', 27, black],
    ['H2 / 17 Black', 17, black],
    ['Card price / 19 Black', 19, black],
    ['Body / 14 SemiBold', 14, semibold],
    ['Caption / 11.5 SemiBold', 11.5, semibold],
    ['Legal / 10 SemiBold', 10, semibold],
  ].forEach(([name, size, font]) => {
    const line = row('type-row', { gap: 12, align: 'BASELINE', fills: [] })
    const sample = text(name, { size, font, color: C.ink, name: name })
    line.appendChild(sample)
    line.appendChild(text(`${size}px`, { size: 10, font: regular, color: C.muted }))
    type.appendChild(line)
  })
  wrap.appendChild(type)

  wrap.appendChild(text('Радиусы: 12 / 16 / 22 / 28 / pill · Отступы: 20 px · Тап-зона: 48+ px', {
    size: 10.5,
    font: semibold,
    color: C.muted,
  }))

  return wrap
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

/** Marks everything this plugin creates, so a re-run can clean up first. */
const MARKER_KEY = 'chudoOstrovPaywall'
const MARKER_VALUE = 'v1'

async function removePreviousRun(page) {
  let previous = []
  try {
    if (typeof page.findAll === 'function') {
      previous = page.findAll(
        node => node.getPluginData && node.getPluginData(MARKER_KEY) === MARKER_VALUE,
      )
    }
  } catch (error) {
    console.warn('[paywall] cleanup skipped:', error.message)
    return 0
  }

  let removed = 0
  for (const node of previous) {
    try {
      if (node.removed !== true) {
        node.remove()
        removed += 1
      }
    } catch {
      /* ignore a single failed removal */
    }
  }
  return removed
}

async function main() {
  const page = figma.currentPage
  const failures = []

  let removed = 0
  try {
    removed = await removePreviousRun(page)
  } catch (error) {
    failures.push(`cleanup: ${error.message}`)
  }

  let family = 'fallback'
  try {
    family = await loadFonts()
  } catch (error) {
    failures.push(`fonts: ${error.message}`)
  }

  const nodes = []
  const builders = [
    ['основной экран', () => buildMainScreen(0, 60, 'Paywall / основной экран')],
    ['загрузка', () => buildStateScreen(430, 60, 'Paywall / загрузка тарифов', 'loading')],
    ['ошибка', () => buildStateScreen(860, 60, 'Paywall / ошибка загрузки', 'error')],
    ['успех', () => buildStateScreen(1290, 60, 'Paywall / успешная покупка', 'success')],
  ]

  // One broken screen must not stop the others from being drawn.
  for (const [label, build] of builders) {
    try {
      const built = await build()
      nodes.push(...built)
    } catch (error) {
      failures.push(`${label}: ${error.message}`)
      console.error(`[paywall] ${label} failed:`, error)
    }
  }

  try {
    nodes.push(buildTokensSection(0, 950))
  } catch (error) {
    failures.push(`токены: ${error.message}`)
  }

  try {
    const cover = text('Чудо-Остров · Paywall · 390 × 844 · Nunito', {
      size: 16,
      font: extraBold,
      color: C.ink,
      name: 'cover-title',
    })
    cover.x = 0
    cover.y = 16
    nodes.push(cover)
  } catch (error) {
    failures.push(`заголовок: ${error.message}`)
  }

  for (const node of nodes) {
    try {
      page.appendChild(node)
      if (node.setPluginData) node.setPluginData(MARKER_KEY, MARKER_VALUE)
    } catch (error) {
      failures.push(`appendChild: ${error.message}`)
    }
  }

  try {
    figma.viewport.scrollAndZoomIntoView(
      nodes.filter(node => node.type !== 'TEXT' || node.name !== 'cover-title'),
    )
  } catch {
    /* zooming is cosmetic */
  }

  // Диагностика прямо на канвасе: если что-то недоступно в вашей версии
  // Figma, это будет видно в файле, а не только в консоли.
  try {
    const api = [
      `figma.apiVersion = ${typeof figma.apiVersion === 'string' ? figma.apiVersion : 'недоступно'}`,
      `page.findAll = ${typeof page.findAll}`,
      `node.setPluginData = ${typeof (nodes[0] && nodes[0].setPluginData)}`,
      `figma.listAvailableFontsAsync = ${typeof figma.listAvailableFontsAsync}`,
      `figma.getAvailableFonts = ${typeof figma.getAvailableFonts}`,
      `documentAccess = dynamic-page`,
      `экранов собрано = ${nodes.filter(n => /^Paywall \/ 390x844/.test(n.name)).length} из 4`,
      `слоёв = ${nodes.length}`,
      `ошибок = ${failures.length}`,
    ].join('\n')

    const diag = col('Диагностика плагина', {
      width: 420,
      gap: 6,
      padding: 16,
      radius: R.md,
      fills: solid(C.surfaceSoft),
      stroke: { color: C.line },
    })
    diag.appendChild(text('Диагностика плагина', { size: 14, font: extraBold }))
    diag.appendChild(
      text(api, {
        size: 11,
        font: regular,
        color: C.inkSoft,
        lineHeight: 16,
        width: 388,
        name: 'api-info',
      }),
    )
    if (failures.length) {
      diag.appendChild(
        text(`Ошибки:\n${failures.join('\n')}`, {
          size: 11,
          font: regular,
          color: C.danger,
          lineHeight: 16,
          width: 388,
          name: 'error-info',
        }),
      )
    }
    diag.x = 0
    diag.y = 1250
    page.appendChild(diag)
    if (diag.setPluginData) diag.setPluginData(MARKER_KEY, MARKER_VALUE)
  } catch (error) {
    console.error('[paywall] diagnostics failed:', error)
  }

  const screens = nodes.filter(node => /^Paywall \/ 390x844/.test(node.name)).length
  if (failures.length) {
    figma.notify(`Собрано экранов: ${screens}/4. Ошибки: ${failures.join('; ')}`, {
      error: true,
      timeout: 12,
    })
    console.error('[paywall] failures:', failures)
  } else {
    const suffix = removed ? ` (заменён прошлый прогон: ${removed})` : ''
    figma.notify(`Готово: ${screens} экрана, шрифт ${family}${suffix}`, { timeout: 6 })
  }
  figma.closePlugin()
}

main().catch((error) => {
  figma.notify(`Ошибка: ${error.message}`, { error: true })
  figma.closePlugin()
})
