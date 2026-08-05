/* 轮次系统浏览器验收：13 步 + 5 张截图
 * 运行：NODE_PATH="$(npm root -g)" node scripts/visual-review-rounds.cjs
 * 输出：.visual-review/01..05-round-*.png + rounds-results.json
 */
const {chromium} = require('playwright')
const path = require('node:path')
const fs = require('node:fs')

const BASE = process.env.VITE_URL || 'http://localhost:8081'
const OUT = path.join(__dirname, '..', '.visual-review')
fs.mkdirSync(OUT, {recursive: true})

const results = []
const sleep = ms => new Promise(r => setTimeout(r, ms))
function record(name, viewport, action, passed, detail = '', consoleErrors = []) {
    results.push({name, viewport, action, passed, detail, consoleErrors: consoleErrors.slice()})
    console.log(`${passed ? 'PASS' : 'FAIL'} [${name}] ${action}${detail ? ' — ' + detail : ''}`)
}
async function shot(page, name) { await page.screenshot({path: path.join(OUT, name), fullPage: false}) }
function attachConsole(page) {
    const errors = []
    page.on('pageerror', err => errors.push('pageerror: ' + err.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()) })
    return errors
}
const chips = page => page.locator('.round-tabs button')
const chipLabels = async page => (await chips(page).allTextContents()).map(t => t.trim())

async function setupWolf(page) {
    await page.goto(BASE)
    await page.waitForSelector('.home', {timeout: 10000})
    await page.getByRole('button', {name: '开始狼人杀对局'}).click()
    await page.waitForSelector('.setup-page')
    await page.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
    await page.getByRole('button', {name: '8号', exact: true}).click()
    await page.locator('button.role-btn').filter({hasText: '狼人'}).first().click()
    await page.getByRole('button', {name: '下一步'}).click()
    const field = page.locator('.field').filter({hasText: '已知狼队友'}).first()
    await field.locator('.el-select').click()
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText: '1号'}).first().click()
    await page.keyboard.press('Escape')
    await page.locator('.field').filter({hasText: '队友状态'}).locator('label.el-radio').filter({hasText: '已选择已知队友'}).first().click()
    await page.getByRole('button', {name: '确认并进入记录台'}).click()
    await page.waitForSelector('.board', {timeout: 10000})
}

async function main() {
    const browser = await chromium.launch()
    try {
        const ctx = await browser.newContext()
        const desktop = await ctx.newPage()
        await desktop.setViewportSize({width: 1440, height: 900})
        const errs = attachConsole(desktop)

        // 开局 → 记录台
        await setupWolf(desktop)
        // 1. 新建对局直接看到第一夜；无轮次名称输入框；不重复显示当前名
        const noInput = await desktop.getByPlaceholder('新轮次，如第一天警上').count()
        const hasStrong = await desktop.locator('.round-bar strong').count()
        const labels0 = await chipLabels(desktop)
        record('01-round-first-night', '1440x900', '开局即第一夜+无输入框+无重复显示', noInput === 0 && hasStrong === 0 && labels0.length === 1 && labels0[0] === '第一夜', `chips=${JSON.stringify(labels0)} strong=${hasStrong}`, errs)
        await shot(desktop, '01-round-first-night.png')
        // 2. 进入第一天
        await desktop.getByRole('button', {name: '进入第一天'}).click()
        await sleep(250)
        const labels1 = await chipLabels(desktop)
        const active1 = await chips(desktop).filter({hasText: '第一天'}).first().getAttribute('class')
        record('02-round-first-day', '1440x900', '进入第一天（自动创建并切换）', labels1.join('|') === '第一夜|第一天' && /active/.test(active1), `chips=${JSON.stringify(labels1)}`, errs)
        await shot(desktop, '02-round-first-day.png')
        // 3. 进入第二夜
        await desktop.getByRole('button', {name: '进入第二夜'}).click()
        await sleep(250)
        const labels2 = await chipLabels(desktop)
        record('03-round-second-night', '1440x900', '进入第二夜', labels2.join('|') === '第一夜|第一天|第二夜', `chips=${JSON.stringify(labels2)}`, errs)
        await shot(desktop, '03-round-second-night.png')
        // 4. 进入第二天
        await desktop.getByRole('button', {name: '进入第二天'}).click()
        await sleep(250)
        const labels3 = await chipLabels(desktop)
        record('04-round-second-day', '1440x900', '进入第二天', labels3.join('|') === '第一夜|第一天|第二夜|第二天', `chips=${JSON.stringify(labels3)}`, errs)
        await shot(desktop, '04-round-second-day.png')
        // 5. 左箭头返回第一天（从第二天连点两次）
        await desktop.locator('.round-bar button[title="上一阶段"]').click()
        await sleep(200)
        await desktop.locator('.round-bar button[title="上一阶段"]').click()
        await sleep(250)
        const activeDay1 = await desktop.evaluate(() => document.querySelector('.round-tabs button.active')?.textContent.trim())
        record('rounds-desktop', '1440x900', '左箭头返回第一天', activeDay1 === '第一天', 'active=' + activeDay1, errs)
        // 6. 右箭头（非末尾）切换不重复创建
        await desktop.locator('.round-bar button[title^="切换到"]').click()
        await sleep(250)
        const countAfter = await chips(desktop).count()
        const activeNight2 = await desktop.evaluate(() => document.querySelector('.round-tabs button.active')?.textContent.trim())
        record('rounds-desktop', '1440x900', '非末尾右箭头只切换不创建', countAfter === 4 && activeNight2 === '第二夜', `count=${countAfter} active=${activeNight2}`, errs)
        // 7. 每轮填发言并断言切换不串
        const speeches = {'第一夜': '第一夜：我是狼，1、4、12。', '第一天': '第一天：白天盘逻辑。', '第二夜': '第二夜：建议刀9号。', '第二天': '第二天：听2号解释。'}
        for (const [label, text] of Object.entries(speeches)) {
            await chips(desktop).filter({hasText: label}).click()
            await sleep(150)
            await desktop.getByPlaceholder(/^1号本轮发言$/).fill(text)
        }
        await chips(desktop).filter({hasText: '第一夜'}).click()
        await sleep(150)
        const firstNightText = await desktop.getByPlaceholder(/^1号本轮发言$/).inputValue()
        await chips(desktop).filter({hasText: '第二天'}).click()
        await sleep(150)
        const secondDayText = await desktop.getByPlaceholder(/^1号本轮发言$/).inputValue()
        record('rounds-desktop', '1440x900', '各轮发言切换不串', firstNightText.includes('第一夜') && secondDayText.includes('第二天'), `firstNight="${firstNightText}" secondDay="${secondDayText}"`, errs)
        // 8. 自定义轮次（··· 菜单）
        await desktop.locator('.round-bar .more').click()
        await desktop.locator('.el-dropdown-menu__item').filter({hasText: '添加自定义轮次'}).click()
        await desktop.locator('.el-message-box__input input').fill('第一天警上')
        await desktop.locator('.el-message-box__btns .el-button--primary').click()
        await sleep(300)
        const labels4 = await chipLabels(desktop)
        const customIsLast = await chips(desktop).last().getAttribute('title')
        record('rounds-desktop', '1440x900', '··· 添加自定义轮次并标记', labels4.at(-1) === '第一天警上' && customIsLast === '自定义轮次', `chips=${JSON.stringify(labels4)} title=${customIsLast}`, errs)
        // 9. 刷新回首页 → 继续上一局 → 轮次与发言恢复
        await desktop.reload()
        await desktop.waitForSelector('.home', {timeout: 10000})
        await desktop.getByRole('button', {name: '继续上一局'}).click()
        await desktop.waitForSelector('.board', {timeout: 10000})
        const labelsRestored = await chipLabels(desktop)
        await chips(desktop).filter({hasText: '第一夜'}).click()
        await sleep(150)
        const restoredSpeech = await desktop.getByPlaceholder(/^1号本轮发言$/).inputValue()
        record('rounds-desktop', '1440x900', '刷新+继续上一局恢复轮次与发言', labelsRestored.length === 5 && labelsRestored.at(-1) === '第一天警上' && restoredSpeech.includes('第一夜'), `chips=${JSON.stringify(labelsRestored)} speech="${restoredSpeech}"`, errs)
        // 10. 删除空轮次（··· → 删除当前轮次；空轮次直接删不弹确认）
        await chips(desktop).filter({hasText: '第一天警上'}).click()
        await sleep(150)
        await desktop.locator('.round-bar .more').click()
        await desktop.locator('.el-dropdown-menu__item').filter({hasText: '删除当前轮次'}).click()
        await sleep(300)
        const labelsAfterDelete = await chipLabels(desktop)
        const noConfirmBox = await desktop.locator('.el-message-box').count()
        record('rounds-desktop', '1440x900', '删除空自定义轮次直接删除', labelsAfterDelete.length === 4 && noConfirmBox === 0, `chips=${JSON.stringify(labelsAfterDelete)} box=${noConfirmBox}`, errs)
        await desktop.getByRole('button', {name: '返回'}).click()
        await desktop.waitForSelector('.home')
        await desktop.close()

        // 移动端
        const mobile = await ctx.newPage()
        await mobile.setViewportSize({width: 390, height: 844})
        const merrs = attachConsole(mobile)
        await mobile.goto(BASE)
        await mobile.waitForSelector('.home', {timeout: 10000})
        await mobile.getByRole('button', {name: '继续上一局'}).click()
        await mobile.waitForSelector('.board', {timeout: 10000})
        await sleep(400)
        const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        const mChips = await chipLabels(mobile)
        record('05-round-mobile', '390x844', '移动端轮次区可见且无溢出', mChips.length >= 4 && !overflow, `chips=${JSON.stringify(mChips)} overflow=${overflow}`, merrs)
        await shot(mobile, '05-round-mobile.png')
        await mobile.close()
        await ctx.close()
    } finally {
        await browser.close()
    }
    const failed = results.filter(r => !r.passed)
    console.log(`\n=== 结果汇总：${results.length} 项断言，失败 ${failed.length} 项 ===`)
    for (const f of failed) console.log('FAILED:', f.name, f.action, f.detail)
    fs.writeFileSync(path.join(OUT, 'rounds-results.json'), JSON.stringify(results, null, 2), 'utf8')
    process.exit(failed.length ? 1 : 0)
}

main().catch(err => { console.error('SCRIPT ERROR:', err); process.exit(2) })
