/**
 * Diagnostic plugin v3 — deliberately font-free.
 *
 * Two earlier attempts produced an empty report because they assigned
 * fontName/characters without a successful figma.loadFontAsync(), which throws
 * in the plugin sandbox and aborts the run.
 *
 * This version uses only frames and rectangles and encodes its findings into
 * LAYER NAMES, so the outcome is readable through the REST API and cannot be
 * lost by a later crash.
 *
 * Layer naming:  DIAG|<case>|before=<n>|after=<n>|recheck=<n>|threw=<...>
 */

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

function mkRect(name, width, height) {
  const node = figma.createRectangle()
  node.name = name
  node.resize(width, height)
  return node
}

const results = []

function runCase(label, build) {
  let before = -1
  let after = -1
  let recheck = -1
  let threw = 'no'
  let parent = null
  try {
    const built = build()
    parent = built.parent
    const kids = built.children
    before = parent.children.length - kids.length
    kids.forEach(child => parent.appendChild(child))
    after = parent.children.length
    figma.currentPage.appendChild(parent)
    recheck = parent.children.length
  } catch (error) {
    threw = 'yes:' + error.message
    console.error('[diag] ' + label + ': ' + error.message)
  }
  const name = 'DIAG|' + label + '|before=' + before + '|after=' + after + '|recheck=' + recheck + '|threw=' + threw
  results.push(name)
  // Encode the outcome into the layer name so the REST API can read it.
  try {
    parent.name = name
  } catch (error) {
    console.error('[diag] cannot rename parent: ' + error.message)
  }
  return name
}

function main() {
  runCase('rect-in-plain-frame', () => {
    const parent = mkFrame('DIAG-p1', 160, 120, false)
    const child = mkRect('DIAG-p1-rect', 60, 40)
    return { parent: parent, children: [child] }
  })

  runCase('rect-in-autolayout', () => {
    const parent = mkFrame('DIAG-p2', 160, 120, true)
    const child = mkRect('DIAG-p2-rect', 60, 40)
    return { parent: parent, children: [child] }
  })

  runCase('frame-in-plain-frame', () => {
    const parent = mkFrame('DIAG-p3', 200, 200, false)
    const child = mkFrame('DIAG-p3-child', 80, 60, false)
    return { parent: parent, children: [child] }
  })

  runCase('frame-in-autolayout', () => {
    const parent = mkFrame('DIAG-p4', 200, 200, true)
    const child = mkFrame('DIAG-p4-child', 80, 60, false)
    return { parent: parent, children: [child] }
  })

  runCase('nested-two-levels', () => {
    const screen = mkFrame('DIAG-p5-screen', 390, 844, true)
    const column = mkFrame('DIAG-p5-column', 390, undefined, true)
    const rect = mkRect('DIAG-p5-rect', 100, 50)
    column.appendChild(rect)
    const columnKids = column.children.length
    screen.appendChild(column)
    const screenKids = screen.children.length
    figma.currentPage.appendChild(screen)
    return {
      parent: screen,
      children: [],
      note: 'column=' + columnKids + ',screen=' + screenKids,
    }
  })

  figma.notify('Диагностика v3: ' + results.length + ' проверок', { timeout: 6 })
  figma.closePlugin()
}

try {
  main()
} catch (error) {
  try {
    const node = mkRect('DIAG|FATAL|' + error.message, 100, 20)
    figma.currentPage.appendChild(node)
  } catch (inner) {
    /* nothing else we can do */
  }
  figma.notify('Диагностика v3 упала: ' + error.message, { error: true, timeout: 10 })
  figma.closePlugin()
}
