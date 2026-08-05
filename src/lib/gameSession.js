export const SESSION_KEY = 'lrsNotesGameSession'

const seats = () => Object.fromEntries(Array.from({length: 12}, (_, index) => [index + 1, {lifeStatus: 'alive', electionStatus: 'none'}]))
const flags = () => ({noSpeech: false, lowInformation: false, noLastWords: false})
const speech = () => ({text: '', flags: flags()})
// ---- 轮次系统：按狼人杀固定昼夜顺序自动推进 ----

const CN_DIGIT = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

// 中文数字（1-99）：一..十、十一、二十、二十一…
export function chineseNumber(n) {
    n = Number(n)
    if (n < 1 || n > 99) return String(n)
    if (n <= 10) return CN_DIGIT[n] || '十'
    const tens = Math.floor(n / 10)
    const ones = n % 10
    const tenText = tens === 1 ? '十' : `${CN_DIGIT[tens]}十`
    return ones ? `${tenText}${CN_DIGIT[ones]}` : tenText
}

// 识别标准昼夜标签：第一夜/第一天/第二夜…第11夜…；识别失败返回 null
export function standardRoundMeta(label = '') {
    const match = /^第([0-9]+|[一二三四五六七八九十]+)([夜天])$/.exec(String(label).trim())
    if (!match) return null
    const text = match[1]
    let dayNumber
    if (/^\d+$/.test(text)) {
        dayNumber = Number(text)
    } else if (text === '十') {
        dayNumber = 10
    } else if (text.includes('十')) {
        const parts = text.split('十')
        dayNumber = (parts[0] ? CN_DIGIT.indexOf(parts[0]) : 1) * 10 + (parts[1] ? CN_DIGIT.indexOf(parts[1]) : 0)
    } else {
        dayNumber = CN_DIGIT.indexOf(text)
    }
    if (!dayNumber || dayNumber < 1) return null
    return {dayNumber, period: match[2] === '夜' ? 'night' : 'day'}
}

// 下一阶段：夜→日（同日），日→夜（天数+1）；自定义轮次按给定基准延续
export function nextRoundMeta(round = {}) {
    if (round.period === 'day') {
        const n = (round.dayNumber || 1) + 1
        return {dayNumber: n, period: 'night', label: `第${chineseNumber(n)}夜`}
    }
    const n = round.dayNumber || 1
    return {dayNumber: n, period: 'day', label: `第${chineseNumber(n)}天`}
}

// 决定"下一阶段"动作：列表中间→切换到已有下一项；末尾→按最后一个标准轮次创建新阶段
export function resolveNextRound(rounds = [], currentId = '') {
    const idx = rounds.findIndex(item => item.id === currentId)
    if (idx < 0) return {type: 'switch', target: rounds[0]?.id || null}
    if (idx < rounds.length - 1) return {type: 'switch', target: rounds[idx + 1].id}
    const lastStandard = [...rounds].reverse().find(item => !item.isCustom)
    return {type: 'create', meta: nextRoundMeta(lastStandard || {dayNumber: 1, period: 'night'})}
}

let roundSeq = 0
const roundId = () => `round-${Date.now()}-${++roundSeq}`

export function createRound(meta = {}) {
    const isCustom = Boolean(meta.isCustom ?? meta.period === 'custom')
    const recognized = !isCustom && !meta.period ? standardRoundMeta(meta.label || '') : null
    return {
        id: meta.id || roundId(),
        dayNumber: meta.dayNumber ?? (isCustom ? null : (recognized?.dayNumber ?? 1)),
        period: meta.period || (isCustom ? 'custom' : recognized?.period || 'night'),
        isCustom,
        label: meta.label || '第一夜',
        publicEvents: meta.publicEvents ?? '',
        privateNotes: meta.privateNotes ?? '',
        speeches: meta.speeches ?? {}
    }
}
const pad = seat => `${seat}号`

// 身份→阵营映射表：覆盖 src/data/game-mode-configs.json 全部 52 个版型简称与常用全称。
// 未知身份（如千面、自定义身份）不在此表，返回空串，由用户手动选择阵营。
export const CAMP_MAP = {
    // 狼人阵营（版型简称）
    狼: '狼人', 狼王: '狼人', 白狼: '狼人', 狼妃: '狼人', 狼鸦: '狼人', 觉狼: '狼人', 美: '狼人', 赤月: '狼人', 噩: '狼人', 石: '狼人', 觉王: '狼人', 寂夜: '狼人', 恶夜: '狼人',
    // 好人阵营（版型简称）
    民: '好人', 预: '好人', 女: '好人', 猎: '好人', 愚: '好人', 守: '好人', 商: '好人', 幸: '好人', 梦: '好人', 骑: '好人', 猎魔: '好人', 巫: '好人', 纯: '好人', 羊驼: '好人', 白猫: '好人', 河豚: '好人', 子狐: '好人', 熊: '好人', 香: '好人', 觉预: '好人', 贵: '好人', 觉愚: '好人', 王子: '好人', 白昼: '好人', 术: '好人', 墓: '好人', 炼金: '好人', 鸦: '好人', 侍: '好人', 爵: '好人', 觉女: '好人', 觉隐: '好人', 镜: '好人', 觉美: '好人', 觉猎: '好人', 觉孤: '好人', 孤独: '好人',
    // 第三方（版型简称）
    丘: '第三方', 咒狐: '第三方',
    // 通用/全称身份：狼人阵营
    狼人: '狼人', 白狼王: '狼人', 狼美人: '狼人', 石像鬼: '狼人', 噩梦之影: '狼人', 觉醒狼王: '狼人', 觉醒狼人: '狼人', 寂夜行者: '狼人', 恶夜骑士: '狼人',
    // 通用/全称身份：好人阵营
    平民: '好人', 预言家: '好人', 女巫: '好人', 猎人: '好人', 守卫: '好人', 愚者: '好人', 骑士: '好人', 摄梦人: '好人', 商人: '好人', 幸运儿: '好人', 纯白之女: '好人', 狐狸: '好人', 熊: '好人', 寻香师: '好人', 贵族: '好人', 王子: '好人', 白昼学者: '好人', 魔术师: '好人', 守墓人: '好人', 炼金术士: '好人', 乌鸦: '好人', 侍从: '好人', 爵士: '好人', 觉醒女巫: '好人', 觉醒预言家: '好人', 觉醒猎人: '好人', 觉醒愚者: '好人', 觉醒美人: '好人', 觉醒隐者: '好人', 镜像: '好人', 猎魔人: '好人', 觉醒孤独少女: '好人', 孤独少女: '好人',
    // 通用/全称身份：第三方
    丘比特: '第三方', 咒狐: '第三方'
}

// 版型简称→完整名称映射（界面显示用），未收录的简称原样返回。
export const ROLE_ALIAS = {
    狼: '狼人', 民: '平民', 预: '预言家', 女: '女巫', 猎: '猎人', 愚: '愚者', 狼王: '狼王', 守: '守卫', 商: '商人', 幸: '幸运儿', 觉隐: '觉醒隐者', 镜: '镜像', 觉美: '觉醒美人', 觉猎: '觉醒猎人', 丘: '丘比特', 千面: '千面人', 梦: '摄梦人', 觉孤: '觉醒孤独少女', 美: '狼美人', 骑: '骑士', 赤月: '赤月', 猎魔: '猎魔人', 白狼: '白狼王', 巫: '女巫', 纯: '纯白之女', 羊驼: '羊驼', 白猫: '白猫', 河豚: '河豚', 子狐: '狐狸', 熊: '熊', 香: '寻香师', 觉预: '觉醒预言家', 贵: '贵族', 觉愚: '觉醒愚者', 狼妃: '狼妃', 王子: '王子', 孤独: '孤独少女', 噩: '噩梦之影', 寂夜: '寂夜行者', 白昼: '白昼学者', 觉王: '觉醒狼王', 恶夜: '恶夜骑士', 术: '魔术师', 石: '石像鬼', 墓: '守墓人', 狼鸦: '狼鸦', 炼金: '炼金术士', 鸦: '乌鸦', 咒狐: '咒狐', 侍: '侍从', 爵: '爵士', 觉狼: '觉醒狼人', 觉女: '觉醒女巫'
}

export const aliasRole = role => ROLE_ALIAS[role] || role

export function inferCamp(role) {
    if (!role) return ''
    return CAMP_MAP[role] || ''
}

// 进入记录台前必须齐备的开局信息：版型、座位、身份、阵营。
export function isSessionReady(game = {}) {
    return Boolean(game.modeId && game.mySeat && game.myRole && game.myCamp)
}

// 昼夜界面差异：夜晚默认隐藏 12 席发言区（提供"显示玩家备注"次级入口），白天默认显示
export const speechesVisibleByDefault = period => period !== 'night'

// 身份切换复核：统计包含非公开信息的轮次数（用于提醒用户复核）
export function privateNoteRoundCount(session = {}) {
    return (session.rounds || []).filter(round => round.privateNotes?.trim()).length
}

// 清空所有轮次的非公开信息：只清 round.privateNotes，不清发言/公共信息/整体备注；返回清空的轮次数
export function clearRoundPrivateNotes(session = {}) {
    let cleared = 0
    for (const round of session.rounds || []) {
        if (round.privateNotes?.trim()) { round.privateNotes = ''; cleared++ }
    }
    return cleared
}

// 应用初始化时的页面恒为首页；会话是否存在都不影响初始页面（页面与数据分离）。
export const resolveInitialView = () => 'home'

// 本地是否存在已保存会话（首页据此显示"继续上一局"）。
export function hasSavedSession(storage) {
    try { return Boolean(storage?.getItem(SESSION_KEY)) } catch { return false }
}

// ---- 身份私有信息：结构化存储（game.private），自动生成可读文本（game.privateInfo） ----

// 私有信息类型：狼人 / 预言家 / 女巫 / 守卫 / 平民 / 其他
export function privateTypeForRole(role) {
    const r = role || ''
    if (CAMP_MAP[r] === '狼人') return 'wolf'
    if (['预', '预言家', '觉预', '觉醒预言家'].includes(r)) return 'seer'
    if (['女', '女巫', '觉女', '觉醒女巫', '巫'].includes(r)) return 'witch'
    if (['守', '守卫'].includes(r)) return 'guard'
    if (['民', '平民'].includes(r)) return 'villager'
    return 'other'
}

export function defaultPrivate(type) {
    const base = {type: type || 'other'}
    switch (type) {
        // teammateState / state / saveUsed / poisonUsed 默认 null = 未确认；用户必须主动选择（含"尚未发生/暂不确定"）
        case 'wolf': return {...base, knownTeammates: [], teammateState: null}
        case 'seer': return {...base, checks: [], state: null}
        case 'witch': return {...base, nightKill: '', saveUsed: null, saveTarget: null, poisonUsed: null, poisonTarget: null}
        case 'guard': return {...base, target: null, round: '', state: null}
        case 'villager': return {...base}
        default: return {...base, text: ''}
    }
}

// 纯函数：结构化私有信息 + 跨身份通用补充 → 可读文本。
// 不读取会话、不负责迁移；"我是X号Y"头部由提示词【我的信息】区块提供。
export function buildPrivateInfoText(data = {}, privateNotes = '') {
    const p = data || {}
    const notes = typeof privateNotes === 'string' ? privateNotes.trim() : ''
    let main = ''
    switch (p.type) {
        case 'wolf': {
            const matesArr = (p.knownTeammates || []).map(n => `${n}号`)
            const mates = matesArr.length > 1 ? `${matesArr.slice(0, -1).join('、')}和${matesArr.at(-1)}` : matesArr.join('、')
            const stateText = {none: '没有已知狼队友', solo: '独立狼人或特殊身份', unknown: '暂时不确定'}[p.teammateState] || '暂时不确定'
            main = p.teammateState === 'known' && mates ? `已知狼队友是${mates}` : stateText
            break
        }
        case 'seer': {
            const checks = (p.checks || []).filter(c => c.round || c.target || c.result)
            main = checks.length ? checks.map(c => `${c.round || '本轮'}查验${c.target}号为${c.result || '不确定'}`).join('；') : '尚未查验或暂未记录'
            break
        }
        case 'witch': {
            const parts = []
            if (p.nightKill) parts.push(`得知${p.nightKill}号为刀口`)
            if (p.saveUsed === 'used' && p.saveTarget) parts.push(`使用解药救下${p.saveTarget}号`)
            else if (p.saveUsed === 'none') parts.push('未使用解药')
            else if (p.saveUsed === 'not-occurred') parts.push('解药尚未发生')
            else if (p.saveUsed === 'unknown') parts.push('解药暂不确定')
            if (p.poisonUsed === 'used' && p.poisonTarget) parts.push(`使用毒药毒杀${p.poisonTarget}号`)
            else if (p.poisonUsed === 'none') parts.push('未使用毒药')
            else if (p.poisonUsed === 'not-occurred') parts.push('毒药尚未发生')
            else if (p.poisonUsed === 'unknown') parts.push('毒药暂不确定')
            main = parts.length ? parts.join('，') : '暂无夜间信息'
            break
        }
        case 'guard': {
            main = p.target ? `${p.round || '本轮'}守护${p.target}号` : p.state === 'not-occurred' ? '尚未发生' : '本轮未守护'
            break
        }
        case 'villager':
            main = '无额外夜间私有信息'
            break
        default:
            main = p.text ? p.text : '无补充信息'
    }
    return notes ? `${main}。\n补充：${notes}` : `${main}。`
}

// 把结构化私有信息同步为可读文本（game.privateInfo 仅作兼容缓存，UI 无独立编辑入口）。
export function syncPrivateInfo(game = {}) {
    if (game.private) game.privateInfo = buildPrivateInfoText(game.private, game.privateNotes)
    return game
}

// 私有信息状态是否已确认：不要求必须有技能结果（"尚未发生/暂不确定/无额外信息"也算确认），
// 但用户必须主动表态，不能完全无反馈地跳过。
export function isPrivateInfoConfirmed(data = {}) {
    switch (data.type) {
        case 'wolf': return data.teammateState !== null && (data.teammateState !== 'known' || (data.knownTeammates || []).length > 0)
        case 'seer': return data.state === 'none' || (data.checks || []).some(c => c.target && c.result)
        case 'witch': return data.saveUsed !== null && data.poisonUsed !== null
        case 'guard': return data.state !== null && (data.state !== 'guarded' || data.target)
        case 'villager': return true
        default: return true
    }
}

export function createSession() {
  return {schemaVersion: 3, game: {modeId: null, mySeat: null, myRole: '', myCamp: '', privateInfo: '', privateNotes: ''}, players: seats(), rounds: [createRound({id: 'round-1'})], currentRoundId: 'round-1', overallNotes: '', uiPreferences: {theme: 'system'}}
}

const append = (existing, line) => [existing, line].filter(Boolean).join(existing && line ? '\n' : '')
const eventText = event => {
  const targets = (event.targetPlayers || []).map(pad).join('、')
  const actor = event.actorPlayer ? pad(event.actorPlayer) : ''
  const type = {attack: '狼人攻击', save: '救下', poison: '毒杀', guard: '守护', inspect: '查验', shoot: '开枪带走', duel: '决斗', death: '死亡', 'night-death': '夜间死亡', exile: '被放逐', 'self-destruct': '自爆', sheriff: '获得警徽', 'sheriff-transfer': '警徽移交', vote: '投票给', 'run-for-sheriff': '上警', 'run-water': '退水'}[event.type] || event.type || '记录'
  if (event.type === 'attack' && !actor) return `${type}${targets}。`
  if (event.type === 'self-destruct') return `${actor}${type}。`
  if (['death', 'night-death', 'exile'].includes(event.type)) return `${targets}${type}。`
  if (event.type === 'inspect') return `${actor}${type}${targets}${event.result ? `，结果为${event.result}` : ''}。`
  return `${actor}${type}${targets}${event.result ? `，${event.result}` : ''}${event.note ? `（${event.note}）` : ''}。`
}

export function migrateV2Session(old = {}) {
  const session = createSession()
  session.game = {modeId: old.selectedModeId ?? null, mySeat: old.user?.seat ?? null, myRole: old.user?.role || '', myCamp: old.user?.camp || inferCamp(old.user?.role), privateInfo: old.user?.privateNote || ''}
  session.overallNotes = old.remarks || ''
  const oldRounds = Array.isArray(old.rounds) && old.rounds.length ? [...old.rounds].sort((a, b) => (a.sequence || 0) - (b.sequence || 0)) : [createRound({id: 'round-1'})]
  session.rounds = oldRounds.map((oldRound, index) => {
    const recognized = standardRoundMeta(oldRound.label || '')
    return {id: oldRound.id || `round-${index + 1}`, dayNumber: recognized?.dayNumber ?? null, period: recognized?.period || 'custom', isCustom: !recognized, label: oldRound.label || `第${index + 1}轮`, publicEvents: '', privateNotes: '', speeches: Object.fromEntries(Object.entries(oldRound.speeches || {}).map(([seat, value]) => [seat, {text: typeof value === 'string' ? value : value.text || '', flags: {noSpeech: Boolean(value?.tags?.includes('no-speech')), lowInformation: Boolean(value?.tags?.includes('coasting')), noLastWords: Boolean(value?.tags?.includes('no-last-words'))}}]))}
  })
  session.currentRoundId = old.currentRoundId && session.rounds.some(item => item.id === old.currentRoundId) ? old.currentRoundId : session.rounds[0].id
  for (const [seat, player] of Object.entries(old.players || {})) {
    if (!session.players[seat]) continue
    session.players[seat].lifeStatus = player.status && player.status !== 'alive' ? 'eliminated' : 'alive'
    session.players[seat].electionStatus = player.election === 1 ? 'candidate' : player.election === 2 ? 'withdrawn' : 'none'
  }
  for (const event of old.events || []) {
    const targetRound = session.rounds.find(item => item.id === event.roundId) || session.rounds[0]
    const line = eventText(event)
    if (event.visibility === 'private') session.game.privateInfo = append(session.game.privateInfo, `【${targetRound.label}】${line}`)
    else targetRound.publicEvents = append(targetRound.publicEvents, line)
  }
  return session
}

export function migrateLegacySession(legacy = {}) {
  const session = createSession()
  session.overallNotes = typeof legacy.remarks === 'string' ? legacy.remarks : ''
  const records = legacy.chatRecords && typeof legacy.chatRecords === 'object' ? legacy.chatRecords : {}
  const hasRecords = Object.keys(records).length > 0
  if (hasRecords) session.rounds[0] = createRound({id: 'legacy-import', label: '旧版导入记录', isCustom: true, period: 'custom'})
  session.currentRoundId = session.rounds[0].id
  for (let seat = 1; seat <= 12; seat++) {
    const old = records[`player${String(seat).padStart(2, '0')}`] || {}
    if (old.message) session.rounds[0].speeches[seat] = {text: String(old.message), flags: flags()}
    session.players[seat].lifeStatus = old.status && old.status !== 1 ? 'eliminated' : 'alive'
    session.players[seat].electionStatus = old.election === 1 ? 'candidate' : old.election === 2 ? 'withdrawn' : 'none'
  }
  return session
}

// 迁移/兼容：为旧会话补齐新增字段默认值。
// 不自动把 privateInfo 迁入 privateNotes（旧文本可能是身份专属，交给用户在界面确认）；
// 旧 privateInfo 保留作提示词回退读取。
export function normalizeSession(session = {}) {
  session.game ||= {}
  if (typeof session.game.privateNotes !== 'string') session.game.privateNotes = ''
  // 完全没有轮次时安全补充第一夜；已有轮次不重复创建
  if (!Array.isArray(session.rounds) || session.rounds.length === 0) {
    const first = createRound({id: 'round-1'})
    session.rounds = [first]
    if (!session.currentRoundId) session.currentRoundId = first.id
  }
  for (const item of session.rounds) {
    if (typeof item.privateNotes !== 'string') item.privateNotes = ''
    // 轮次结构迁移：标准昼夜标签→dayNumber/period；未知标签→自定义轮次
    if (!('period' in item) || !('isCustom' in item)) {
      const recognized = standardRoundMeta(item.label)
      if (recognized) { item.dayNumber = recognized.dayNumber; item.period = recognized.period; item.isCustom = false }
      else { item.dayNumber = null; item.period = 'custom'; item.isCustom = true }
    }
  }
  return session
}

export function loadSession(storage) {
  try {
    const saved = storage?.getItem(SESSION_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed?.schemaVersion === 3 && Array.isArray(parsed.rounds)) return normalizeSession(parsed)
      if (parsed?.schemaVersion === 2) return migrateV2Session(parsed)
    }
    return migrateLegacySession({remarks: storage?.getItem('remarks') || '', chatRecords: JSON.parse(storage?.getItem('chatRecords') || '{}')})
  } catch { return createSession() }
}

export function saveSession(storage, session) { try { storage?.setItem(SESSION_KEY, JSON.stringify(session)); return true } catch { return false } }

export function insertSpeechTemplate(text, type, target) {
  const targetText = target ? pad(target) : '某号'
  const lines = {seer: '自称预言家。', witch: '自称女巫。', hunter: '自称猎人。', withdraw: '退水。', 'gold-water': `给${targetText}发金水。`, 'black-water': `给${targetText}发查杀。`, 'silver-water': `给${targetText}发银水。`}
  return [text?.trim(), lines[type]].filter(Boolean).join(text?.trim() ? '\n' : '')
}

export function makeVoteText(groups = [], abstainers = [], exiled) {
  const voterList = values => `${values.join('、')}号`
  const pieces = groups.filter(group => group.target && group.voters?.length).map(group => `${pad(group.target)}被${voterList(group.voters)}投票`)
  if (abstainers.length) pieces.push(`${voterList(abstainers)}弃票`)
  if (exiled) pieces.push(`最终${pad(exiled)}被放逐`)
  return pieces.length ? `${pieces.join('；')}。` : ''
}

const flagText = item => [item?.flags?.noSpeech ? '本轮未发言。' : '', item?.flags?.lowInformation ? '用户标记为滑水。' : '', item?.flags?.noLastWords ? '出局后无遗言。' : ''].filter(Boolean).join(' ')
const trimEarlier = text => text.length > 120 ? `${text.slice(0, 120)}…` : text

export function buildStrategyPrompt(session, options = {}) {
  const {scope = 'all', compactEarlierRounds = false, maxCharacters = null, gameMode = null} = options
  const rounds = (session.rounds || []).filter(item => scope !== 'current' || item.id === session.currentRoundId)
  const currentId = session.currentRoundId || rounds.at(-1)?.id
  const current = rounds.find(item => item.id === currentId)
  const speechBlock = (item, compact = false) => {
    const lines = Object.entries(item?.speeches || {}).filter(([, speechItem]) => speechItem.text?.trim() || flagText(speechItem)).map(([seat, speechItem]) => {
      const text = compact ? trimEarlier(speechItem.text || '') : speechItem.text || ''
      return `${pad(Number(seat))}：${text}${text && flagText(speechItem) ? ' ' : ''}${flagText(speechItem)}`
    })
    return lines.length ? `${lines.join('\n')}\n` : ''
  }
  // 整局私有信息：优先结构化（含跨身份通用补充），旧数据回退 privateInfo
  const privateText = session.game?.private
      ? buildPrivateInfoText(session.game.private, session.game.privateNotes)
      : (session.game?.privateInfo?.trim() || '无')
  const header = `你是狼人杀策略助手。以最大化当前用户阵营胜率为目标，给出合法、可执行的下一步策略；不要使用场外信息或假设非法私聊。\n\n【我的信息】\n版型：${gameMode?.name || '未选择'}\n座位：${session.game?.mySeat ? pad(session.game.mySeat) : '未设置'}\n真实身份：${aliasRole(session.game?.myRole) || '未设置'}\n阵营：${session.game?.myCamp || '未设置'}\n【用户私有信息】\n${privateText}\n\n`

  // 单个轮次的子段落：玩家发言 → 公共信息 → 非公开信息（没有内容的子段落直接省略）
  const recordBlock = (round, compact = false) => {
    const parts = []
    const speeches = speechBlock(round, compact)
    if (speeches.trim()) parts.push(`【玩家发言】\n${speeches}`)
    if (round.publicEvents?.trim()) parts.push(`【公共信息】\n${round.publicEvents.trim()}\n`)
    if (round.privateNotes?.trim()) parts.push(`【用户掌握的非公开信息】\n以下信息只有用户或用户阵营掌握，其他玩家未必知道。AI 在制定策略时可以使用，但不能假设其他玩家也知道，也不得建议用户无理由公开自己的隐藏身份或秘密信息。\n${round.privateNotes.trim()}\n`)
    return parts.join('')
  }
  // 轮次时间线：第一夜 → 第一天 → 第二夜 → …，当前轮不单独前置、不重复
  const roundRecords = rounds.map(item => {
    const body = recordBlock(item, Boolean(maxCharacters) && item.id !== currentId)
    return body.trim() ? `【${item.label}】\n${body}` : ''
  }).filter(Boolean).join('\n')
  const gameRecords = roundRecords ? `【对局记录】\n${roundRecords}\n` : ''

  // 主观备注（所有轮次之后）
  const notesText = session.overallNotes?.trim() ? `【用户的主观备注】\n以下是用户自己的判断、怀疑或计划，可能存在误判，不得直接当作事实。\n${session.overallNotes.trim()}\n` : ''

  const goal = session.game?.myCamp === '狼人' ? '提高狼队胜率；重点分析狼队暴露风险、票型解释、下一轮发言与夜间目标。' : session.game?.myCamp === '第三方' ? '围绕该身份的胜利条件给出生存、发言和投票策略；规则不明时明确不确定性。' : '重点找出狼人，给出可信玩家、关键问题、投票建议和适合当前身份的短发言稿。'
  const task = `【任务】\n${goal}\n不要把玩家自称当作事实；不要盲从用户评价；不要编造未记录的发言或事件；不得假设其他玩家知道用户掌握的非公开信息（如狼队刀口、查验结果、用药等），也不得建议用户无理由公开自己的隐藏身份或秘密信息。请依次给出：局势摘要、关键公共事实、身份倾向及理由、两到三种可能世界、主要风险、下一步行动、投票或技能建议、发言重点、简短发言稿、备用方案、缺失信息。`

  const required = `${header}${gameRecords}${notesText}`
  // compactEarlierRounds：非当前轮发言截短；maxCharacters：超限时保留结构、压缩早期轮次内容
  let body = required
  if (compactEarlierRounds && current) {
    const compacted = rounds.map(item => {
      const bodyText = item.id === currentId ? recordBlock(item, false) : recordBlock(item, true)
      return bodyText.trim() ? `【${item.label}】\n${bodyText}` : ''
    }).filter(Boolean).join('\n')
    body = `${header}${compacted ? `【对局记录】\n${compacted}\n` : ''}${notesText}`
  } else if (maxCharacters && body.length + task.length > maxCharacters && current) {
    // 压缩早期轮次（当前轮保持完整），并在记录末尾标注
    const compacted = rounds.map(item => {
      const bodyText = item.id === currentId ? recordBlock(item, false) : recordBlock(item, true)
      return bodyText.trim() ? `【${item.label}】\n${bodyText}` : ''
    }).filter(Boolean).join('\n')
    body = `${header}${compacted ? `【对局记录】\n${compacted}\n【较早发言已压缩】\n` : ''}${notesText}`
  }

  const prompt = `${body}${task}`
  return prompt
}
