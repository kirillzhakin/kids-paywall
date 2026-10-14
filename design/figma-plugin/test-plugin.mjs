/**
 * Local smoke test for the Figma builder plugin.
 *
 * Figma's plugin sandbox cannot run from the CLI, so this file:
 *  1. stubs the parts of the Plugin API the builder touches,
 *  2. runs code.js end to end,
 *  3. computes auto-layout geometry the way Figma would (padding, gaps,
 *     fixed/auto sizing, text height) so it can prove that content really is
 *     laid out inside each screen instead of being covered by a full-bleed
 *     layer.
 *
 *   node design/figma-plugin/test-plugin.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = readFileSync(resolve(here, 'code.js'), 'utf8')

const created = []
const notifications = []
let nodeCount = 0
let problemsDetected = false

const loadableFonts = new Set([
  'Nunito/Regular',
  'Nunito/SemiBold',
  'Nunito/Bold',
  'Nunito/ExtraBold',
  'Nunito/Black',
])

function makeNode(type) {
  nodeCount += 1
  return {
    id: `node:${nodeCount}`,
    type,
    name: '',
    children: [],
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fills: [],
    strokes: [],
    effects: [],
    layoutMode: 'NONE',
    layoutPositioning: 'AUTO',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    itemSpacing: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    characters: '',
    fontSize: 14,
    lineHeight: { unit: 'AUTO' },
    // Figma's real semantics: a resize sticks only on axes that are FIXED.
    // A height that was never requested must stay undefined so the AUTO axis
    // is computed from the children instead of keeping the default 100.
    resize(width, height) {
      if (width !== undefined) {
        this.requestedWidth = width
        if (this.counterAxisSizingMode === 'FIXED') this.width = width
      }
      if (height !== undefined) {
        this.requestedHeight = height
        if (this.primaryAxisSizingMode === 'FIXED') this.height = height
      }
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    getPluginData(key) {
      return (this.pluginData && this.pluginData[key]) || ''
    },
    setPluginData(key, value) {
      this.pluginData = { ...(this.pluginData || {}), [key]: value }
    },
    remove() {
      this.removed = true
      const parent = created.find(node => node.children.includes(this))
      if (parent) parent.children = parent.children.filter(child => child !== this)
      // Figma removes the whole subtree: leaving descendants behind would let
      // a second run pile up duplicates inside the file.
      for (const descendant of descendantsOf(this)) pageNodes.delete(descendant)
      pageNodes.delete(this)
    },
  }
}

function descendantsOf(node) {
  return node.children.flatMap(child => [child, ...descendantsOf(child)])
}

/** Nodes currently placed on the page (appendChild on the page adds them). */
const pageNodes = new Set()

function collect(node) {
  pageNodes.add(node)
  for (const child of node.children) collect(child)
}

const figma = {
  createFrame: () => {
    const node = makeNode('FRAME')
    created.push(node)
    return node
  },
  createText: () => {
    const node = makeNode('TEXT')
    created.push(node)
    return node
  },
  createVector: () => {
    const node = makeNode('VECTOR')
    created.push(node)
    return node
  },
  loadFontAsync: async (font) => {
    const key = `${font.family}/${font.style}`
    if (!loadableFonts.has(key)) throw new Error(`Font unavailable: ${key}`)
    return font
  },
  notify: (message) => notifications.push(message),
  closePlugin: () => {},
  currentPage: {
    appendChild: (node) => {
      collect(node)
    },
    findAll: (predicate) => [...pageNodes].filter(node => predicate(node)),
  },
  viewport: { scrollAndZoomIntoView: () => {} },
}

/* ------------------------------------------------------------------ */
/* geometry: mimic Figma auto-layout                                   */
/* ------------------------------------------------------------------ */

const isHorizontal = node => node.layoutMode === 'HORIZONTAL'
const hasAutoLayout = node => node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL'

function textHeight(node) {
  const lineHeight =
    node.lineHeight && node.lineHeight.unit === 'PIXELS' ? node.lineHeight.value : node.fontSize * 1.3
  const charsPerLine = Math.max(8, Math.floor(node.width / (node.fontSize * 0.52)))
  const lines = Math.max(1, Math.ceil((node.characters || ' ').length / charsPerLine))
  return lines * lineHeight
}

/**
 * Bottom-up auto-layout pass, mirroring Figma:
 *  - AUTO axes are recomputed from the children,
 *  - FIXED axes keep their requested size,
 *  - a child with layoutGrow absorbs the leftover space,
 *  - spacing contributes only between visible children.
 */
function layout(node, offsetX = 0, offsetY = 0) {
  node.absX = offsetX
  node.absY = offsetY

  if (node.type === 'TEXT') {
    node.width = node.requestedWidth ?? node.width
    node.height = textHeight(node)
    node.computedWidth = node.width
    node.computedHeight = node.height
    return { width: node.width, height: node.height }
  }

  if (!hasAutoLayout(node)) {
    for (const child of node.children) {
      layout(child, offsetX + child.x, offsetY + child.y)
    }
    node.computedWidth = node.requestedWidth ?? node.width
    node.computedHeight = node.requestedHeight ?? node.height
    return { width: node.computedWidth, height: node.computedHeight }
  }

  const horizontal = isHorizontal(node)
  const auto = node.children.filter(child => child.layoutPositioning !== 'ABSOLUTE')
  const gap = node.itemSpacing ?? 0

  let main = 0
  let cross = 0
  const sizes = []

  auto.forEach((child, index) => {
    const size = layout(child, offsetX, offsetY)
    sizes.push(size)
    main += (horizontal ? size.width : size.height) + (index > 0 ? gap : 0)
    cross = Math.max(cross, horizontal ? size.height : size.width)
  })

  const outerPaddingMain = horizontal
    ? node.paddingLeft + node.paddingRight
    : node.paddingTop + node.paddingBottom
  const outerPaddingCross = horizontal
    ? node.paddingTop + node.paddingBottom
    : node.paddingLeft + node.paddingRight

  const contentMain = main + outerPaddingMain
  const contentCross = cross + outerPaddingCross
  const axisFixed = horizontal
    ? node.counterAxisSizingMode === 'FIXED'
    : node.primaryAxisSizingMode === 'FIXED'

  const finalWidth = horizontal
    ? axisFixed && node.requestedWidth !== undefined
      ? node.requestedWidth
      : contentMain
    : node.requestedWidth !== undefined && node.counterAxisSizingMode === 'FIXED'
      ? node.requestedWidth
      : contentCross
  const finalHeight = horizontal
    ? node.requestedHeight !== undefined && node.counterAxisSizingMode === 'FIXED'
      ? node.requestedHeight
      : contentCross
    : axisFixed && node.requestedHeight !== undefined
      ? node.requestedHeight
      : contentMain

  node.width = finalWidth
  node.height = finalHeight
  node.computedWidth = finalWidth
  node.computedHeight = finalHeight

  // Position the children and let a growing child absorb the leftover space.
  const innerMain = (horizontal ? finalWidth : finalHeight) - outerPaddingMain
  const leftover = Math.max(0, innerMain - main)
  const growIndex = auto.findIndex(child => child.layoutGrow === 1)

  let cursor = horizontal
    ? offsetX + node.paddingLeft
    : offsetY + node.paddingTop

  auto.forEach((child, index) => {
    const size = sizes[index]
    let childW = size.width
    let childH = size.height
    if (index === growIndex) {
      if (horizontal) childW += leftover
      else childH += leftover
    }

    const crossStart = horizontal ? offsetY + node.paddingTop : offsetX + node.paddingLeft
    const childX = horizontal ? cursor : crossStart
    const childY = horizontal ? crossStart : cursor

    // re-run to fix nested absolute positions with the final offsets
    layout(child, childX, childY)
    child.computedWidth = childW
    child.computedHeight = childH

    if (horizontal) cursor += (index === growIndex ? childW : size.width) + gap
    else cursor += (index === growIndex ? childH : size.height) + gap
  })

  for (const child of node.children) {
    if (child.layoutPositioning === 'ABSOLUTE') {
      layout(child, offsetX + child.x, offsetY + child.y)
    }
  }

  return { width: finalWidth, height: finalHeight }
}

/* ------------------------------------------------------------------ */
/* run the plugin and inspect the result                               */
/* ------------------------------------------------------------------ */

const run = new Function('figma', `"use strict";\n${source}\n`)

let runNumber = 0
const runTag = new WeakMap()

/** Runs the plugin once and tags everything it created with the run number. */
async function runPlugin() {
  runNumber += 1
  const before = created.length
  await run(figma)
  await new Promise(resolveWait => setTimeout(resolveWait, 600))
  for (const node of created.slice(before)) runTag.set(node, runNumber)
  return created.slice(before)
}

const firstRunNodes = await runPlugin()
const nodesOnPageAfterFirstRun = pageNodes.size

// Second run: must clean up after itself instead of stacking a duplicate screen.
await runPlugin()
const nodesOnPageAfterSecondRun = pageNodes.size

const problems = []
const screens = firstRunNodes.filter(
  node => node.type === 'FRAME' && /^Paywall \/ 390x844/.test(node.name),
)
const textNodes = firstRunNodes.filter(node => node.type === 'TEXT')

if (notifications.some(message => /Ошибка/.test(message))) {
  problems.push(`plugin reported an error: ${notifications.join(' | ')}`)
}
if (screens.length !== 4) {
  problems.push(`expected 4 screen frames, found ${screens.length}`)
}
if (textNodes.length < 40) {
  problems.push(`expected the full screen, only ${textNodes.length} text nodes were created`)
}
if (nodesOnPageAfterSecondRun !== nodesOnPageAfterFirstRun) {
  problems.push(
    `re-running the plugin did not clean up: ${nodesOnPageAfterFirstRun} nodes after the first run, ` +
      `${nodesOnPageAfterSecondRun} after the second`,
  )
}

console.log('=== геометрия собранных экранов ===')
for (const screen of screens) {
  layout(screen)

  // A screen must be a 390x844 frame, and its visible children must fit inside.
  if (Math.round(screen.computedWidth) !== 390 || Math.round(screen.computedHeight) !== 844) {
    problems.push(
      `${screen.name}: frame is ${screen.computedWidth}x${screen.computedHeight}, expected 390x844`,
    )
  }

  // The regression that shipped to Figma: a full-bleed absolutely positioned
  // layer painted over everything inside an auto-layout frame.
  const absolute = screen.children.filter(child => child.layoutPositioning === 'ABSOLUTE')
  if (absolute.length) {
    problems.push(
      `${screen.name}: ${absolute.length} absolutely positioned child(ren) inside auto-layout ` +
        `(${absolute.map(c => c.name).join(', ')}) — they paint above the content`,
    )
  }

  const gradients = (screen.fills || []).filter(fill => String(fill.type).startsWith('GRADIENT_'))
  if (gradients.length !== 2) {
    problems.push(`${screen.name}: expected 2 background gradients, found ${gradients.length}`)
  }

  // A screen must keep its fixed artboard size; AUTO sizing would let Figma
  // shrink it to the content height.
  if (screen.primaryAxisSizingMode !== 'FIXED' || screen.counterAxisSizingMode !== 'FIXED') {
    problems.push(
      `${screen.name}: sizing modes are ${screen.primaryAxisSizingMode}/${screen.counterAxisSizingMode}, expected FIXED/FIXED`,
    )
  }

  const blocks = Object.fromEntries(
    screen.children.map(child => [child.name, child.computedHeight]),
  )
  if (Math.abs(blocks['status-bar'] - 44) > 1) {
    problems.push(`${screen.name}: status bar is ${blocks['status-bar']}px, expected 44`)
  }
  if (blocks['top-bar'] > 60) {
    problems.push(`${screen.name}: top bar is ${blocks['top-bar']}px — the resize default leaked in`)
  }
  if (blocks['cta-bar'] > 180) {
    problems.push(`${screen.name}: CTA bar is ${blocks['cta-bar']}px — the resize default leaked in`)
  }

  const textsBelow = countTexts(screen)
  if (textsBelow < 10) {
    problems.push(`${screen.name}: only ${textsBelow} text layers inside — content looks missing`)
  }

  const strip = [
    `${screen.name.padEnd(38)} ${Math.round(screen.computedWidth)}x${Math.round(screen.computedHeight)}`,
    `gradients=${gradients.length}`,
    `layers=${countLayers(screen)}`,
    `texts=${textsBelow}`,
  ].join('  ')
  console.log('  ' + strip)

  for (const child of screen.children) {
    console.log(
      `      • ${String(child.name).padEnd(16)} y=${String(Math.round(child.absY - screen.absY)).padStart(4)}` +
        ` h=${String(Math.round(child.computedHeight)).padStart(4)} layers=${countLayers(child)}`,
    )
  }
}

function countTexts(node) {
  return (
    (node.type === 'TEXT' ? 1 : 0) +
    node.children.reduce((sum, child) => sum + countTexts(child), 0)
  )
}

function countLayers(node) {
  return node.children.reduce((sum, child) => sum + 1 + countLayers(child), 0)
}

// No stray "gradient layer" nodes should exist any more.
const strayWashes = firstRunNodes.filter(node => node.name === 'top-wash')
if (strayWashes.length) {
  problems.push(`${strayWashes.length} separate "top-wash" layers found — must be a frame fill`)
}

console.log(`\nnodes per run : ${firstRunNodes.length} (${textNodes.length} text)`)
console.log(`запусков      : ${runNumber}`)
console.log(`слоёв на странице: ${nodesOnPageAfterFirstRun} → ${nodesOnPageAfterSecondRun} (повторный запуск)`)
console.log(`notification  : ${notifications.join(' | ') || '—'}`)

if (problems.length || problemsDetected) {
  console.error('\nFAILED:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('\nSMOKE TEST OK — контент лежит внутри фреймов, фон — заливка фрейма')
