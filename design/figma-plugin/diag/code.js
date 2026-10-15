/**
 * Diagnostic plugin v2.
 *
 * Five isolated checks of the Plugin API calls the builder relies on.
 *
 * Lessons baked in:
 *  - figma.loadFontAsync() MUST be awaited before assigning fontName/characters,
 *    otherwise the assignment throws;
 *  - the report is written after EVERY check, so a later crash cannot erase it;
 *  - test payloads are plain ASCII to rule out font coverage issues.
 */
const lines = []
let report = null

async function initReport() {
  report = figma.createText()
  report.name = 'DIAG-report'
  const font = { family: 'Roboto', style: 'Regular' }
  await figma.loadFontAsync(font)
  report.fontName = font
  report.fontSize = 14
  report.characters = 'DIAG v2'
  report.x = 0
  report.y = 0
  figma.currentPage.appendChild(report)
}

function flush() {
  if (!report) return
  try {
    report.characters = lines.join('\n')
  } catch (error) {
    console.error('[diag] cannot write report:', error.message)
  }
}

function say(line) {
  lines.push(line)
  console.log('[diag]', line)
  flush()
}

function mkFrame(name, width, height, auto) {
  const node = figma.createFrame()
  node.name = name
  node.clipsContent = false
  node.layoutMode = auto ? 'VERTICAL' : 'NONE'
  if (auto) {
    node.primaryAxisSizingMode = height !== undefined ? 'FIXED' : 'AUTO'
    node.counterAxisSizingMode = width !== undefined ? 'FIXED' : 'AUTO'
  }
  if (width !== undefined && height !== undefined) node.resize(width, height)
  else if (width !== undefined) node.resize(width)
  return node
}

async function main() {
  say(`apiVersion=${typeof figma.apiVersion === 'string' ? figma.apiVersion : 'n/a'}`)
  say(`loadFontAsync=${typeof figma.loadFontAsync} findAll=${typeof figma.currentPage.findAll}`)

  // ---- 1. plain frame inside a frame -------------------------------------
  try {
    const parent = mkFrame('DIAG-1-parent', 200, 200, false)
    const child = mkFrame('DIAG-1-child', 50, 50, false)
    parent.appendChild(child)
    figma.currentPage.appendChild(parent)
    say(`1 plain frame in frame: parent.children=${parent.children.length}`)
  } catch (error) {
    say(`1 FAILED: ${error.message}`)
  }

  // ---- 2. frame inside an auto-layout frame ------------------------------
  try {
    const parent = mkFrame('DIAG-2-parent', 200, 200, true)
    const child = mkFrame('DIAG-2-child', 100, 40, false)
    parent.appendChild(child)
    figma.currentPage.appendChild(parent)
    say(`2 auto-layout: mode=${parent.layoutMode} children=${parent.children.length}`)
  } catch (error) {
    say(`2 FAILED: ${error.message}`)
  }

  // ---- 3. text inside a frame (font loaded first) ------------------------
  try {
    const font = { family: 'Roboto', style: 'Regular' }
    await figma.loadFontAsync(font)
    const parent = mkFrame('DIAG-3-parent', 240, 100, true)
    const node = figma.createText()
    node.name = 'DIAG-3-text'
    node.fontName = font
    node.fontSize = 16
    node.characters = 'Hello paywall'
    parent.appendChild(node)
    figma.currentPage.appendChild(parent)
    say(`3 text in frame: children=${parent.children.length} chars=${node.characters.length}`)
  } catch (error) {
    say(`3 FAILED: ${error.message}`)
  }

  // ---- 4. page -> frame -> column -> text --------------------------------
  try {
    const font = { family: 'Roboto', style: 'Regular' }
    await figma.loadFontAsync(font)
    const screen = mkFrame('DIAG-4-screen', 390, 844, true)
    const column = mkFrame('DIAG-4-column', 390, undefined, true)
    const node = figma.createText()
    node.name = 'DIAG-4-text'
    node.fontName = font
    node.fontSize = 16
    node.characters = 'Nested text'
    column.appendChild(node)
    screen.appendChild(column)
    figma.currentPage.appendChild(screen)
    say(`4 nesting: screen=${screen.children.length} column=${column.children.length}`)
    // re-read through the page, the way the REST API sees it
    const found = figma.currentPage.findOne(n => n.name === 'DIAG-4-screen')
    const fresh = found ? found.children.length : -1
    say(`4 via page.findOne: screen.children=${fresh}`)
  } catch (error) {
    say(`4 FAILED: ${error.message}`)
  }

  // ---- 5. Nunito, the font the design uses -------------------------------
  try {
    const font = { family: 'Nunito', style: 'Regular' }
    await figma.loadFontAsync(font)
    const parent = mkFrame('DIAG-5-parent', 300, 120, true)
    const node = figma.createText()
    node.fontName = font
    node.characters = 'Nunito ok'
    parent.appendChild(node)
    figma.currentPage.appendChild(parent)
    say(`5 Nunito loaded: children=${parent.children.length} chars=${node.characters.length}`)
  } catch (error) {
    say(`5 Nunito unavailable: ${error.message}`)
  }

  flush()
  const failed = lines.filter(line => /FAILED|unavailable/.test(line)).length
  figma.notify(`Диагностика: проверок ${lines.length}, проблем ${failed}`, {
    timeout: 8,
    error: failed > 0,
  })
  figma.closePlugin()
}

initReport()
  .then(main)
  .catch((error) => {
    say(`FATAL: ${error.message}`)
    flush()
    figma.notify(`Диагностика упала: ${error.message}`, { error: true, timeout: 10 })
    figma.closePlugin()
  })
