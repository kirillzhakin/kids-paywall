/**
 * Dev server helper shared by the screenshot scripts.
 *
 * Boots `nuxt dev` on a fixed port, waits for the paywall to answer, and
 * tears the process down afterwards.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const HOST = 'localhost'

export async function startServer({ port = 3210, cwd, log = true } = {}) {
  const child = spawn('node', ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--port', String(port)], {
    cwd,
    env: {
      ...process.env,
      NUXT_TELEMETRY_DISABLED: '1',
      // Node < 22.12 needs this to let oxc-walker require() ESM modules.
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--experimental-require-module']
        .filter(Boolean)
        .join(' '),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const lines = []
  const onData = (chunk) => {
    const text = String(chunk)
    lines.push(text)
    if (log && /Local:|ERROR|error/i.test(text)) process.stdout.write(text)
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)

  const baseUrl = `http://${HOST}:${port}`
  const deadline = Date.now() + 120_000

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/offers`)
      if (response.ok) return { baseUrl, child, stop: () => stop(child) }
    } catch {
      /* not up yet */
    }
    await sleep(700)
  }

  stop(child)
  throw new Error(`Server did not start. Log tail:\n${lines.join('').slice(-2000)}`)
}

function stop(child) {
  if (!child.killed) child.kill('SIGTERM')
}

export { sleep }
