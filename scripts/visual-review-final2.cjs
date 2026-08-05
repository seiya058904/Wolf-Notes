/* 最终轮次/昼夜/提示词/身份复核验收脚本
 * 运行：NODE_PATH="C:\\Users\\admin\\AppData\\Roaming\\npm\\node_modules" node scripts/visual-review-final2.cjs
 * 输出：.visual-review/final2-*.png + final2-results.json + final2-prompt.txt
 */
const {chromium} = require('playwright')
const path = require('node:path')
const fs = require('node:fs')

const BASE = process.env.VITE_URL || 'http://127.0.0.1:8081'
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
const activeLabel = page => page.evaluate(() => document.querySelector('.round-tabs button.active')?.textContent.trim() || '')

async function setupSeer(page) {
    // 预言家开局（有跨身份通用补充，便于身份复核测试）
    await page.goto(BASE)
    await page.waitForSelector('.home', {timeout: 10000})
    await page.getByRole('button', {name: '开始狼人杀对局'}).click()
    await page.waitForSelector('.setup-page')
    await page.locator('button.mode-card').filter({hasText: '奇迹商人'}).click()
    await page.getByRole('button', {name: '8号', exact: true}).click()
    await page.locator('button.role-btn').filter({hasText: '预言家'}).first().click()
    await page.getByRole('button', {name: '下一步'}).click()
    // 第2步：确认预言家私有信息（选择"尚未查验"使确认按钮可用）
    await page.locator('label.el-radio').filter({hasText: '尚未查验或暂未记录'}).first().click()
    await sleep(150)
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

        // ============ 桌面端：四轮推进 + 每轮填内容 + 昼夜界面 ============
        await setupSeer(desktop)
        // 第一夜：夜间界面（发言区折叠 + 非公开信息在前）
        const nightCollapsed = await desktop.locator('.speeches-panel.collapsed').count()
        const showBtn = await desktop.locator('.show-speeches').count()
        const firstSectionTitle = await desktop.locator('.notes-panel .notes-section:first-child .collapse-title span').first().textContent().catch(() => '')
        record('final2-first-night-ui', '1440x900', '第一夜：发言区折叠+显示玩家备注+非公开信息在前', nightCollapsed === 1 && showBtn === 1 && firstSectionTitle.includes('非公开信息'), `collapsed=${nightCollapsed} btn=${showBtn} first=${firstSectionTitle}`, errs)
        await desktop.locator('.notes-panel .notes-section').filter({hasText: '本轮非公开信息'}).locator('.el-textarea__inner').first().fill('第一夜狼队最终刀11号。')
        await desktop.locator('.notes-panel .notes-section').filter({hasText: '本轮公共信息'}).locator('.el-textarea__inner').first().fill('1号和11号昨夜死亡。')
        await shot(desktop, 'final2-01-first-night.png')

        // 第一天：白天界面（发言区显示 + 公共信息在前）
        await desktop.getByRole('button', {name: '进入第一天'}).click()
        await sleep(250)
        const daySpeechesVisible = await desktop.locator('.speeches-panel:not(.collapsed) .players-grid').count()
        const dayFirstSection = await desktop.locator('.notes-panel .notes-section:first-child .collapse-title span').first().textContent().catch(() => '')
        record('final2-first-day-ui', '1440x900', '第一天：发言区显示+公共信息在前', daySpeechesVisible === 1 && dayFirstSection.includes('公共信息'), `speeches=${daySpeechesVisible} first=${dayFirstSection}`, errs)
        await desktop.getByPlaceholder(/^1号本轮发言$/).fill('我站8号，警下重点听8号归票。')
        await desktop.getByPlaceholder(/^3号本轮发言$/).fill('听2号像狼，先标狼。')
        await desktop.locator('.notes-panel .notes-section').filter({hasText: '本轮公共信息'}).locator('.el-textarea__inner').first().fill('4号被放逐。')
        await desktop.locator('.notes-panel .notes-section').filter({hasText: '本轮非公开信息'}).locator('.el-textarea__inner').first().fill('建议刀6号。')
        await shot(desktop, 'final2-02-first-day.png')

        // 第二夜
        await desktop.getByRole('button', {name: '进入第二夜'}).click()
        await sleep(250)
        const night2Collapsed = await desktop.locator('.speeches-panel.collapsed').count()
        record('final2-second-night', '1440x900', '第二夜自动创建且夜间折叠', night2Collapsed === 1 && (await activeLabel(desktop)) === '第二夜', `collapsed=${night2Collapsed} active=${await activeLabel(desktop)}`, errs)
        await desktop.locator('.notes-panel .notes-section').filter({hasText: '本轮非公开信息'}).locator('.el-textarea__inner').first().fill('第二夜狼队刀9号。')
        await shot(desktop, 'final2-03-second-night.png')

        // 第二天
        await desktop.getByRole('button', {name: '进入第二天'}).click()
        await sleep(250)
        await desktop.getByPlaceholder(/^1号本轮发言$/).fill('第二天：听2号解释。')
        record('final2-second-day', '1440x900', '第二天自动创建', (await activeLabel(desktop)) === '第二天', '', errs)
        await shot(desktop, 'final2-04-second-day.png')

        // 轮次切换不串：回第一夜检查发言/公共信息
        await desktop.locator('.round-bar button[title="上一阶段"]').click()
        await sleep(150)
        await desktop.locator('.round-bar button[title="上一阶段"]').click()
        await sleep(150)
        await desktop.locator('.round-bar button[title="上一阶段"]').click()
        await sleep(250)
        const night1Private = await desktop.locator('.notes-panel .notes-section').filter({hasText: '本轮非公开信息'}).locator('.el-textarea__inner').first().inputValue()
        record('final2-switch-not-mixed', '1440x900', '回第一夜内容不串', night1Private.includes('第一夜狼队最终刀11号'), `night1="${night1Private}"`, errs)
        // 非末尾轮次右箭头只切换不创建
        await desktop.locator('.round-bar button[title^="切换到"]').click()
        await sleep(250)
        const countAfter = await chips(desktop).count()
        record('final2-switch-only', '1440x900', '非末尾右箭头只切换不创建', countAfter === 4 && (await activeLabel(desktop)) === '第一天', `count=${countAfter} active=${await activeLabel(desktop)}`, errs)

        // ============ 提示词验证 + 纯文本导出 ============
        await desktop.getByRole('button', {name: '生成 AI 策略提示词'}).click()
        await sleep(400)
        const promptText = await desktop.locator('.el-dialog textarea').inputValue()
        fs.writeFileSync(path.join(OUT, 'final2-prompt.txt'), promptText, 'utf8')
        // 段落归属断言：发言按轮次、不落在非公开段
        const lines = promptText.split('\n')
        const order = lines.map((line, i) => /【(第一夜|第一天|第二夜|第二天)】/.test(line) ? [line, i] : null).filter(Boolean).map(x => x[0])
        const hasNight1 = order[0] === '【第一夜】', hasDay1 = order[1] === '【第一天】', hasNight2 = order[2] === '【第二夜】', hasDay2 = order[3] === '【第二天】'
        let inPrivate = false, badLines = []
        for (const line of lines) {
            if (/【用户掌握的非公开信息】/.test(line)) inPrivate = true
            if (/【(公共信息|玩家发言|用户的主观备注|任务|对局记录|我的信息|用户私有信息)/.test(line) && !/【用户掌握的非公开信息】/.test(line)) inPrivate = false
            if (inPrivate && /^\d+号：/.test(line)) badLines.push(line.trim())
        }
        const day1Block = promptText.split('【第一天】')[1]?.split('【第二夜】')[0] || ''
        const speakFirst = day1Block.indexOf('【玩家发言】') > -1 && day1Block.indexOf('【玩家发言】') < day1Block.indexOf('【公共信息】')
        const noteAtEnd = promptText.indexOf('【用户的主观备注】') === -1 || promptText.indexOf('【用户的主观备注】') > promptText.indexOf('【第二天】') || promptText.indexOf('【用户的主观备注】') > promptText.lastIndexOf('【对局记录】')
        const privateDescInNight1 = promptText.includes('以下信息只有用户或用户阵营掌握')
        record('final2-prompt-structure', '1440x900', '提示词：轮次时间线+发言归位+备注在末尾', hasNight1 && hasDay1 && hasNight2 && hasDay2 && speakFirst && badLines.length === 0 && noteAtEnd && privateDescInNight1, `order=${order.join(',')} speakFirst=${speakFirst} bad=${badLines.length} noteAtEnd=${noteAtEnd}`, errs)
        await shot(desktop, 'final2-05-prompt-dialog.png')
        await desktop.getByRole('button', {name: '关闭', exact: true}).click()
        await sleep(200)

        // ============ 身份切换复核弹窗 ============
        // 当前第一夜含非公开信息"第一夜狼队最终刀11号"，切到狼人应弹复核
        await desktop.getByRole('button', {name: '我的信息'}).click()
        await sleep(400)
        const roleSelect = desktop.locator('.setting-row').filter({hasText: '真实身份'}).locator('.el-select').first()
        await roleSelect.click()
        await sleep(300)
        await desktop.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText: '狼人'}).first().click()
        await sleep(500)
        const reviewVisible = await desktop.locator('.el-dialog').filter({hasText: '身份切换复核'}).count()
        const reviewText = await desktop.locator('.el-dialog').filter({hasText: '身份切换复核'}).textContent().catch(() => '')
        const threeBtns = await desktop.locator('.el-dialog').filter({hasText: '身份切换复核'}).locator('.el-dialog__footer .el-button').allTextContents()
        record('final2-role-review', '1440x900', '身份切换弹出三选项复核', reviewVisible === 1 && reviewText.includes('狼人') && /轮次包含非公开信息/.test(reviewText) && threeBtns.length === 3 && threeBtns.some(b => b.includes('保留')) && threeBtns.some(b => b.includes('清空')) && threeBtns.some(b => b.includes('取消')), `text=${reviewText.trim().slice(0, 80)} btns=${threeBtns.join('/')}`, errs)
        await shot(desktop, 'final2-06-role-review-dialog.png')
        // 选择"取消修改"：身份回滚为预言家，非公开信息保留
        await desktop.locator('.el-dialog').filter({hasText: '身份切换复核'}).getByRole('button', {name: '取消修改'}).click()
        await sleep(500)
        const roleAfterCancel = await desktop.locator('.setting-row').filter({hasText: '真实身份'}).locator('.el-select').first().textContent().catch(() => '')
        record('final2-role-review-cancel', '1440x900', '取消修改回滚身份', /预言家|预/.test(String(roleAfterCancel || '')), `role=${roleAfterCancel}`, errs)
        // 关闭弹窗并刷新，完全重置 DOM 后再测"清空"分支
        await desktop.getByRole('button', {name: '关闭此对话框'}).last().click().catch(() => {})
        await sleep(600)
        await desktop.reload()
        await desktop.waitForSelector('.home', {timeout: 10000})
        await desktop.getByRole('button', {name: '继续上一局'}).click()
        await desktop.waitForSelector('.board', {timeout: 10000})
        await sleep(400)
        await desktop.getByRole('button', {name: '我的信息'}).click()
        await sleep(400)
        const roleSelect2 = desktop.locator('.setting-row').filter({hasText: '真实身份'}).locator('.el-select').first()
        await roleSelect2.click()
        await sleep(300)
        await desktop.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText: '狼人'}).first().click()
        await sleep(500)
        const reviewAgain = await desktop.locator('.el-dialog').filter({hasText: '身份切换复核'}).count()
        await desktop.locator('.el-dialog').filter({hasText: '身份切换复核'}).getByRole('button', {name: '清空轮次非公开信息'}).click()
        await sleep(500)
        const privateAfterClear = await desktop.locator('.notes-panel .notes-section').filter({hasText: '本轮非公开信息'}).locator('.el-textarea__inner').first().inputValue()
        // 先关闭"我的信息"弹窗，再切轮次读取发言（避免弹窗遮挡轮次栏）
        await desktop.getByRole('button', {name: '关闭此对话框'}).last().click().catch(() => {})
        await sleep(400)
        const day1SpeechKept = await (async () => {
            await desktop.locator('.round-tabs button').filter({hasText: '第一天'}).click()
            await sleep(250)
            return desktop.getByPlaceholder(/^1号本轮发言$/).inputValue()
        })()
        record('final2-role-review-clear', '1440x900', '清空只清 privateNotes 且发言保留', reviewAgain === 1 && privateAfterClear === '' && day1SpeechKept.includes('我站8号'), `reviewAgain=${reviewAgain} private="${privateAfterClear}" day1speech="${day1SpeechKept}"`, errs)
        await desktop.getByRole('button', {name: '返回'}).click()
        await desktop.waitForSelector('.home')
        await desktop.close()

        // ============ 移动端 ============
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
        // 切到第一夜（夜晚）后：发言区折叠且轮次控制可用
        await chips(mobile).filter({hasText: '第一夜'}).first().click()
        await sleep(300)
        const mCollapsed = await mobile.locator('.speeches-panel.collapsed').count()
        record('final2-mobile-rounds', '390x844', '移动端轮次控制可用且无溢出', mChips.length === 4 && !overflow && mCollapsed === 1, `chips=${JSON.stringify(mChips)} overflow=${overflow} collapsed=${mCollapsed}`, merrs)
        await shot(mobile, 'final2-07-mobile-rounds.png')
        // 移动端显示玩家备注可展开
        await mobile.locator('.show-speeches').click()
        await sleep(300)
        const mGrid = await mobile.locator('.speeches-panel.collapsed .players-grid').count()
        record('final2-mobile-show-speeches', '390x844', '移动端显示玩家备注可展开', mGrid === 1, `grid=${mGrid}`, merrs)
        await shot(mobile, 'final2-08-mobile-speeches.png')
        await mobile.close()
        await ctx.close()
    } finally {
        await browser.close()
    }
    const failed = results.filter(r => !r.passed)
    console.log(`\n=== 结果汇总：${results.length} 项断言，失败 ${failed.length} 项 ===`)
    for (const f of failed) console.log('FAILED:', f.name, f.action, f.detail)
    fs.writeFileSync(path.join(OUT, 'final2-results.json'), JSON.stringify(results, null, 2), 'utf8')
    process.exit(failed.length ? 1 : 0)
}

main().catch(err => { console.error('SCRIPT ERROR:', err); process.exit(2) })
