/* 最终视觉复审材料生成：9 张截图 + 身份切换提示词纯文本 + 断言记录。
 * 运行：NODE_PATH="$(npm root -g)" node scripts/visual-review-final.cjs
 * 依赖：全局 playwright（1.60.0）+ vite dev server（默认 http://localhost:8081）
 * 输出：.visual-review/ 下 01..09 截图 + 09 txt + final-results.json
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
async function setupWolfStep2(page) {
    // 进入开局设置第 2 步并填写狼人私有信息 + 跨身份通用补充（返回 session）
    await page.goto(BASE)
    await page.waitForSelector('.home', {timeout: 10000})
    await page.getByRole('button', {name: '开始狼人杀对局'}).click()
    await page.waitForSelector('.setup-page')
    await page.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
    await page.getByRole('button', {name: '8号', exact: true}).click()
    await page.locator('button.role-btn').filter({hasText: '狼人'}).first().click()
    await page.getByRole('button', {name: '下一步'}).click()
    await fillWolfPrivate(page)
    await page.locator('.notes-field textarea').fill('3号行为反常，优先听发言。')
    await sleep(200)
}

async function main() {
    const browser = await chromium.launch()
    try {
        const ctx = await browser.newContext()
        const desktop = await ctx.newPage()
        await desktop.setViewportSize({width: 1440, height: 900})
        const errs = attachConsole(desktop)

        // ===== 桌面 =====
        // 01：两步开局第 1 步（①基础信息高亮，表单+摘要同屏）
        await desktop.goto(BASE)
        await desktop.waitForSelector('.home', {timeout: 10000})
        await desktop.getByRole('button', {name: '开始狼人杀对局'}).click()
        await desktop.waitForSelector('.setup-page')
        await desktop.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
        await desktop.getByRole('button', {name: '8号', exact: true}).click()
        await desktop.locator('button.role-btn').filter({hasText: '狼人'}).first().click()
        const active1 = await desktop.locator('.stepper button.active').innerText()
        const summaryVisible1 = await desktop.locator('.setup-summary').isVisible()
        const nextVisible1 = await desktop.getByRole('button', {name: '下一步'}).isVisible()
        record('01-v3-setup-step1', '1440x900', '第1步①基础信息高亮+摘要同屏+下一步可见', /基础信息/.test(active1) && summaryVisible1 && nextVisible1, 'active=' + active1.trim(), errs)
        await shot(desktop, '01-v3-setup-step1-desktop.png')
        // 02：第 2 步（②高亮 + 狼人私有信息 + 跨身份通用补充 + 确认按钮）
        await desktop.getByRole('button', {name: '下一步'}).click()
        await fillWolfPrivate(desktop)
        await desktop.locator('.notes-field textarea').fill('3号行为反常，优先听发言。')
        await sleep(200)
        const active2 = await desktop.locator('.stepper button.active').innerText()
        const confirmVisible = await desktop.getByRole('button', {name: '确认并进入记录台'}).isVisible()
        const confirmEnabled = !(await desktop.getByRole('button', {name: '确认并进入记录台'}).isDisabled())
        record('02-v3-setup-step2', '1440x900', '第2步②已知信息高亮+确认按钮可见可用', /已知信息/.test(active2) && confirmVisible && confirmEnabled, 'active=' + active2.trim() + ' confirm=' + confirmVisible + '/' + confirmEnabled, errs)
        await shot(desktop, '02-v3-setup-step2-desktop.png')
        await desktop.getByRole('button', {name: '确认并进入记录台'}).click()
        await desktop.waitForSelector('.board', {timeout: 10000})

        // 03：浅色记录台（两轮次/多发言/未发言+滑水标记/快捷输入展开/三输入区示例）
        await desktop.getByPlaceholder(/^1号本轮发言$/).fill('我站8号，警下重点听8号归票。')
        await desktop.getByPlaceholder(/^3号本轮发言$/).fill('听2号像狼，先标狼。')
        await desktop.getByPlaceholder(/^5号本轮发言$/).fill('5号好人牌，警下重点听8号。')
        // 标记：2 号未发言、7 号滑水
        await desktop.locator('article.player-card').filter({hasText: /^2号/}).locator('.flags button').filter({hasText: '未发言'}).click()
        await desktop.locator('article.player-card').filter({hasText: /^7号/}).locator('.flags button').filter({hasText: '滑水'}).click()
        // 三输入区示例
        await desktop.getByPlaceholder(/1号和11号昨夜死亡/).fill('1号和11号昨夜死亡。4号被放逐。')
        await desktop.getByPlaceholder('例如：第一夜狼队最终刀11号。').fill('第一夜狼队最终刀11号。')
        await desktop.getByPlaceholder('写下你的整体判断…').fill('3号偏狼，7号身份较高。')
        // 新增第二轮：第一天
        await desktop.getByRole('button', {name: '新增轮次'}).click()
        await desktop.getByPlaceholder('新轮次，如第一天警上').fill('第一天')
        await desktop.getByRole('button', {name: '确定', exact: true}).click()
        await sleep(300)
        await desktop.getByPlaceholder(/^1号本轮发言$/).fill('8号你身份是什么？')
        await desktop.getByPlaceholder(/^3号本轮发言$/).fill('1号划水，先放一放。')
        await desktop.locator('.round-tabs button').filter({hasText: '第一夜'}).click()
        await sleep(200)
        // 展开 1 号快捷输入
        await desktop.locator('article.player-card').filter({hasText: /^1号/}).locator('button.quick').click()
        await sleep(300)
        const roundCount = await desktop.locator('.round-tabs button').count()
        const templatesOpen = await desktop.locator('article.player-card').filter({hasText: /^1号/}).locator('.templates').isVisible()
        record('03-v3-board-light', '1440x900', '记录台两轮次+快捷输入展开', roundCount >= 2 && templatesOpen, 'rounds=' + roundCount + ' templatesOpen=' + templatesOpen, errs)
        await shot(desktop, '03-v3-board-light-desktop.png')

        // 04：深色 AI 提示词弹窗
        await desktop.getByRole('button', {name: '主题'}).click()
        await desktop.getByRole('button', {name: '主题'}).click()
        await sleep(300)
        await desktop.getByRole('button', {name: '生成 AI 策略提示词'}).click()
        await desktop.locator('.el-dialog:visible').waitFor({state: 'visible'})
        await sleep(500)
        const dialogBg = await desktop.evaluate(() => getComputedStyle(document.querySelector('.el-dialog')).backgroundColor)
        record('04-v3-dark-prompt', '1440x900', '深色提示词弹窗背景深色', /35,37,47/.test((dialogBg.match(/\d+/g) || []).slice(0, 3).join(',')), 'bg=' + (dialogBg.match(/\d+/g) || []).slice(0, 3).join(','), errs)
        await shot(desktop, '04-v3-dark-prompt-desktop.png')
        await desktop.locator('.el-dialog:visible .el-dialog__headerbtn').click()
        await sleep(400)

        // 05：深色快捷输入菜单（1 号仍展开？深色后 templates 状态保持；重新确认展开）
        if (!(await desktop.locator('article.player-card').filter({hasText: /^1号/}).locator('.templates').isVisible())) {
            await desktop.locator('article.player-card').filter({hasText: /^1号/}).locator('button.quick').click()
            await sleep(300)
        }
        const darkTheme = await desktop.evaluate(() => document.documentElement.dataset.theme)
        record('05-v3-dark-template', '1440x900', '深色快捷输入菜单展开', darkTheme === 'dark', 'theme=' + darkTheme, errs)
        await shot(desktop, '05-v3-dark-template-menu.png')
        // 回浅色
        await desktop.getByRole('button', {name: '主题'}).click()
        await sleep(200)

        // 09：狼人 → 预言家切换后的提示词（弹窗截图 + 纯文本）
        await desktop.getByRole('button', {name: '我的信息'}).click()
        await desktop.locator('.el-dialog:visible').waitFor({state: 'visible'})
        const roleSelect = desktop.locator('.el-dialog .setting-row').filter({hasText: '真实身份'}).locator('.el-select')
        await roleSelect.click()
        await desktop.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText: '预言家'}).first().click()
        await sleep(300)
        await desktop.locator('.el-dialog:visible .el-dialog__headerbtn').click()
        await desktop.locator('.el-dialog').filter({hasText: '我的信息'}).waitFor({state: 'hidden', timeout: 5000})
        await sleep(200)
        await desktop.getByRole('button', {name: '生成 AI 策略提示词'}).click()
        await desktop.locator('.el-dialog:visible').waitFor({state: 'visible'})
        await sleep(500)
        const promptText = await desktop.locator('.el-dialog:visible textarea').last().inputValue()
        fs.writeFileSync(path.join(OUT, '09-v3-prompt-after-role-switch.txt'), promptText, 'utf8')
        const noWolf = !/已知狼队友/.test(promptText) && !/1、4、12/.test(promptText)
        const hasSeer = /尚未查验或暂未记录/.test(promptText)
        const hasPublic = /【已知公共信息】/.test(promptText)
        const hasPrivateBlock = /【用户掌握的非公开信息】/.test(promptText) && /刀11号/.test(promptText)
        const hasNotesBlock = /【用户的主观备注】/.test(promptText)
        const hasCampGoal = /重点找出狼人/.test(promptText)
        const hasConstraint = /不得假设其他玩家知道用户掌握的非公开信息/.test(promptText)
        record('09-v3-prompt-after-role-switch', '1440x900', '提示词无旧狼人信息+三段式+好人目标+约束', noWolf && hasSeer && hasPublic && hasPrivateBlock && hasNotesBlock && hasCampGoal && hasConstraint, `noWolf=${noWolf} seer=${hasSeer} public=${hasPublic} privateBlock=${hasPrivateBlock} notes=${hasNotesBlock} goal=${hasCampGoal} constraint=${hasConstraint}`, errs)
        await shot(desktop, '09-v3-prompt-after-role-switch.png')
        await desktop.locator('.el-dialog:visible .el-dialog__headerbtn').click()
        await sleep(300)
        await desktop.getByRole('button', {name: '返回'}).click()
        await desktop.waitForSelector('.home')
        await desktop.close()

        // ===== 移动端 =====
        const mobile = await ctx.newPage()
        await mobile.setViewportSize({width: 390, height: 844})
        const merrs = attachConsole(mobile)
        // 06：移动端记录台第一屏
        await mobile.goto(BASE)
        await mobile.waitForSelector('.home', {timeout: 10000})
        await mobile.getByRole('button', {name: '继续上一局'}).click()
        await mobile.waitForSelector('.board', {timeout: 10000})
        await sleep(400)
        const topRow = await mobile.evaluate(() => {
            const home = document.querySelector('.topbar .home').getBoundingClientRect()
            const mode = document.querySelector('.topbar .mode').getBoundingClientRect()
            const theme = document.querySelector('.topbar .theme').getBoundingClientRect()
            return {homeTheme: Math.abs(home.top - theme.top) < 6, modeTheme: Math.abs(mode.top - theme.top) < 6}
        })
        const overflow6 = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        const speechFirst = await mobile.evaluate(() => document.querySelector('.workspace').firstElementChild.classList.contains('speeches-panel'))
        const firstCardVisible = await mobile.locator('.player-card').first().isVisible()
        record('06-v3-board-mobile-top', '390x844', '移动端顶部同行+轮次后玩家卡+首卡可见+无溢出', topRow.homeTheme && topRow.modeTheme && speechFirst && firstCardVisible && !overflow6, `homeTheme=${topRow.homeTheme} modeTheme=${topRow.modeTheme} speechFirst=${speechFirst} overflow=${overflow6}`, merrs)
        await shot(mobile, '06-v3-board-mobile-top.png')
        // 07：移动端记录台下部（滚动到 notes-panel，展开非公开信息）
        await mobile.locator('.notes-panel').scrollIntoViewIfNeeded()
        await sleep(300)
        await mobile.locator('.collapse-title').filter({hasText: '本轮非公开信息'}).click()
        await sleep(400)
        const badgeTexts = await mobile.locator('.collapse-title .badge').allTextContents()
        const privateExpanded = await mobile.locator('.collapse-title').filter({hasText: '本轮非公开信息'}).locator('xpath=following-sibling::div[1]').isVisible()
        record('07-v3-board-mobile-notes', '390x844', '三区状态徽标+非公开信息展开', badgeTexts.length === 3 && privateExpanded, 'badges=' + JSON.stringify(badgeTexts) + ' expanded=' + privateExpanded, merrs)
        await shot(mobile, '07-v3-board-mobile-notes.png')
        // 08：移动端女巫开局第 2 步
        await mobile.getByRole('button', {name: '返回'}).click()
        await mobile.waitForSelector('.home')
        await mobile.getByRole('button', {name: '开始新对局'}).click()
        await mobile.waitForSelector('.setup-page')
        await mobile.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
        await mobile.getByRole('button', {name: '6号', exact: true}).click()
        await mobile.getByRole('button', {name: '女巫', exact: true}).click()
        await mobile.getByRole('button', {name: '下一步'}).click()
        await fillWitchPrivate(mobile)
        await mobile.locator('.notes-field textarea').fill('若3号被刀优先救3号。')
        const confirmBtn = mobile.getByRole('button', {name: '确认并进入记录台'})
        await confirmBtn.scrollIntoViewIfNeeded()
        await sleep(300)
        const overflow8 = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
        const confirmVisible8 = await confirmBtn.isVisible()
        record('08-v3-setup-witch-mobile', '390x844', '移动端女巫第2步确认可达+无溢出', confirmVisible8 && !overflow8, 'confirm=' + confirmVisible8 + ' overflow=' + overflow8, merrs)
        await shot(mobile, '08-v3-setup-witch-mobile.png')
        await mobile.close()
        await ctx.close()
    } finally {
        await browser.close()
    }
    const failed = results.filter(r => !r.passed)
    console.log(`\n=== 结果汇总：${results.length} 项断言，失败 ${failed.length} 项 ===`)
    for (const f of failed) console.log('FAILED:', f.name, f.action, f.detail)
    fs.writeFileSync(path.join(OUT, 'final-results.json'), JSON.stringify(results, null, 2), 'utf8')
    process.exit(failed.length ? 1 : 0)
}

main().catch(err => { console.error('SCRIPT ERROR:', err); process.exit(2) })
