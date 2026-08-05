import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
    buildPrivateInfoText, buildStrategyPrompt, CAMP_MAP, createRound, createSession, defaultPrivate, hasSavedSession,
    inferCamp, isSessionReady, loadSession, normalizeSession, privateTypeForRole, resolveInitialView,
    ROLE_ALIAS, saveSession, SESSION_KEY, syncPrivateInfo
} from '../src/lib/gameSession.js'

const mockStorage = (initial = {}) => {
    const data = new Map(Object.entries(initial))
    return {getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, value)}
}

// 1. 应用初始页面始终为首页
test('应用初始页面始终为首页', () => {
    assert.equal(resolveInitialView(), 'home')
})

// 2. 保存的会话不会自动决定当前页面
test('保存的会话不会自动决定当前页面', () => {
    const storage = mockStorage({[SESSION_KEY]: JSON.stringify(createSession())})
    assert.equal(hasSavedSession(storage), true)
    assert.equal(resolveInitialView(storage), 'home')
    assert.equal(resolveInitialView({hasSession: true}), 'home')
})

// 3. 完整会话可以继续（轮次、发言、私有信息完整恢复）
test('完整会话可以继续（轮次与发言恢复）', () => {
    const storage = mockStorage()
    const session = createSession()
    session.game = {modeId: 2, mySeat: 8, myRole: '狼人', myCamp: '狼人', privateInfo: '', privateNotes: '', private: {type: 'wolf', knownTeammates: [1, 4], teammateState: 'known'}}
    syncPrivateInfo(session.game)
    session.rounds[0].speeches[1] = {text: '警上发言', flags: {}}
    session.rounds.push(createRound({id: 'r2', label: '第一天', publicEvents: '1号被放逐。', privateNotes: '', speeches: {3: {text: '警下发言', flags: {}}}}))
    session.currentRoundId = 'r2'
    saveSession(storage, session)
    const restored = loadSession(storage)
    assert.equal(restored.game.modeId, 2)
    assert.equal(restored.game.mySeat, 8)
    assert.match(restored.game.privateInfo, /已知狼队友是1号和4号/)
    assert.equal(restored.rounds[0].speeches[1].text, '警上发言')
    assert.equal(restored.rounds[1].publicEvents, '1号被放逐。')
    assert.equal(restored.rounds[1].speeches[3].text, '警下发言')
    assert.equal(restored.currentRoundId, 'r2')
})

// 4. 不完整开局信息不能进入记录台
test('不完整开局信息不能进入记录台', () => {
    assert.equal(isSessionReady({modeId: null, mySeat: 8, myRole: '狼人', myCamp: '狼人'}), false)
    assert.equal(isSessionReady({modeId: 2, mySeat: null, myRole: '狼人', myCamp: '狼人'}), false)
    assert.equal(isSessionReady({modeId: 2, mySeat: 8, myRole: '', myCamp: '狼人'}), false)
    assert.equal(isSessionReady({modeId: 2, mySeat: 8, myRole: '狼人', myCamp: ''}), false)
    assert.equal(isSessionReady({}), false)
    assert.equal(isSessionReady({modeId: 2, mySeat: 8, myRole: '狼人', myCamp: '狼人'}), true)
})

// 5. 新对局确认前不覆盖旧数据
test('新对局确认前不覆盖旧数据', () => {
    const storage = mockStorage()
    const old = createSession()
    old.rounds[0].publicEvents = '旧对局的公共事件。'
    saveSession(storage, old)
    // 用户在开局设置填了一部分（未确认），不写入 storage
    const draft = createSession()
    draft.game.modeId = 5
    draft.game.mySeat = 2
    assert.equal(storage.getItem(SESSION_KEY), JSON.stringify(old))
    // 最终确认后才替换
    const confirmed = createSession()
    confirmed.game = {modeId: 5, mySeat: 2, myRole: '预言家', myCamp: '好人', privateInfo: '', privateNotes: '', private: defaultPrivate('seer')}
    confirmed.game.private.checks = [{round: '第一夜', target: 3, result: '好人'}]
    syncPrivateInfo(confirmed.game)
    saveSession(storage, confirmed)
    const now = loadSession(storage)
    assert.equal(now.game.modeId, 5)
    assert.equal(now.rounds[0].publicEvents, '')
    assert.doesNotMatch(now.rounds[0].publicEvents, /旧对局/)
})

// 6. 身份到阵营映射
test('身份到阵营映射：狼人/好人/第三方/未知', () => {
    for (const role of ['狼', '狼王', '白狼', '狼妃', '狼鸦', '觉狼', '美', '赤月', '噩', '石', '觉王', '寂夜', '恶夜']) {
        assert.equal(inferCamp(role), '狼人', `${role} 应为狼人`)
    }
    for (const role of ['民', '预', '女', '猎', '守', '愚', '商', '幸', '梦', '骑', '猎魔', '巫', '纯', '羊驼', '白猫', '河豚', '子狐', '熊', '香', '觉预', '贵', '觉愚', '王子', '白昼', '术', '墓', '炼金', '鸦', '侍', '爵', '觉女', '觉隐', '镜', '觉美', '觉猎', '觉孤', '孤独']) {
        assert.equal(inferCamp(role), '好人', `${role} 应为好人`)
    }
    for (const role of ['丘', '咒狐']) {
        assert.equal(inferCamp(role), '第三方', `${role} 应为第三方`)
    }
    for (const role of ['千面', '', undefined, '自定义']) {
        assert.equal(inferCamp(role), '', `${String(role)} 应为未知（手动选阵营）`)
    }
    assert.equal(inferCamp('平民'), '好人')
    assert.equal(inferCamp('白狼王'), '狼人')
    assert.equal(inferCamp('丘比特'), '第三方')
    // 版型配置中的全部简称都有别名（界面可显示全称）；阵营映射除"千面"（设计为手动选择）外全部明确
    const modes = JSON.parse(readFileSync(new URL('../src/data/game-mode-configs.json', import.meta.url), 'utf8'))
    const shorts = new Set(modes.flatMap(mode => mode.roles.map(role => role.text)))
    const manualCampRoles = ['千面']
    for (const short of shorts) {
        assert.ok(ROLE_ALIAS[short], `简称 ${short} 应有全称别名`)
        assert.ok(CAMP_MAP[short] !== undefined || manualCampRoles.includes(short), `简称 ${short} 应有阵营映射或属于手动选择名单`)
    }
})

// 7. 狼人队友信息格式化（纯函数，不含"我是X号Y"头部；支持跨身份通用补充）
test('狼人队友信息格式化', () => {
    assert.equal(buildPrivateInfoText({type: 'wolf', knownTeammates: [1, 4, 12], teammateState: 'known'}), '已知狼队友是1号、4号和12号。')
    assert.equal(buildPrivateInfoText({type: 'wolf', knownTeammates: [], teammateState: 'none'}), '没有已知狼队友。')
    assert.equal(buildPrivateInfoText({type: 'wolf', knownTeammates: [], teammateState: 'solo'}), '独立狼人或特殊身份。')
    assert.equal(buildPrivateInfoText({type: 'wolf', knownTeammates: [], teammateState: 'unknown'}), '暂时不确定。')
    assert.equal(buildPrivateInfoText({type: 'wolf', knownTeammates: [1], teammateState: 'known'}, '3号行为反常'), '已知狼队友是1号。\n补充：3号行为反常')
})

// 8. 预言家查验信息格式化
test('预言家查验信息格式化', () => {
    assert.equal(buildPrivateInfoText({type: 'seer', checks: [{round: '第一夜', target: 3, result: '好人'}]}), '第一夜查验3号为好人。')
    const multi = buildPrivateInfoText({type: 'seer', checks: [{round: '第一夜', target: 3, result: '好人'}, {round: '第一夜', target: 8, result: '狼人'}]})
    assert.equal(multi, '第一夜查验3号为好人；第一夜查验8号为狼人。')
    assert.equal(buildPrivateInfoText({type: 'seer', checks: [], state: 'none'}), '尚未查验或暂未记录。')
})

// 9. 女巫药物信息格式化
test('女巫药物信息格式化', () => {
    const text = buildPrivateInfoText({type: 'witch', nightKill: 8, saveUsed: 'used', saveTarget: 8, poisonUsed: 'none'})
    assert.match(text, /得知8号为刀口/)
    assert.match(text, /使用解药救下8号/)
    assert.match(text, /未使用毒药/)
    assert.match(buildPrivateInfoText({type: 'witch', nightKill: '', saveUsed: 'not-occurred', poisonUsed: 'unknown'}), /解药尚未发生，毒药暂不确定/)
    assert.match(buildPrivateInfoText({type: 'witch', nightKill: 9, saveUsed: 'used', saveTarget: 9, poisonUsed: 'used', poisonTarget: 3}), /使用毒药毒杀3号/)
})

// 10. 守卫守护信息格式化
test('守卫守护信息格式化', () => {
    assert.equal(buildPrivateInfoText({type: 'guard', target: 4, round: '第一夜'}), '第一夜守护4号。')
    assert.equal(buildPrivateInfoText({type: 'guard', target: null, state: 'none'}), '本轮未守护。')
    assert.equal(buildPrivateInfoText({type: 'guard', target: null, state: 'not-occurred'}), '尚未发生。')
})

// 11. 平民无额外私有信息
test('平民无额外私有信息', () => {
    assert.equal(buildPrivateInfoText({type: 'villager'}), '无额外夜间私有信息。')
    assert.equal(privateTypeForRole('民'), 'villager')
})

// 12. 修改身份不会清除轮次和发言
test('修改身份不会清除轮次和发言', () => {
    const session = createSession()
    session.rounds[0].speeches[1] = {text: '我站8号。', flags: {noSpeech: false}}
    session.rounds[0].publicEvents = '4号被放逐。'
    session.overallNotes = '整体备注'
    // 记录台内修改身份/阵营/私有信息
    session.game.myRole = '预言家'
    session.game.myCamp = inferCamp('预言家')
    session.game.private = defaultPrivate('seer')
    session.game.private.checks = [{round: '第一夜', target: 8, result: '狼人'}]
    syncPrivateInfo(session.game)
    assert.equal(session.rounds[0].speeches[1].text, '我站8号。')
    assert.equal(session.rounds[0].publicEvents, '4号被放逐。')
    assert.equal(session.overallNotes, '整体备注')
    assert.match(session.game.privateInfo, /查验8号为狼人/)
})

// 13. 刷新后的会话数据可以恢复（保存→加载往返一致）
test('刷新后的会话数据可以恢复', () => {
    const storage = mockStorage()
    const session = createSession()
    session.game = {modeId: 1, mySeat: 9, myRole: '守卫', myCamp: '好人', privateInfo: '', privateNotes: '', private: {type: 'guard', target: 2, round: '第二夜', state: 'none'}}
    syncPrivateInfo(session.game)
    session.rounds.push(createRound({id: 'r3', label: '第二天', publicEvents: '5号被放逐。', privateNotes: '', speeches: {9: {text: '我守了2号。', flags: {}}}}))
    session.currentRoundId = 'r3'
    saveSession(storage, session)
    const roundTrip = loadSession(storage)
    assert.deepEqual(roundTrip, session)
    assert.equal(roundTrip.currentRoundId, 'r3')
    assert.match(roundTrip.game.privateInfo, /第二夜守护2号/)
})

// 14. 双向回归：狼人 → 预言家
test('身份切换狼人→预言家：清除旧身份专属信息且不污染提示词', () => {
    const session = createSession()
    session.game = {modeId: 2, mySeat: 8, myRole: '狼人', myCamp: '狼人', privateInfo: '', privateNotes: '3号行为反常', private: {type: 'wolf', knownTeammates: [1, 4, 12], teammateState: 'known'}}
    syncPrivateInfo(session.game)
    session.rounds[0].speeches[1] = {text: '我站8号。', flags: {}}
    session.rounds[0].publicEvents = '4号被放逐。'
    session.overallNotes = '整体判断'
    // 模拟 useBoard.updateRole：只清结构化数据，保留 privateNotes
    session.game.myRole = '预言家'
    session.game.myCamp = inferCamp('预言家')
    session.game.private = defaultPrivate(privateTypeForRole('预言家'))
    session.game.private.checks = [{round: '第一夜', target: 3, result: '好人'}]
    syncPrivateInfo(session.game)
    const prompt = buildStrategyPrompt(session)
    assert.equal(session.rounds[0].speeches[1].text, '我站8号。') // 发言保留
    assert.equal(session.rounds[0].publicEvents, '4号被放逐。') // 公共事件保留
    assert.equal(session.overallNotes, '整体判断') // 整体备注保留
    assert.doesNotMatch(prompt, /已知狼队友/) // 旧狼人信息消失
    assert.doesNotMatch(prompt, /1、4、12/) // 旧队友消失
    assert.match(prompt, /查验3号为好人/) // 当前预言家查验
    assert.match(prompt, /找出狼人/) // 好人策略目标
    assert.match(prompt, /补充：3号行为反常/) // privateNotes 按规则保留进提示词
})

// 15. 双向回归：女巫 → 平民
test('身份切换女巫→平民：清除药物信息且提示词无矛盾', () => {
    const session = createSession()
    session.game = {modeId: 2, mySeat: 6, myRole: '女巫', myCamp: '好人', privateInfo: '', privateNotes: '', private: {type: 'witch', nightKill: 8, saveUsed: 'used', saveTarget: 8, poisonUsed: 'none'}}
    syncPrivateInfo(session.game)
    session.rounds[0].speeches[1] = {text: '发言保留。', flags: {}}
    session.game.myRole = '平民'
    session.game.myCamp = inferCamp('平民')
    session.game.private = defaultPrivate(privateTypeForRole('平民'))
    syncPrivateInfo(session.game)
    const prompt = buildStrategyPrompt(session)
    assert.equal(session.rounds[0].speeches[1].text, '发言保留。')
    assert.doesNotMatch(prompt, /得知8号为刀口/)
    assert.doesNotMatch(prompt, /使用解药救下8号/)
    assert.doesNotMatch(prompt, /使用毒药毒杀/)
    assert.match(prompt, /无额外夜间私有信息/)
    assert.match(prompt, /找出狼人/)
})

// 16. 非公开信息：不同轮次互不覆盖
test('不同轮次的非公开信息互不覆盖', () => {
    const session = createSession()
    session.rounds[0].privateNotes = '第一夜狼队刀11号。'
    session.rounds.push({id: 'r2', label: '第一天', publicEvents: '', privateNotes: '第二夜我建议刀6号。', speeches: {}})
    assert.equal(session.rounds[0].privateNotes, '第一夜狼队刀11号。')
    assert.equal(session.rounds[1].privateNotes, '第二夜我建议刀6号。')
})

// 17. 非公开信息：刷新/继续上一局后恢复
test('刷新后非公开信息可恢复', () => {
    const storage = mockStorage()
    const session = createSession()
    session.rounds[0].privateNotes = '我是女巫，救了8号。'
    saveSession(storage, session)
    const restored = loadSession(storage)
    assert.equal(restored.rounds[0].privateNotes, '我是女巫，救了8号。')
})

// 18. 非公开信息：不进入公共事实段
test('非公开信息不进入公共事实段', () => {
    const session = createSession()
    session.rounds[0].publicEvents = '4号被放逐。'
    session.rounds[0].privateNotes = '狼队刀了11号。'
    const prompt = buildStrategyPrompt(session)
    const publicBlock = prompt.split('【用户掌握的非公开信息】')[0]
    assert.doesNotMatch(publicBlock, /狼队刀了11号/)
    assert.match(prompt, /4号被放逐/)
})

// 19. 非公开信息：进入专门段落
test('非公开信息进入专门段落', () => {
    const session = createSession()
    session.rounds[0].privateNotes = '狼队刀了11号。'
    const prompt = buildStrategyPrompt(session)
    assert.match(prompt, /【用户掌握的非公开信息】/)
    assert.match(prompt, /狼队刀了11号/)
    assert.match(prompt, /不能假设其他玩家也知道/)
})

// 20. 非公开信息：删改不影响发言与公共事件
test('修改非公开信息不影响发言与公共事件', () => {
    const session = createSession()
    session.rounds[0].speeches[1] = {text: '发言', flags: {}}
    session.rounds[0].publicEvents = '公共事件'
    session.rounds[0].privateNotes = '旧非公开'
    session.rounds[0].privateNotes = '新非公开'
    assert.equal(session.rounds[0].speeches[1].text, '发言')
    assert.equal(session.rounds[0].publicEvents, '公共事件')
    assert.equal(session.rounds[0].privateNotes, '新非公开')
})

// 21. 非公开信息：好人/狼人/第三方提示词均不假设他人掌握
test('好人/狼人/第三方提示词均不假设他人掌握非公开信息', () => {
    for (const camp of ['好人', '狼人', '第三方']) {
        const session = createSession()
        session.game = {modeId: 1, mySeat: 8, myRole: '狼人', myCamp: camp, privateInfo: '', privateNotes: ''}
        session.rounds[0].privateNotes = '狼队刀了11号。'
        const prompt = buildStrategyPrompt(session)
        assert.match(prompt, /不得假设其他玩家知道用户掌握的非公开信息/, `阵营 ${camp} 提示词应含非公开信息约束`)
        assert.match(prompt, /不得建议用户无理由公开自己的隐藏身份或秘密信息/, `阵营 ${camp} 提示词应含不暴露身份约束`)
    }
})

// 22. 旧会话迁移：补齐 round.privateNotes 与 game.privateNotes，不自动迁移 privateInfo
test('旧会话迁移补齐新字段且不自动迁移 privateInfo', () => {
    const old = {schemaVersion: 3, game: {modeId: 1, mySeat: 8, myRole: '狼人', myCamp: '狼人', privateInfo: '旧文本'}, players: {}, rounds: [{id: 'r1', label: '第一夜', publicEvents: 'x', speeches: {}}], currentRoundId: 'r1', overallNotes: '', uiPreferences: {theme: 'light'}}
    const normalized = normalizeSession(JSON.parse(JSON.stringify(old)))
    assert.equal(normalized.game.privateNotes, '')
    assert.equal(normalized.rounds[0].privateNotes, '')
    assert.equal(normalized.game.privateInfo, '旧文本') // 保留作提示词回退读取
})
