import test from 'node:test'
import assert from 'node:assert/strict'
import {
    buildStrategyPrompt, chineseNumber, clearRoundPrivateNotes, createRound, createSession, loadSession, nextRoundMeta,
    normalizeSession, privateNoteRoundCount, resolveNextRound, saveSession, SESSION_KEY, speechesVisibleByDefault,
    standardRoundMeta
} from '../src/lib/gameSession.js'

const mockStorage = (initial = {}) => {
    const data = new Map(Object.entries(initial))
    return {getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value)}
}

// 1. 新对局自动创建第一夜
test('新对局自动创建第一夜', () => {
    const session = createSession()
    assert.equal(session.rounds.length, 1)
    assert.equal(session.rounds[0].label, '第一夜')
    assert.equal(session.rounds[0].dayNumber, 1)
    assert.equal(session.rounds[0].period, 'night')
    assert.equal(session.rounds[0].isCustom, false)
    assert.equal(session.currentRoundId, session.rounds[0].id)
})

// 2. 第一夜下一阶段为第一天
test('第一夜下一阶段为第一天', () => {
    const meta = nextRoundMeta({dayNumber: 1, period: 'night'})
    assert.equal(meta.label, '第一天')
    assert.equal(meta.dayNumber, 1)
    assert.equal(meta.period, 'day')
})

// 3. 第一天下一阶段为第二夜
test('第一天下一阶段为第二夜', () => {
    const meta = nextRoundMeta({dayNumber: 1, period: 'day'})
    assert.equal(meta.label, '第二夜')
    assert.equal(meta.dayNumber, 2)
    assert.equal(meta.period, 'night')
})

// 4. 第二夜下一阶段为第二天
test('第二夜下一阶段为第二天', () => {
    const meta = nextRoundMeta({dayNumber: 2, period: 'night'})
    assert.equal(meta.label, '第二天')
    assert.equal(meta.dayNumber, 2)
    assert.equal(meta.period, 'day')
})

// 5. 已有下一轮时不重复创建（只切换）
test('已有下一轮时不重复创建', () => {
    const session = createSession()
    session.rounds.push(createRound({id: 'r2', label: '第一天'}))
    const decision = resolveNextRound(session.rounds, 'round-1')
    assert.equal(decision.type, 'switch')
    assert.equal(decision.target, 'r2')
    // 切换后列表长度不变
    const next = resolveNextRound(session.rounds, decision.target)
    assert.equal(next.type, 'create') // 末尾才创建
    assert.equal(session.rounds.length, 2)
})

// 6. 继续上一局不重复创建第一夜
test('继续上一局不重复创建第一夜', () => {
    const storage = mockStorage()
    const session = createSession()
    session.rounds.push(createRound({id: 'r2', label: '第一天'}))
    saveSession(storage, session)
    const restored = loadSession(storage)
    assert.equal(restored.rounds.length, 2)
    assert.equal(restored.rounds[0].label, '第一夜')
    assert.equal(restored.rounds[1].label, '第一天')
})

// 7. 无轮次旧会话安全补充第一夜
test('无轮次旧会话安全补充第一夜', () => {
    const old = {schemaVersion: 3, game: {modeId: 1}, rounds: [], currentRoundId: ''}
    const normalized = normalizeSession(JSON.parse(JSON.stringify(old)))
    assert.equal(normalized.rounds.length, 1)
    assert.equal(normalized.rounds[0].label, '第一夜')
    assert.equal(normalized.currentRoundId, normalized.rounds[0].id)
})

// 8. 标准旧标签能够迁移出 dayNumber 和 period
test('标准旧标签迁移出 dayNumber 和 period', () => {
    const cases = [
        ['第一夜', 1, 'night'], ['第一天', 1, 'day'], ['第二夜', 2, 'night'], ['第二天', 2, 'day'],
        ['第三夜', 3, 'night'], ['第十天', 10, 'day'], ['第11夜', 11, 'night'], ['第十二天', 12, 'day']
    ]
    for (const [label, dayNumber, period] of cases) {
        const meta = standardRoundMeta(label)
        assert.deepEqual(meta, {dayNumber, period}, `${label} 应识别为 ${dayNumber}/${period}`)
    }
    const old = {schemaVersion: 3, game: {}, rounds: [{id: 'r1', label: '第二夜', publicEvents: 'x', speeches: {}}], currentRoundId: 'r1'}
    const normalized = normalizeSession(JSON.parse(JSON.stringify(old)))
    assert.equal(normalized.rounds[0].dayNumber, 2)
    assert.equal(normalized.rounds[0].period, 'night')
    assert.equal(normalized.rounds[0].isCustom, false)
    assert.equal(normalized.rounds[0].label, '第二夜') // 不改标签
})

// 9. 未知标签迁移为自定义轮次
test('未知标签迁移为自定义轮次', () => {
    const old = {schemaVersion: 3, game: {}, rounds: [{id: 'r1', label: '第一天警上', publicEvents: '', speeches: {}}], currentRoundId: 'r1'}
    const normalized = normalizeSession(JSON.parse(JSON.stringify(old)))
    assert.equal(normalized.rounds[0].isCustom, true)
    assert.equal(normalized.rounds[0].period, 'custom')
    assert.equal(normalized.rounds[0].dayNumber, null)
    assert.equal(normalized.rounds[0].label, '第一天警上')
})

// 10. 自定义轮次不破坏已有发言和备注
test('自定义轮次不破坏已有发言和备注', () => {
    const old = {schemaVersion: 3, game: {}, rounds: [{id: 'r1', label: '特殊盘', publicEvents: '公共', privateNotes: '非公开', speeches: {1: {text: '发言', flags: {}}}}], currentRoundId: 'r1'}
    const normalized = normalizeSession(JSON.parse(JSON.stringify(old)))
    assert.equal(normalized.rounds[0].publicEvents, '公共')
    assert.equal(normalized.rounds[0].privateNotes, '非公开')
    assert.equal(normalized.rounds[0].speeches[1].text, '发言')
    assert.equal(normalized.rounds[0].isCustom, true)
})

// 11. 创建下一阶段不覆盖当前轮发言（新轮次独立对象）
test('创建下一阶段不覆盖当前轮发言', () => {
    const session = createSession()
    session.rounds[0].speeches[1] = {text: '第一夜发言', flags: {}}
    const decision = resolveNextRound(session.rounds, session.currentRoundId)
    assert.equal(decision.type, 'create')
    const next = createRound(decision.meta)
    session.rounds.push(next)
    session.currentRoundId = next.id
    assert.equal(session.rounds[0].speeches[1].text, '第一夜发言')
    assert.deepEqual(session.rounds[1].speeches, {})
    assert.equal(session.rounds[1].label, '第一天')
})

// 12. 不同昼夜轮次的公共信息和非公开信息互不覆盖
test('不同昼夜轮次的信息互不覆盖', () => {
    const session = createSession()
    const firstDay = createRound({label: '第一天'})
    session.rounds.push(firstDay)
    session.rounds[0].publicEvents = '1号死亡。'
    session.rounds[0].privateNotes = '狼队刀1号。'
    session.rounds[1].publicEvents = '4号被放逐。'
    session.rounds[1].privateNotes = '建议刀9号。'
    assert.equal(session.rounds[0].publicEvents, '1号死亡。')
    assert.equal(session.rounds[0].privateNotes, '狼队刀1号。')
    assert.equal(session.rounds[1].publicEvents, '4号被放逐。')
    assert.equal(session.rounds[1].privateNotes, '建议刀9号。')
})

// 附加：中文数字格式与 >10 天支持
test('中文数字格式（含第十天/第11夜）', () => {
    assert.equal(chineseNumber(1), '一')
    assert.equal(chineseNumber(10), '十')
    assert.equal(chineseNumber(11), '十一')
    assert.equal(chineseNumber(20), '二十')
    assert.equal(chineseNumber(21), '二十一')
    assert.equal(nextRoundMeta({dayNumber: 11, period: 'day'}).label, '第十二夜')
    assert.equal(createRound({id: 'x', label: '第十一天'}).dayNumber, 11)
})

// 8. 夜晚默认折叠发言区（speechesVisibleByDefault）
test('夜晚默认折叠发言区', () => {
    assert.equal(speechesVisibleByDefault('night'), false)
    assert.equal(speechesVisibleByDefault('custom'), true)
})

// 9. 白天默认显示发言区
test('白天默认显示发言区', () => {
    assert.equal(speechesVisibleByDefault('day'), true)
})

// 10. 玩家发言不会出现在非公开信息段落下（提示词时间线分组）
test('玩家发言不会出现在非公开信息段落下', () => {
    const session = createSession()
    session.game = {modeId: 1, mySeat: 8, myRole: '预言家', myCamp: '好人', privateInfo: '', privateNotes: ''}
    // 第一夜：仅有非公开信息
    session.rounds[0].privateNotes = '第一夜狼队最终刀11号。'
    // 第一天：发言 + 公共信息 + 非公开信息
    const day1 = createRound({label: '第一天'})
    day1.speeches = {1: {text: '我站8号。', flags: {}}, 3: {text: '听2号像狼。', flags: {}}}
    day1.publicEvents = '4号被放逐。'
    day1.privateNotes = '建议刀6号。'
    session.rounds.push(day1)
    session.currentRoundId = day1.id
    const prompt = buildStrategyPrompt(session)
    // 按轮次时间线：第一夜 → 第一天；发言先于公共信息
    assert.ok(prompt.indexOf('【第一夜】') < prompt.indexOf('【第一天】'), '第一夜应排在第一天之前')
    assert.ok(prompt.indexOf('【玩家发言】') < prompt.indexOf('【公共信息】'), '发言应先于公共信息')
    // 逐轮检查：发言行只出现在【玩家发言】标题之后、绝不落在【用户掌握的非公开信息】标题之后
    const firstPrivate = prompt.indexOf('【用户掌握的非公开信息】')
    const lastSpeechLine = Math.max(prompt.indexOf('1号：我站8号'), prompt.indexOf('3号：听2号像狼'))
    // 第一天的发言必须位于第一夜非公开信息段落之后（时间线正确），且位于第一天非公开信息段落之前
    const day1Private = prompt.lastIndexOf('【用户掌握的非公开信息】')
    assert.ok(lastSpeechLine > firstPrivate, '第一天发言应在第一夜非公开信息段落之后')
    assert.ok(lastSpeechLine < day1Private, '第一天发言不能落在第一天非公开信息段落之后')
    // 非公开信息段落内容中不得出现发言行
    const privateTail = prompt.slice(day1Private)
    assert.doesNotMatch(privateTail, /\d+号：/, '非公开信息段内不得出现玩家发言行')
    // 公共信息与非公开信息各自归位
    assert.ok(prompt.indexOf('4号被放逐。') > prompt.indexOf('【公共信息】'), '公共信息应在公共信息段落')
    assert.ok(prompt.indexOf('建议刀6号。') > prompt.indexOf('【用户掌握的非公开信息】'), '非公开信息应在非公开段落')
})

// 11. 身份切换且存在轮次非公开信息时触发复核（privateNoteRoundCount 驱动）
test('身份切换且存在轮次非公开信息时触发复核', () => {
    const session = createSession()
    assert.equal(privateNoteRoundCount(session), 0, '无轮次非公开信息时不需要复核')
    session.rounds[0].privateNotes = '狼队刀11号。'
    assert.equal(privateNoteRoundCount(session), 1, '存在1个轮次非公开信息时应触发复核')
    session.rounds.push(createRound({id: 'r2', label: '第一天', privateNotes: ' \n '}))
    assert.equal(privateNoteRoundCount(session), 1, '空白非公开信息不计数')
    session.rounds[1].privateNotes = '建议刀6号。'
    assert.equal(privateNoteRoundCount(session), 2)
})

// 12. 选择清空只清 round.privateNotes，不清发言和公共信息
test('清空非公开信息只清 privateNotes', () => {
    const session = createSession()
    session.rounds[0].privateNotes = '狼队刀11号。'
    session.rounds[0].publicEvents = '4号被放逐。'
    session.rounds[0].speeches[1] = {text: '我站8号。', flags: {}}
    session.overallNotes = '整体备注'
    const cleared = clearRoundPrivateNotes(session)
    assert.equal(cleared, 1)
    assert.equal(session.rounds[0].privateNotes, '', 'privateNotes 应被清空')
    assert.equal(session.rounds[0].publicEvents, '4号被放逐。', '公共信息保留')
    assert.equal(session.rounds[0].speeches[1].text, '我站8号。', '发言保留')
    assert.equal(session.overallNotes, '整体备注', '整体备注保留')
})

// 13. 选择保留后内容不丢
test('选择保留后非公开信息不丢', () => {
    const session = createSession()
    session.rounds[0].privateNotes = '狼队刀11号。'
    session.rounds[0].speeches[3] = {text: '发言', flags: {}}
    // 模拟"保留并自行检查"：不调用 clearRoundPrivateNotes
    assert.equal(session.rounds[0].privateNotes, '狼队刀11号。')
    assert.equal(session.rounds[0].speeches[3].text, '发言')
    // 后续仍然可以正常生成提示词（内容完整保留）
    const prompt = buildStrategyPrompt(session)
    assert.match(prompt, /狼队刀11号/)
    assert.match(prompt, /发言/)
})
