import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {createServer as createDocsServer} from 'vitepress'
import {preview} from 'vite'

const require = createRequire(import.meta.url)
const {chromium} = require(process.env.QA_PLAYWRIGHT_PACKAGE || 'playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const results = []
const browser = await chromium.launch()
try {
  for (const mode of ['dev', 'preview']) {
    // Use the real theme and all four authored pages in both pipelines.
    // VitePress 1.x preview ignores --host; docs:preview uses Vite instead.
    const server = mode === 'dev'
      ? await createDocsServer(path.join(root, 'docs'), {host: '127.0.0.1', port: 0})
      : await preview({root, configFile: false, envFile: false, base: '/',
        build: {outDir: 'docs/.vitepress/dist'}, preview: {host: '127.0.0.1', port: 0}})
    try {
      if (mode === 'dev') await server.listen()
      const address = server.httpServer.address()
      assert.equal(address.address, '127.0.0.1', `${mode} must bind only loopback`)
      const base = `http://127.0.0.1:${address.port}`
      for (const mobile of [false, true]) {
        const context = await browser.newContext({viewport: mobile ? {width: 390, height: 844} : {width: 1280, height: 800}, colorScheme: 'light'})
        const page = await context.newPage()
        const errors = [], failedResources = []
        page.on('pageerror', error => errors.push(error.message))
        page.on('console', message => {
          if (message.type() === 'error' && (!message.location().url || message.location().url.startsWith(base))) errors.push(message.text())
        })
        page.on('response', response => {
          if (response.url().startsWith(base) && response.status() >= 400) failedResources.push({url: response.url(), status: response.status()})
        })
        page.on('requestfailed', request => {
          if (request.url().startsWith(base)) failedResources.push({url: request.url(), failure: request.failure()?.errorText})
        })
        try {
          await page.goto(base + '/')
          await page.getByRole('heading', {name: '狼人杀在线笔记 专为狼人杀玩家设计'}).waitFor()
          assert.equal(await page.locator('.VPFeature').count(), 4)
          assert.equal(await page.locator('.VPFooter a').filter({hasText: 'MIT'}).getAttribute('href'), 'https://opensource.org/license/MIT')
          assert.equal(await page.locator('.VPFooter a').filter({hasText: 'syhy0612'}).getAttribute('href'), 'https://github.com/syhy0612')
          assert.equal(await page.getByRole('link', {name: '开始使用', exact: true}).getAttribute('href'), 'https://lrs-notes.edgeone.app/')

          // Client navigation proves hydration and imports work, beyond SSR HTML.
          await page.locator('.VPHero').getByRole('link', {name: '功能介绍', exact: true}).click()
          await page.locator('h1').filter({hasText: '功能介绍'}).waitFor()
          await page.getByText('常驻开放场', {exact: true}).click()
          await page.getByRole('cell', {name: '暗夜星辰', exact: true}).waitFor()
          for (const anchor of await page.locator('.VPDocAsideOutline a[href^="#"]').evaluateAll(links => links.map(a => a.hash))) {
            assert(await page.evaluate(hash => Boolean(document.getElementById(decodeURIComponent(hash.slice(1)))), anchor), `missing heading ${anchor}`)
          }
          if (mobile) await page.getByRole('button', {name: '菜单', exact: true}).click()
          await page.locator('.VPSidebar').getByRole('link', {name: '导出记录', exact: true}).click()
          await page.waitForFunction(() => decodeURIComponent(location.hash).includes('导出游戏记录信息'))
          assert(await page.evaluate(() => Boolean(document.getElementById(decodeURIComponent(location.hash.slice(1))))), 'sidebar anchor must resolve')
          // A same-page anchor keeps the mobile sidebar open; dismiss it as a
          // reader would before opening the separate top navigation.
          if (mobile) await page.locator('.VPBackdrop').click({position: {x: 380, y: 150}})

          if (mobile) await page.getByRole('button', {name: 'mobile navigation', exact: true}).click()
          const nav = page.locator(mobile ? '.VPNavScreen' : '.VPNavBarMenu')
          await nav.getByRole('link', {name: '简介', exact: true}).click()
          await page.locator('h1').filter({hasText: '前言'}).waitFor()
          assert.equal(await page.locator('.feature-card').count(), 4)
          if (mobile) await page.getByRole('button', {name: 'mobile navigation', exact: true}).click()
          await nav.getByRole('link', {name: '关于', exact: true}).click()
          await page.locator('h1').filter({hasText: '关于'}).waitFor()
          assert(await page.getByText('2024年6月初', {exact: false}).isVisible())
          await page.reload()
          await page.locator('h1').filter({hasText: '关于'}).waitFor()

          if (mobile) await page.getByRole('button', {name: 'mobile navigation', exact: true}).click()
          const appearance = page.locator(mobile ? '.VPNavScreen' : '.VPNavBarAppearance').getByRole('switch')
          await appearance.click()
          await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
          await appearance.click()
          await page.waitForFunction(() => !document.documentElement.classList.contains('dark'))
          if (mobile) {
            await page.getByRole('button', {name: 'mobile navigation', exact: true}).click()
          } else {
            const menu = page.locator('.VPNolebaseEnhancedReadabilitiesMenuFlyout')
            await menu.hover()
            await menu.locator('.menu').waitFor()
            await menu.getByText('ON', {exact: true}).waitFor()
            await menu.getByText('OFF', {exact: true}).click()
            await page.waitForFunction(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-spotlight-mode') === 'false')
            await menu.getByText('ON', {exact: true}).click()
            await page.waitForFunction(() => localStorage.getItem('vitepress-nolebase-enhanced-readabilities-spotlight-mode') === 'true')
          }
          assert.deepEqual(errors, [], `${mode}: browser/hydration errors`)
          assert.deepEqual(failedResources, [], `${mode}: broken local assets or links`)
          results.push({mode, mobile, pages: ['/', '/features/', '/guide/', '/about/'], errors, failedResources})
        } catch (error) {
          console.error({mode, mobile, url: page.url(), errors, failedResources})
          if (process.env.QA_EVIDENCE) {
            await page.screenshot({path: `${process.env.QA_EVIDENCE}.${mode}.${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true})
            await writeFile(`${process.env.QA_EVIDENCE}.failure.html`, await page.content())
          }
          throw error
        } finally {
          await context.close()
        }
      }
    } finally {
      if (mode === 'dev') await server.close()
      else await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
    }
  }
  if (process.env.QA_EVIDENCE) await writeFile(process.env.QA_EVIDENCE, JSON.stringify(results, null, 2))
  console.log(JSON.stringify(results, null, 2))
} finally {
  await browser.close()
}
