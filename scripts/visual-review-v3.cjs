/* 最终视觉修正复验：4 项（深色提示词弹窗/深色模板下拉/移动端第一屏/桌面两步开局）
 * 运行：NODE_PATH="$(npm root -g)" node scripts/visual-review-v3.cjs
 * 输出：.visual-review/ 下 v3-*.png + v3-results.json
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
async function pickRadioIn(page, fieldText, radioText) {
    const field = page.locator('.field').filter({hasText: fieldText}).first()
    await field.locator('label.el-radio').filter({hasText: radioText}).first().click()
    await sleep(120)
}
async function fillWolfPrivate(page) {
    await pickRadioIn(page, '队友状态', '已选择已知队友')
    const field = page.locator('.field').filter({hasText: '已知狼队友'}).first()
    await field.locator('.el-select').click()
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText: '1号'}).first().click()
    await page.keyboard.press('Escape')
    await sleep(150)
}
const rgb = str => (str.match(/\d+/g) || []).slice(0, 3).map(Number).join(',')

async function setupWolf(page) {
    await page.goto(BASE)
    await page.waitForSelector('.home', {timeout: 10000})
    await page.getByRole('button', {name: '开始狼人杀对局'}).click()
    await page.waitForSelector('.setup-page')
    await page.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
    await page.getByRole('button', {name: '8号', exact: true}).click()
    await page.locator('button.role-btn').filter({hasText: '狼人'}).first().click()
    await page.getByRole('button', {name: '下一步'}).click()
    await fillWolfPrivate(page)
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

        // 0. 桌面两步开局页（第 4 项）
        await desktop.goto(BASE)
        await desktop.waitForSelector('.home', {timeout: 10000})
        await desktop.getByRole('button', {name: '开始狼人杀对局'}).click()
        await desktop.waitForSelector('.setup-page')
        await desktop.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
        await desktop.getByRole('button', {name: '8号', exact: true}).click()
        await desktop.locator('button.role-btn').filter({hasText: '狼人'}).first().click()
        const activeStep = await desktop.locator('.stepper button.active').innerText()
        record('v3-setup-desktop', '1440x900', '两步开局步骤指示当前高亮', /基础信息/.test(activeStep), 'active=' + activeStep.trim(), errs)
        await desktop.getByRole('button', {name: '下一步'}).click()
        await fillWolfPrivate(desktop)
        await shot(desktop, 'v3-setup-desktop.png')
        const activeStep2 = await desktop.locator('.stepper button.active').innerText()
        record('v3-setup-desktop', '1440x900', '第2步已知信息高亮', /已知信息/.test(activeStep2), 'active=' + activeStep2.trim(), errs)
        await desktop.getByRole('button', {name: '确认并进入记录台'}).click()
        await desktop.waitForSelector('.board', {timeout: 10000})

        // 深色主题
        await desktop.getByRole('button', {name: '主题'}).click()
        await desktop.getByRole('button', {name: '主题'}).click()
        await sleep(300)

        // 1. 深色主题 AI 提示词弹窗
        await desktop.getByRole('button', {name: '生成 AI 策略提示词'}).click()
        await desktop.locator('.el-dialog:visible').waitFor({state: 'visible'})
        await sleep(400)
        const dialogBg = await desktop.evaluate(() => getComputedStyle(document.querySelector('.el-dialog')).backgroundColor)
        const dialogText = await desktop.evaluate(() => getComputedStyle(document.querySelector('.el-dialog__title')).color)
        record('v3-dark-prompt', '1440x900', '深色提示词弹窗背景深色', /35,37,47|45,47,58/.test(rgb(dialogBg)), 'bg=' + rgb(dialogBg) + ' title=' + dialogText, errs)
        await shot(desktop, 'v3-dark-prompt.png')
        await desktop.locator('.el-dialog:visible .el-dialog__headerbtn').click()
        await sleep(300)

        // 2. 深色主题模板目标下拉框
        const templateSelect = desktop.locator('.speeches-panel .section-title .el-select')
        await templateSelect.click()
        await sleep(400)
        const dropInfo = await desktop.evaluate(() => {
            return [...document.querySelectorAll('.el-popper')].filter(el => el.getBoundingClientRect().width > 0)
                .map(el => getComputedStyle(el).backgroundColor)
        })
        record('v3-dark-template-select', '1440x900', '深色模板下拉框背景深色', dropInfo.some(bg => /35,37,47|42,45,56/.test(rgb(bg))), 'popperBgs=' + JSON.stringify(dropInfo.map(rgb)), errs)
        await shot(desktop, 'v3-dark-template-select.png')
        await desktop.keyboard.press('Escape')
        await sleep(200)
        // 恢复浅色供移动端
        await desktop.getByRole('button', {name: '主题'}).click()
        await sleep(200)
        await desktop.getByRole('button', {name: '返回'}).click()
        await desktop.waitForSelector('.home')
        await desktop.close()

        // 3. 移动端 390×844 记录台第一屏
        const mobile = await ctx.newPage()
        await mobile.setViewportSize({width: 390, height: 844})
        const merrs = attachConsole(mobile)
        await mobile.goto(BASE)
        await mobile.waitForSelector('.home', {timeout: 10000})
        await mobile.getByRole('button', {name: '继续上一局'}).click()
        await mobile.waitForSelector('.board', {timeout: 10000})
        await sleep(400)
        // 顶栏压缩断言：返回/版型名/主题同一行，top-actions 第二行；AI策略 短标签可见
        const topRow = await mobile.evaluate(() => {
            const home = document.querySelector('.topbar .home').getBoundingClientRect()
            const mode = document.querySelector('.topbar .mode').getBoundingClientRect()
            const theme = document.querySelector('.topbar .theme').getBoundingClientRect()
            const actions = document.querySelector('.topbar .top-actions').getBoundingClientRect()
            return {
                homeThemeSameLine: Math.abs(home.top - theme.top) < 6,
                modeThemeSameLine: Math.abs(mode.top - theme.top) < 6,
                actionsBelow: actions.top > theme.top + 10
            }
        })
        record('v3-mobile-top', '390x844', '移动端返回/版型名/主题同一行且操作区换行', topRow.homeThemeSameLine && topRow.modeThemeSameLine && topRow.actionsBelow, JSON.stringify(topRow), merrs)
        const shortVisible = await mobile.locator('.topbar .short-label').isVisible()
        const fullHidden = !(await mobile.locator('.topbar .full-label').isVisible())
        record('v3-mobile-top', '390x844', '移动端AI按钮显示短标签AI策略', shortVisible && fullHidden, 'short=' + shortVisible + ' fullHidden=' + fullHidden, merrs)
        const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        record('v3-mobile-top', '390x844', '移动端记录台无横向溢出', !overflow, 'overflow=' + overflow, merrs)
        await shot(mobile, 'v3-mobile-top.png')
        await mobile.close()
        await ctx.close()
    } finally {
        await browser.close()
    }
    const failed = results.filter(r => !r.passed)
    console.log(`\n=== 结果汇总：${results.length} 项断言，失败 ${failed.length} 项 ===`)
    for (const f of failed) console.log('FAILED:', f.name, f.action, f.detail)
    fs.writeFileSync(path.join(OUT, 'v3-results.json'), JSON.stringify(results, null, 2), 'utf8')
    process.exit(failed.length ? 1 : 0)
}

main().catch(err => { console.error('SCRIPT ERROR:', err); process.exit(2) })
