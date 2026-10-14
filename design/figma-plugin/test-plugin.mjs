/**
 * Smoke test for the Figma builder plugin.
 *
 * Figma's plugin sandbox is not available from the CLI, so this file stubs the
 * parts of the Plugin API the builder touches and runs code.js end to end.
 * It catches typos, wrong property names and broken node assembly before the
 * plugin is imported into a real Figma file.
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

function makeNode(type) {
  nodeCount += 1
  const node = {
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
    resize(width, height) {
      this.width = width
      this.height = height
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
  }
  return node
}

const loadableFonts = new Set([
  'Nunito/Regular',
  'Nunito/SemiBold',
  'Nunito/Bold',
  'Nunito/ExtraBold',
  'Nunito/Black',
])

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
  currentPage: { appendChild: () => {} },
  viewport: { scrollAndZoomIntoView: () => {} },
}

// Execute the plugin with `figma` in scope.
const run = new Function('figma', `"use strict";\n${source}\n`)
run(figma)

await new Promise(resolveWait => setTimeout(resolveWait, 800))

const textNodes = created.filter(node => node.type === 'TEXT')
const emptyNames = created.filter(node => !node.name)
const problems = []

if (notifications.some(message => /Ошибка/.test(message))) {
  problems.push(`plugin reported an error: ${notifications.join(' | ')}`)
}
if (textNodes.length < 40) {
  problems.push(`expected the full screen, only ${textNodes.length} text nodes were created`)
}
if (emptyNames.length) {
  problems.push(`${emptyNames.length} nodes have no name`)
}

console.log(`nodes created : ${created.length} (${textNodes.length} text)`)
console.log(`notification  : ${notifications.join(' | ') || '—'}`)
console.log(`top-level x   : ${[...new Set(created.filter(n => n.x > 0).map(n => n.x))].join(', ')}`)

if (problems.length) {
  console.error('\nFAILED:\n- ' + problems.join('\n- '))
  process.exit(1)
}
console.log('\nSMOKE TEST OK')
