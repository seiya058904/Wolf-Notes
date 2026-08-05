import test from 'node:test'
import assert from 'node:assert/strict'
import {buildStrategyPrompt, clearRoundPrivateNotes, confirmRoundPrivateNotes, createRound, createSession, markRoundPrivateNotesForReview, resetPrivateForRole} from '../src/lib/gameSession.js'

test('resetPrivateForRole replaces stale structured private data after a role switch', () => {
  const game = {private: {type: 'wolf', knownTeammates: [3], teammateState: 'known'}, privateNotes: '通用补充', privateInfo: '旧狼人信息'}
  resetPrivateForRole(game, 'seer', true)
  assert.equal(game.private.type, 'seer')
  assert.deepEqual(game.private.checks, [])
  assert.equal(game.privateNotes, '通用补充')
  assert.match(game.privateInfo, /尚未查验/)
})

test('markRoundPrivateNotesForReview flags only rounds with private notes and keeps content', () => {
  const session = createSession()
  session.rounds[0].privateNotes = '第一夜狼队最终刀11号。'
  session.rounds.push(createRound({label: '第一天'}))
  session.rounds[1].privateNotes = '白天观察6号可疑。'
  session.rounds.push(createRound({label: '第二夜'}))
  // 第三轮无 privateNotes
  const marked = markRoundPrivateNotesForReview(session)
  assert.equal(marked, 2)
  assert.equal(session.rounds[0].privateNotesNeedsReview, true)
  assert.equal(session.rounds[1].privateNotesNeedsReview, true)
  assert.equal(session.rounds[2].privateNotesNeedsReview, false)
  // 内容不丢失
  assert.equal(session.rounds[0].privateNotes, '第一夜狼队最终刀11号。')
  assert.equal(session.rounds[1].privateNotes, '白天观察6号可疑。')
})

test('reviewable private notes go into separate prompt section, not normal private section', () => {
  const session = createSession()
  session.game = {modeId: 1, mySeat: 8, myRole: '预言家', myCamp: '好人'}
  session.rounds[0].privateNotes = '第一夜狼队最终刀11号。建议刀6号。'
  session.rounds[0].privateNotesNeedsReview = true
  session.rounds.push(createRound({label: '第一天'}))
  session.rounds[1].privateNotes = '6号发言跳预言家。'
  const prompt = buildStrategyPrompt(session)
  // 待复核段存在且含说明文案
  assert.match(prompt, /【身份切换后保留、尚待复核的非公开信息】/)
  assert.match(prompt, /以下内容可能来自用户原身份/)
  // 待复核内容出现在待复核段
  assert.match(prompt, /第一夜狼队最终刀11号/)
  // 正常轮次的非公开信息仍在普通段
  assert.match(prompt, /6号发言跳预言家/)
})

test('reviewable content does not appear in normal private section of the same round', () => {
  const session = createSession()
  session.game = {modeId: 1, mySeat: 8, myRole: '预言家', myCamp: '好人'}
  session.rounds[0].privateNotes = '第一夜狼队最终刀11号。'
  session.rounds[0].privateNotesNeedsReview = true
  const prompt = buildStrategyPrompt(session)
  // 待复核段存在且含内容
  assert.match(prompt, /【身份切换后保留、尚待复核的非公开信息】/)
  assert.match(prompt, /第一夜狼队最终刀11号/)
  // 唯一轮次的非公开信息全部待复核时，不应出现普通【用户掌握的非公开信息】段
  assert.doesNotMatch(prompt, /【用户掌握的非公开信息】/)
})

test('confirmed round notes return to normal private section', () => {
  const session = createSession()
  session.game = {modeId: 1, mySeat: 8, myRole: '预言家', myCamp: '好人'}
  session.rounds[0].privateNotes = '第一夜狼队最终刀11号。'
  session.rounds[0].privateNotesNeedsReview = true
  // 用户确认
  confirmRoundPrivateNotes(session.rounds[0])
  assert.equal(session.rounds[0].privateNotesNeedsReview, false)
  const prompt = buildStrategyPrompt(session)
  // 不再有待复核段
  assert.doesNotMatch(prompt, /【身份切换后保留、尚待复核的非公开信息】/)
  // 内容回到普通非公开信息段
  assert.match(prompt, /【用户掌握的非公开信息】/)
  assert.match(prompt, /第一夜狼队最终刀11号/)
})

test('clearRoundPrivateNotes clears notes and review flags but keeps speeches and public events', () => {
  const session = createSession()
  session.rounds[0].privateNotes = '第一夜狼队最终刀11号。'
  session.rounds[0].privateNotesNeedsReview = true
  session.rounds[0].publicEvents = '1号和11号昨夜死亡。'
  session.rounds[0].speeches[3] = {text: '我跳预言家。', flags: {noSpeech: false, lowInformation: false, noLastWords: false}}
  const cleared = clearRoundPrivateNotes(session)
  assert.equal(cleared, 1)
  // 非公开信息被清空
  assert.equal(session.rounds[0].privateNotes, '')
  // 待复核标记被清除
  assert.equal(session.rounds[0].privateNotesNeedsReview, false)
  // 公共信息保留
  assert.equal(session.rounds[0].publicEvents, '1号和11号昨夜死亡。')
  // 发言保留
  assert.equal(session.rounds[0].speeches[3].text, '我跳预言家。')
})

test('full role switch flow: wolf records kill, switches to seer, keeps as reviewable then confirms', () => {
  const session = createSession()
  session.game = {modeId: 1, mySeat: 8, myRole: '狼人', myCamp: '狼人'}
  session.rounds[0].privateNotes = '第一夜狼队最终刀11号。建议刀6号。'
  session.rounds.push(createRound({label: '第二夜'}))
  session.rounds[1].privateNotes = '第二夜狼队刀9号。'
  // 用户切换身份为预言家，选"保留并自行检查"
  const marked = markRoundPrivateNotesForReview(session)
  assert.equal(marked, 2)
  session.game.myRole = '预言家'
  session.game.myCamp = '好人'
  // 提示词中待复核段包含两轮的刀口信息
  const prompt = buildStrategyPrompt(session)
  assert.match(prompt, /【身份切换后保留、尚待复核的非公开信息】/)
  assert.match(prompt, /第一夜狼队最终刀11号/)
  assert.match(prompt, /第二夜狼队刀9号/)
  // 头部身份已是预言家
  assert.match(prompt, /真实身份：预言家/)
  // 两轮非公开信息都待复核时，不应出现普通【用户掌握的非公开信息】段
  assert.doesNotMatch(prompt, /【用户掌握的非公开信息】/)
  // 用户确认第一轮
  confirmRoundPrivateNotes(session.rounds[0])
  const prompt2 = buildStrategyPrompt(session)
  // 第一轮内容回到普通非公开信息段
  assert.match(prompt2, /【用户掌握的非公开信息】/)
  assert.match(prompt2, /第一夜狼队最终刀11号/)
  // 第二轮仍在待复核段
  assert.match(prompt2, /【身份切换后保留、尚待复核的非公开信息】/)
  assert.match(prompt2, /第二夜狼队刀9号/)
})

test('createRound includes privateNotesNeedsReview default false', () => {
  const round = createRound({label: '第一夜'})
  assert.equal(round.privateNotesNeedsReview, false)
})

test('reviewable section stays intact under compact mode', () => {
  const session = createSession()
  session.game = {modeId: 1, mySeat: 8, myRole: '预言家', myCamp: '好人'}
  session.rounds[0].privateNotes = '第一夜狼队最终刀11号。'.repeat(10)
  session.rounds[0].privateNotesNeedsReview = true
  session.rounds.push(createRound({label: '第一天'}))
  session.rounds[1].speeches[1] = {text: '长发言'.repeat(50), flags: {}}
  const prompt = buildStrategyPrompt(session, {compactEarlierRounds: true})
  // 待复核段保持完整（不压缩）
  assert.match(prompt, /【身份切换后保留、尚待复核的非公开信息】/)
  assert.match(prompt, /第一夜狼队最终刀11号。第一夜狼队最终刀11号。/)
})
