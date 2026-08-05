/* 视觉修正后回归验收：7 张截图 + 功能/布局断言。
 * 运行：NODE_PATH="$(npm root -g)" node scripts/visual-review.cjs
 * 依赖：全局 playwright（1.60.0）+ vite dev server（默认 http://localhost:8081）
 * 输出：.visual-review/ 下 7 张原始分辨率截图 + results.json
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

async function shot(page, name) {
    await page.screenshot({path: path.join(OUT, name), fullPage: false})
}

function attachConsole(page) {
    const errors = []
    page.on('pageerror', err => errors.push('pageerror: ' + err.message))
    page.on('console', msg => { if (msg.type() === 'error') errors.push('console: ' + msg.text()) })
    return errors
}

async function pickSelectIn(page, fieldText, optionText) {
    const field = page.locator('.field').filter({hasText: fieldText}).first()
    await field.locator('.el-select').click()
    const item = page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText: optionText}).first()
    await item.waitFor({state: 'visible', timeout: 5000})
    await item.click()
    await sleep(150)
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
    for (const n of ['1号', '4号', '12号']) {
        await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText: n}).first().click()
        await sleep(80)
    }
    await page.keyboard.press('Escape')
    await sleep(150)
}

async function fillWitchPrivate(page) {
    await pickSelectIn(page, '已知夜间刀口', '8号')
    await pickRadioIn(page, '解药', '已使用')
    await pickSelectIn(page, '解药目标', '8号')
    await pickRadioIn(page, '毒药', '未使用')
}

// 桌面流程
async function runDesktop(page) {
    const errs = attachConsole(page)
    // 1. 开局（无会话）→ setup 两步
    await page.goto(BASE)
    await page.waitForSelector('.home', {timeout: 10000})
    await page.getByRole('button', {name: '开始狼人杀对局'}).waitFor()
    await page.getByRole('button', {name: '开始狼人杀对局'}).click()
    await page.waitForSelector('.setup-page')
    // 2. 基础信息：版型/座位/身份
    await page.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
    await page.getByRole('button', {name: '8号', exact: true}).click()
    await page.locator('button.role-btn').filter({hasText: '狼人'}).first().click()
    // 桌面两栏断言：表单与摘要同屏、grid 两列、操作按钮可见、无溢出
    const twoCols = await page.evaluate(() => getComputedStyle(document.querySelector('.setup-body')).gridTemplateColumns.split(' ').length >= 2)
    const sameScreen = await page.evaluate(() => {
        const main = document.querySelector('.setup-main').getBoundingClientRect()
        const sum = document.querySelector('.setup-summary').getBoundingClientRect()
        return main.bottom > 0 && sum.top < window.innerHeight && sum.bottom > 0
    })
    const nextVisible = await page.getByRole('button', {name: '下一步'}).isVisible()
    const overflow1 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    record('desktop', '1440x900', '桌面开局：两栏+表单摘要同屏+操作按钮可见+无溢出', twoCols && sameScreen && nextVisible && !overflow1, `twoCols=${twoCols} sameScreen=${sameScreen} nextVisible=${nextVisible} overflow=${overflow1}`, errs)
    const nextEnabled = !(await page.getByRole('button', {name: '下一步'}).isDisabled())
    record('desktop', '1440x900', '基础信息齐全后下一步可用', nextEnabled, 'enabled=' + nextEnabled, errs)
    await page.getByRole('button', {name: '下一步'}).click()
    // 3. 我的已知信息：狼人私有信息
    await fillWolfPrivate(page)
    const confirmVisible = await page.getByRole('button', {name: '确认并进入记录台'}).isVisible()
    const confirmEnabled = !(await page.getByRole('button', {name: '确认并进入记录台'}).isDisabled())
    record('desktop', '1440x900', '摘要确认按钮可见且可用', confirmVisible && confirmEnabled, 'visible=' + confirmVisible + ' enabled=' + confirmEnabled, errs)
    await shot(page, '02-setup-desktop-two-step.png')
    await page.getByRole('button', {name: '确认并进入记录台'}).click()
    await page.waitForSelector('.board', {timeout: 10000})

    // 4. 记录台：发言 + 轮次 + 三输入区
    await page.getByPlaceholder(/^1号本轮发言$/).fill('我站8号。')
    await page.getByPlaceholder(/^3号本轮发言$/).fill('听2号像狼。')
    await page.getByPlaceholder(/^5号本轮发言$/).fill('5号好人牌。')
    await page.getByRole('button', {name: '新增轮次'}).click()
    await page.getByPlaceholder('新轮次，如第一天警上').fill('第一天')
    await page.getByRole('button', {name: '确定', exact: true}).click()
    await sleep(300)
    await page.getByPlaceholder(/^1号本轮发言$/).fill('8号你身份是什么？')
    await page.locator('.round-tabs button').filter({hasText: '第一夜'}).click()
    await sleep(200)
    await page.getByPlaceholder(/1号和11号昨夜死亡/).fill('1号和11号昨夜死亡。4号被放逐。')
    await page.getByPlaceholder('例如：第一夜狼队最终刀11号。').fill('第一夜狼队最终刀11号。')
    // 展开并填写整体备注（桌面默认展开）
    await page.getByPlaceholder('写下你的整体判断…').fill('3号偏狼，7号身份较高。')
    // 三输入区徽标断言
    const badges = await page.locator('.collapse-title .badge').allTextContents()
    record('desktop', '1440x900', '三输入区徽标显示记录状态', badges.length === 3 && badges[0].includes('已记录'), JSON.stringify(badges), errs)
    await shot(page, '04-board-desktop.png')

    // 5. 深色主题
    await page.getByRole('button', {name: '主题'}).click() // system→light
    await page.getByRole('button', {name: '主题'}).click() // light→dark
    await sleep(300)
    const dark = await page.evaluate(() => document.documentElement.dataset.theme)
    record('desktop', '1440x900', '深色主题切换', dark === 'dark', 'data-theme=' + dark, errs)
    await shot(page, '07-board-dark.png')

    // 6. 狼人→预言家 切换后提示词（P0 核心断言）
    await page.getByRole('button', {name: '我的信息'}).click()
    await page.locator('.el-dialog').waitFor({state: 'visible'})
    const roleSelect = page.locator('.el-dialog .setting-row').filter({hasText: '真实身份'}).locator('.el-select')
    await roleSelect.click()
    await page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText: '预言家'}).first().click()
    await sleep(300)
    await page.locator('.el-dialog__headerbtn').click()
    await page.locator('.el-dialog').filter({hasText: '我的信息'}).waitFor({state: 'hidden', timeout: 5000})
    await sleep(200)
    await page.getByRole('button', {name: '生成 AI 策略提示词'}).click()
    await page.locator('.el-dialog:visible').waitFor({state: 'visible'})
    await sleep(300)
    const promptText = await page.locator('.el-dialog textarea').last().inputValue()
    const noWolf = !/已知狼队友/.test(promptText) && !/1、4、12/.test(promptText)
    const hasSeer = /尚未查验或暂未记录/.test(promptText)
    const hasPrivateBlock = /【用户掌握的非公开信息】/.test(promptText) && /刀11号/.test(promptText)
    const hasPublicBlock = /【已知公共信息】/.test(promptText)
    const hasNotesBlock = /【用户的主观备注】/.test(promptText)
    record('desktop', '1440x900', '身份切换后提示词不含旧狼人信息', noWolf, 'noWolf=' + noWolf, errs)
    record('desktop', '1440x900', '提示词含当前预言家信息与非公开/公共/备注三段', hasSeer && hasPrivateBlock && hasPublicBlock && hasNotesBlock, `seer=${hasSeer} privateBlock=${hasPrivateBlock} public=${hasPublicBlock} notes=${hasNotesBlock}`, errs)
    await shot(page, '06-prompt-after-role-switch.png')
    await page.locator('.el-dialog:visible .el-dialog__headerbtn').click()
    await sleep(300)

    // 7. 返回首页 → 首页主次层级
    await page.getByRole('button', {name: '返回'}).click()
    await page.waitForSelector('.home')
    const primary = await page.locator('button.start-btn--primary').filter({hasText: '继续上一局'}).count()
    const spyGhost = await page.locator('.other-section button.start-btn--ghost').filter({hasText: '谁是卧底'}).count()
    record('desktop', '1440x900', '首页主次层级：继续上一局主按钮、谁是卧底弱化', primary === 1 && spyGhost === 1, `primary=${primary} spyGhost=${spyGhost}`, errs)
    await shot(page, '01-home-hierarchy.png')

    // 8. 继续上一局 → 数据恢复
    await page.getByRole('button', {name: '继续上一局'}).click()
    await page.waitForSelector('.board', {timeout: 10000})
    const speechRestored = await page.getByPlaceholder(/^1号本轮发言$/).inputValue()
    const roundRestored = await page.locator('.round-tabs button').filter({hasText: '第一天'}).count()
    const privateRestored = await page.getByPlaceholder('例如：第一夜狼队最终刀11号。').inputValue()
    record('desktop', '1440x900', '继续上一局恢复发言/轮次/非公开信息', /我站8号/.test(speechRestored) && roundRestored === 1 && /刀11号/.test(privateRestored), `speech="${speechRestored}" round=${roundRestored} private="${privateRestored}"`, errs)
    // 恢复浅色主题供移动端第一屏截图
    await page.getByRole('button', {name: '主题'}).click() // dark→system
    await sleep(300)
    await page.getByRole('button', {name: '返回'}).click()
    await page.waitForSelector('.home')
}

// 移动端流程（与桌面同一 context，共享会话）
async function runMobile(page) {
    const errs = attachConsole(page)
    await page.goto(BASE)
    await page.waitForSelector('.home', {timeout: 10000})
    await page.getByRole('button', {name: '继续上一局'}).click()
    await page.waitForSelector('.board', {timeout: 10000})
    // 移动端第一屏：轮次后立即是玩家卡（speeches-panel 在 DOM 首位）
    const speechFirst = await page.evaluate(() => document.querySelector('.workspace').firstElementChild.classList.contains('speeches-panel'))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    const cardButtons = await page.locator('.player-card').first().locator('.flags button').count()
    record('mobile', '390x844', '移动端轮次后即玩家卡', speechFirst, 'speechFirst=' + speechFirst, errs)
    record('mobile', '390x844', '移动端玩家卡仅3标记+1快捷入口', cardButtons === 4, 'flagsButtons=' + cardButtons, errs)
    record('mobile', '390x844', '移动端记录台无横向溢出', !overflow, 'overflow=' + overflow, errs)
    await shot(page, '05-board-mobile-top.png')
    // 返回首页 → 女巫开局（移动端单列）
    await page.getByRole('button', {name: '返回'}).click()
    await page.waitForSelector('.home')
    await page.getByRole('button', {name: '开始新对局'}).click()
    await page.waitForSelector('.setup-page')
    await page.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
    await page.getByRole('button', {name: '6号', exact: true}).click()
    await page.getByRole('button', {name: '女巫', exact: true}).click()
    const singleCol = await page.evaluate(() => getComputedStyle(document.querySelector('.setup-body')).gridTemplateColumns.split(' ').length === 1)
    record('mobile', '390x844', '移动端开局单列', singleCol, 'singleCol=' + singleCol, errs)
    await page.getByRole('button', {name: '下一步'}).click()
    await fillWitchPrivate(page)
    const mConfirm = page.getByRole('button', {name: '确认并进入记录台'})
    await mConfirm.scrollIntoViewIfNeeded()
    await sleep(200)
    record('mobile', '390x844', '移动端女巫开局确认按钮可见可用', await mConfirm.isVisible() && !(await mConfirm.isDisabled()), 'visible+enabled', errs)
    await shot(page, '03-setup-mobile-witch.png')
    await mConfirm.click()
    await page.locator('.el-message-box').waitFor({state: 'visible', timeout: 5000})
    await page.getByRole('button', {name: '确定替换'}).click()
    await page.waitForSelector('.board', {timeout: 10000})
    record('mobile', '390x844', '移动端确认替换后进入记录台', true, '.board 可见', errs)
}

async function main() {
    const browser = await chromium.launch()
    try {
        const ctx = await browser.newContext()
        const desktop = await ctx.newPage()
        await desktop.setViewportSize({width: 1440, height: 900})
        await runDesktop(desktop)
        await desktop.close()
        const mobile = await ctx.newPage()
        await mobile.setViewportSize({width: 390, height: 844})
        await runMobile(mobile)
        await mobile.close()
        await ctx.close()
    } finally {
        await browser.close()
    }
    const failed = results.filter(r => !r.passed)
    console.log(`\n=== 结果汇总：${results.length} 项断言，失败 ${failed.length} 项 ===`)
    for (const f of failed) console.log('FAILED:', f.name, f.action, f.detail)
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2), 'utf8')
    process.exit(failed.length ? 1 : 0)
}

main().catch(err => { console.error('SCRIPT ERROR:', err); process.exit(2) })
