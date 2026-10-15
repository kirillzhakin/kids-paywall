/**
 * Diagnostic plugin: five isolated checks of the Plugin API calls the builder
 * relies on. Writes the outcome of every check into one text node on canvas.
 *
 * Run it from Figma and read the "DIAG 2" node, or read it through the REST API.
 */
const lines = []
const SAY = (line) => {
  lines.push(line)
  console.log('[diag]', line)
}

const report = figma.createText()
report.name = 'DIAG-report'
report.fontName = { family: 'Roboto', style: 'Regular' }
report.fontSize = 14
report.characters = 'pending'
report.x = 0
report.y = 0
figma.currentPage.appendChild(report)

/** Mirrors the builder: creates a frame with a requested size. */
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
  SAY(`apiVersion=${typeof figma.apiVersion === 'string' ? figma.apiVersion : 'n/a'}`)

  // ---- 1. appendChild of a frame into a frame, no auto-layout -------------
  try {
    const parent = mkFrame('DIAG-1-parent', 200, 200, false)
    const child = mkFrame('DIAG-1-child', 50, 50, false)
    parent.appendChild(child)
    figma.currentPage.appendChild(parent)
    SAY(`1 plain frame in frame : children=${parent.children.length}`)
  } catch (error) {
    SAY(`1 FAILED: ${error.message}`)
  }

  // ---- 2. appendChild into an auto-layout frame --------------------------
  try {
    const parent = mkFrame('DIAG-2-parent', 200, 200, true)
    const child = mkFrame('DIAG-2-child', 100, 40, false)
    parent.appendChild(child)
    figma.currentPage.appendChild(parent)
    SAY(`2 auto-layout frame   : children=${parent.children.length} mode=${parent.layoutMode}`)
  } catch (error) {
    SAY(`2 FAILED: ${error.message}`)
  }

  // ---- 3. text inside a frame -------------------------------------------
  try {
    const parent = mkFrame('DIAG-3-parent', 240, 100, true)
    const node = figma.createText()
    node.name = 'DIAG-3-text'
    node.fontName = { family: 'Roboto', style: 'Regular' }
    node.fontSize = 16
    node.characters = 'Привет'
    parent.appendChild(node)
    figma.currentPage.appendChild(parent)
    SAY(`3 text in frame       : children=${parent.children.length} chars=${node.characters.length}`)
  } catch (error) {
    SAY(`3 FAILED: ${error.message}`)
  }

  // ---- 4. nested: page → frame → column → text --------------------------
  try {
    const screen = mkFrame('DIAG-4-screen', 390, 844, true)
    const column = mkFrame('DIAG-4-column', 390, undefined, true)
    const node = figma.createText()
    node.name = 'DIAG-4-text'
    node.fontName = { family: 'Roboto', style: 'Regular' }
    node.fontSize = 16
    node.characters = 'Вложенный текст'
    column.appendChild(node)
    screen.appendChild(column)
    figma.currentPage.appendChild(screen)
    SAY(`4 page→frame→column→text: screen=${screen.children.length} column=${column.children.length}`)
  } catch (error) {
    SAY(`4 FAILED: ${error.message}`)
  }

  // ---- 5. two texts, second font family ---------------------------------
  try {
    const parent = mkFrame('DIAG-5-parent', 300, 120, true)
    const a = figma.createText()
    a.fontName = { family: 'Inter', style: 'Regular' }
    a.characters = 'Inter текст'
    const b = figma.createText()
    b.fontName = { family: 'Nunito', style: 'Regular' }
    b.characters = 'Nunito текст'
    parent.appendChild(a)
    parent.appendChild(b)
    figma.currentPage.appendChild(parent)
    SAY(`5 two text layers     : children=${parent.children.length}`)
  } catch (error) {
    SAY(`5 FAILED: ${error.message}`)
  }

  report.characters = lines.join('\n')
  figma.notify(`Диагностика: ${lines.filter(l => /FAILED/.test(l)).length} ошибок из 5 проверок`, {
    timeout: 8,
  })
  figma.closePlugin()
}

main().catch((error) => {
  SAY(`FATAL: ${error.message}`)
  try {
    report.characters = lines.join('\n')
  } catch {
    /* ignore */
  }
  figma.notify(`Диагностика упала: ${error.message}`, { error: true, timeout: 10 })
  figma.closePlugin()
})
