import test from 'node:test'
import assert from 'node:assert/strict'
import {buildStrategyPrompt, createSession, insertSpeechTemplate, loadSession, migrateV2Session, makeVoteText} from '../src/lib/gameSession.js'

test('migrates legacy records to v3 text rounds without deleting their content', () => {
  const values = {remarks: '旧备注', chatRecords: JSON.stringify({player01: {message: '我是预言家', election: 1}})}
  const session = loadSession({getItem: key => values[key] || null, setItem() {}})
  assert.equal(session.schemaVersion, 3)
  assert.equal(session.rounds[0].speeches[1].text, '我是预言家')
  assert.equal(session.overallNotes, '旧备注')
  assert.equal(session.players[1].electionStatus, 'candidate')
})

test('conservatively converts v2 events into public and private text', () => {
  const session = migrateV2Session({schemaVersion: 2, user: {seat: 8, role: '狼人', camp: '狼人', privateNote: ''}, players: {}, rounds: [{id: 'night', label: '第一夜', sequence: 1, speeches: {1: {text: '发言', tags: []}}}], events: [{roundId: 'night', type: 'attack', targetPlayers: [11], visibility: 'public'}, {roundId: 'night', type: 'inspect', actorPlayer: 8, targetPlayers: [3], result: '好人', visibility: 'private'}], remarks: '旧判断'})
  assert.match(session.rounds[0].publicEvents, /狼人攻击11号/)
  assert.match(session.game.privateInfo, /第一夜.*8号查验3号/)
  assert.equal(session.overallNotes, '旧判断')
})

test('keeps three speech flags independent and never overwrites text', () => {
  const session = createSession()
  session.rounds[0].speeches[4] = {text: '我先听后置位。', flags: {noSpeech: true, lowInformation: true, noLastWords: true}}
  const prompt = buildStrategyPrompt(session)
  assert.match(prompt, /4号：我先听后置位/) 
  assert.match(prompt, /本轮未发言/) 
  assert.match(prompt, /用户标记为滑水/) 
  assert.match(prompt, /无遗言/) 
})

test('preserves distinct round speeches when switching rounds', () => {
  const session = createSession()
  session.rounds[0].speeches[1] = {text: '警上发言', flags: {}}
  session.rounds.push({id: 'r2', label: '第一天警下', publicEvents: '', speeches: {1: {text: '警下发言', flags: {}}}})
  assert.equal(session.rounds[0].speeches[1].text, '警上发言')
  assert.equal(session.rounds[1].speeches[1].text, '警下发言')
})

test('inserts editable speech templates and optional vote text', () => {
  assert.equal(insertSpeechTemplate('', 'gold-water', 8), '给8号发金水。')
  assert.equal(insertSpeechTemplate('原话', 'seer'), '原话\n自称预言家。')
  assert.equal(makeVoteText([{target: 4, voters: [1, 6, 7]}, {target: 1, voters: [3, 5]}], [2], 4), '4号被1、6、7号投票；1号被3、5号投票；2号弃票；最终4号被放逐。')
})

test('keeps private information separate and changes strategy with role camp', () => {
  const session = createSession()
  session.game = {modeId: 1, mySeat: 8, myRole: '狼人', myCamp: '狼人', privateInfo: '队友是1、4号。'}
  session.rounds[0].publicEvents = '4号被放逐。'
  let prompt = buildStrategyPrompt(session)
  assert.match(prompt, /【用户私有信息】/) 
  assert.match(prompt, /提高狼队胜率/) 
  session.game.myRole = '平民'; session.game.myCamp = '好人'
  prompt = buildStrategyPrompt(session)
  assert.match(prompt, /找出狼人/) 
  assert.doesNotMatch(prompt, /提高狼队胜率/) 
})

test('does not compact full output unless a limit or compact mode is requested', () => {
  const session = createSession()
  session.game.privateInfo = '这段私有信息必须保留。'
  session.rounds[0].publicEvents = '这条公共事件必须保留。'
  session.rounds[0].speeches[8] = {text: '当前轮完整发言必须保留。'.repeat(20), flags: {}}
  session.rounds.push({id: 'old', label: '第一天', publicEvents: '', speeches: {1: {text: '旧轮次完整发言'.repeat(30), flags: {}}}})
  session.currentRoundId = 'round-1'
  assert.match(buildStrategyPrompt(session), /旧轮次完整发言/) 
  assert.match(buildStrategyPrompt(session, {compactEarlierRounds: true}), /…/) 
  const limited = buildStrategyPrompt(session, {maxCharacters: 200})
  assert.match(limited, /这段私有信息必须保留/) 
  assert.match(limited, /这条公共事件必须保留/) 
  assert.match(limited, /当前轮完整发言必须保留/) 
})
