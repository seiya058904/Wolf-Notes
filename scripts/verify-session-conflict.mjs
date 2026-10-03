import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url)
const {chromium} = require(process.env.QA_PLAYWRIGHT_PACKAGE || 'playwright')
let server
let url = process.env.QA_BASE_URL
if (!url) {
  const root = path.resolve('dist')
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/Wolf-Notes\//, '/')
    let file = path.resolve(root, '.' + rel)
    if (!file.startsWith(root + path.sep) && file !== root) return res.writeHead(403).end()
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (!fs.existsSync(file)) return res.writeHead(404).end()
    const types = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json'}
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}/`
}
const browser = await chromium.launch()
const results = []
try {
  // Run the same real two-page flow with and without the browser's Web Locks.
  for (const webLocks of [true, false]) {
    const context = await browser.newContext()
    if (!webLocks) await context.addInitScript(() => Object.defineProperty(navigator, 'locks', {value: undefined}))
    const a = await context.newPage(), b = await context.newPage(), errors = []
    for (const page of [a, b]) page.on('pageerror', error => errors.push(error.message))
    await a.goto(url)
    await a.getByRole('button', {name: '开始狼人杀对局', exact: true}).click()
    await a.getByRole('button', {name: '1号', exact: true}).click()
    await a.getByRole('button', {name: '平民', exact: true}).click()
    await a.getByRole('button', {name: '下一步', exact: true}).click()
    await a.getByRole('button', {name: '确认并进入记录台', exact: true}).click()
    await b.goto(url)
    await b.getByRole('button', {name: '继续上一局', exact: true}).click()
    await a.getByPlaceholder('写下你的整体判断…').fill('A_NEW_NOTE_KEEP')
    const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem('lrsNotesGameSession')))
    await a.waitForFunction(() => JSON.parse(localStorage.getItem('lrsNotesGameSession')).overallNotes === 'A_NEW_NOTE_KEEP')
    const before = await saved(a)
    await b.getByRole('button', {name: '进入第一天', exact: true}).click()
    await b.getByText(/另一页面已更新/).first().waitFor()
    assert.deepEqual(await saved(b), before, 'stale round advance must not rewrite the newer snapshot')
    // Unsaved local input stays available to copy instead of being overwritten.
    await b.getByPlaceholder('写下你的整体判断…').fill('B_UNSAVED_NOTE')
    await b.waitForTimeout(100)
    assert.equal((await saved(b)).overallNotes, 'A_NEW_NOTE_KEEP')
    assert.equal(await b.getByPlaceholder('写下你的整体判断…').inputValue(), 'B_UNSAVED_NOTE')
    await b.reload()
    await b.getByRole('button', {name: '继续上一局', exact: true}).click()
    assert.equal(await b.getByPlaceholder('写下你的整体判断…').inputValue(), 'A_NEW_NOTE_KEEP')
    await b.getByRole('button', {name: '进入第一天', exact: true}).click()
    await b.waitForFunction(() => JSON.parse(localStorage.getItem('lrsNotesGameSession')).rounds.length === 2)
    const after = await saved(b)
    assert.equal(after.overallNotes, 'A_NEW_NOTE_KEEP')
    assert(after.storageRevision > before.storageRevision)
    assert.deepEqual(errors, [])
    results.push({webLocks, beforeNotes: before.overallNotes, afterNotes: after.overallNotes, rounds: after.rounds.length, beforeRevision: before.storageRevision, afterRevision: after.storageRevision, errors})
    await context.close()
  }
  if (process.env.QA_EVIDENCE) fs.writeFileSync(process.env.QA_EVIDENCE, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
  if (server) await new Promise(resolve => server.close(resolve))
}
