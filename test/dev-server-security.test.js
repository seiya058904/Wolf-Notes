import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdtemp, mkdir, writeFile, readFile, unlink, symlink} from 'node:fs/promises'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {createServer, loadConfigFromFile} from 'vite'
import {createServer as createDocsServer} from 'vitepress'

const root = fileURLToPath(new URL('../', import.meta.url))

test('application and documentation defaults stay on loopback; LAN is explicit', async () => {
  const {config} = await loadConfigFromFile({command: 'serve', mode: 'development'}, path.join(root, 'vite.config.js'))
  assert.equal(config.server.host, '127.0.0.1')
  const {scripts} = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  for (const name of ['docs:dev', 'docs:preview']) assert.match(scripts[name], /--host 127\.0\.0\.1(?: |$)/)
  for (const name of ['dev:lan', 'docs:dev:lan']) assert.match(scripts[name], /--host 0\.0\.0\.0(?: |$)/)
})

for (const kind of ['app', 'docs']) {
  test(`${kind} dev server denies only synthetic out-of-root canary requests`, async t => {
    // Keep the fixture on the server's volume: Windows raw-FS middleware
    // resolves against that volume. A cross-volume 404 would prove nothing.
    const fixture = await mkdtemp(path.join(path.dirname(path.resolve(root)), 'wolf-security-'))
    const canary = path.join(fixture, 'outside-canary.txt')
    const marker = `NON_SENSITIVE_CANARY_${randomUUID()}`
    await writeFile(canary, marker)
    let server
    let dependencyLink
    let control
    const report = []
    try {
      if (kind === 'app') {
        server = await createServer({root, configFile: path.join(root, 'vite.config.js'), envFile: false, logLevel: 'silent', server: {host: '127.0.0.1', port: 0}})
      } else {
        const docs = path.join(fixture, 'docs')
        await mkdir(path.join(docs, '.vitepress'), {recursive: true})
        dependencyLink = path.join(docs, 'node_modules')
        await symlink(path.join(root, 'node_modules'), dependencyLink, 'junction')
        await writeFile(path.join(docs, 'index.md'), '# Synthetic documentation fixture\n')
        await writeFile(path.join(docs, '.vitepress', 'config.mjs'), `export {default} from ${JSON.stringify(pathToFileURL(path.join(root, 'docs/.vitepress/config.js')).href)}\n`)
        server = await createDocsServer(docs, {host: '127.0.0.1', port: 0, fs: {allow: [docs]}})
      }
      await server.listen()
      const address = server.httpServer.address()
      assert.equal(address.address, '127.0.0.1')
      const base = `http://127.0.0.1:${address.port}`
      assert.equal((await fetch(base + server.config.base, {signal: AbortSignal.timeout(10000)})).status, 200)
      control = path.join(server.config.root, `wolf-control-${randomUUID()}.txt`)
      await writeFile(control, 'PUBLIC_CONTROL_CANARY', {flag: 'wx'})
      const positive = await fetch(`${base}${server.config.base}@fs/${control.replaceAll('\\', '/')}`, {signal: AbortSignal.timeout(10000)})
      assert.equal(positive.status, 200)
      assert.equal(await positive.text(), 'PUBLIC_CONTROL_CANARY')
      for (const suffix of ['', '?raw', '?raw??', '?import&raw??', '?raw?import', '?raw&import']) {
        const url = `${base}${server.config.base}@fs/${canary.replaceAll('\\', '/')}${suffix}`
        const response = await fetch(url, {signal: AbortSignal.timeout(10000)})
        report.push({suffix, status: response.status, leaked: (await response.text()).includes(marker)})
      }
      t.diagnostic(JSON.stringify(report))
      assert.ok(report.every(row => row.status >= 400 && !row.leaked), JSON.stringify(report))
    } finally {
      await server?.close()
      await unlink(canary)
      if (control) await unlink(control)
      if (dependencyLink) await unlink(dependencyLink)
    }
  })
}
