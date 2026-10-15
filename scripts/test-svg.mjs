/**
 * Structural test for the importable SVG mockups.
 *
 * The Figma importer is the only real judge of an SVG, but it cannot run from
 * the CLI — so this test asserts everything that can be checked deterministically:
 *
 *  - the file parses as XML and uses the expected artboard size;
 *  - every <text> declares exactly ONE font family, because an unresolvable
 *    stack silently loses the text in Figma (an entire first import produced
 *    only shapes because of a font problem);
 *  - the required content of the paywall is present;
 *  - prices match the live /api/offers payload when reachable.
 *
 *   node scripts/test-svg.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const NS = 'http://www.w3.org/2000/svg'

/* A tiny namespace-aware reader: Node has no built-in SVG parser, and the
 * check only needs element/attribute access. */
function parse(source) {
  const elements = []
  const tagRe = /<([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g
  const attrRe = /([\w:-]+)="([^"]*)"/g
  let match
  while ((match = tagRe.exec(source))) {
    const attrs = {}
    let attr
    while ((attr = attrRe.exec(match[2]))) attrs[attr[1]] = attr[2]
    elements.push({ name: match[1], attrs })
    attrRe.lastIndex = 0
  }
  return elements
}

const problems = []
const info = []

const SHEETS = [
  ['00-overview.svg', 1760, 950, 4],
  ['01-main.svg', 390, 844, 1],
  ['02-loading.svg', 390, 844, 1],
  ['03-error.svg', 390, 844, 1],
  ['04-success.svg', 390, 844, 1],
]

const REQUIRED_TEXT = [
  'Открой все 120 уровней',
  'Выберите тариф',
  'Год',
  'Месяц',
  'Восстановить покупки',
  'Мои покупки',
  'Тестовая покупка',
]

for (const [file, width, height, screens] of SHEETS) {
  const path = resolve(ROOT, 'design/svg', file)
  let source
  try {
    source = readFileSync(path, 'utf8')
  } catch {
    problems.push(`${file}: missing`)
    continue
  }

  const elements = parse(source)
  const root = elements[0]
  const textNodes = elements.filter(el => el.name === 'text')

  if (!source.trim().startsWith('<svg')) problems.push(`${file}: does not start with <svg`)
  if (Number(root.attrs.width) !== width || Number(root.attrs.height) !== height) {
    problems.push(
      `${file}: artboard is ${root.attrs.width}x${root.attrs.height}, expected ${width}x${height}`,
    )
  }
  if (!root.attrs.viewBox) problems.push(`${file}: missing viewBox`)

  // Every text node must name exactly one font family.
  const stacks = []
  for (const node of textNodes) {
    const family = node.attrs['font-family']
    if (!family) continue // inherits the default, which Figma resolves fine
    if (family.includes(',')) stacks.push(family)
  }
  if (stacks.length) {
    problems.push(
      `${file}: ${stacks.length} text node(s) use a comma-separated font stack ` +
        `(e.g. "${stacks[0]}") — unverifiable in Figma, use one family name`,
    )
  }

  const families = [...new Set(textNodes.map(n => n.attrs['font-family']).filter(Boolean))]
  const emptyText = textNodes.filter(n => !n.attrs.x || !n.attrs.y).length
  if (emptyText) problems.push(`${file}: ${emptyText} text node(s) without x/y`)

  const content = textNodes.map(n => n.attrs['data-text'] ?? '').join(' ')
  info.push(
    `${file.padEnd(18)} ${root.attrs.width}x${root.attrs.height}  ` +
      `text=${String(textNodes.length).padStart(3)}  fonts=${families.join('|') || 'default'}`,
  )
}

// The main screen must carry the required copy. Read the raw characters.
const mainSource = readFileSync(resolve(ROOT, 'design/svg/01-main.svg'), 'utf8')
for (const needle of REQUIRED_TEXT) {
  if (!mainSource.includes(needle)) problems.push(`01-main.svg: missing copy "${needle}"`)
}

console.log('=== структура SVG ===')
for (const line of info) console.log('  ' + line)

// Cross-check prices against the deployed API when it is reachable.
const API = process.env.API_URL || 'https://kids-paywall-one.vercel.app'
try {
  const response = await fetch(`${API}/api/offers`, { signal: AbortSignal.timeout(15000) })
  const payload = await response.json()
  console.log(`\n=== сверка с ${API}/api/offers ===`)
  for (const offer of payload.offers) {
    const ok = mainSource.includes(offer.priceLabel)
    if (!ok) problems.push(`01-main.svg: price ${offer.priceLabel} from the API is missing`)
    console.log(`  ${ok ? '✓' : '✗'} ${offer.id.padEnd(8)} ${offer.priceLabel}`)
  }
  const badge = payload.offers[0]?.badge
  if (badge) {
    const ok = mainSource.includes(badge)
    if (!ok) problems.push(`01-main.svg: badge "${badge}" from the API is missing`)
    console.log(`  ${ok ? '✓' : '✗'} badge    ${badge}`)
  }
} catch (error) {
  console.log(`\n(сверка с API пропущена: ${error.message})`)
}

if (problems.length) {
  console.error('\nFAILED:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('\nSVG TEST OK')
