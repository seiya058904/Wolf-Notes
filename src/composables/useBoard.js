import {computed, onMounted, ref, watch} from 'vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import {useGameModeStore} from '@/stores/gameModeStore'
import {storeToRefs} from 'pinia'
import {buildStrategyPrompt, clearRoundPrivateNotes, confirmRoundPrivateNotes, createRound, createSession, defaultPrivate, inferCamp, insertSpeechTemplate, isSessionReady, loadSession, makeVoteText, markRoundPrivateNotesForReview, nextRoundMeta, privateNoteRoundCount, privateTypeForRole, resolveNextRound, saveSession, syncPrivateInfo} from '@/lib/gameSession'

const pad = seat => String(seat).padStart(2, '0')
const speech = () => ({text: '', flags: {noSpeech: false, lowInformation: false, noLastWords: false}})
const templates = {death: '昨夜死亡：', exile: '被放逐：', selfDestruct: '自爆：', sheriff: '警徽：', withdrawn: '退水：', vote: '票型：'}

export function useBoard() {
  const store = useGameModeStore()
  const {selectedMode} = storeToRefs(store)
  const session = ref(createSession())
  const hydrated = ref(false)
  // 记录台访问门禁：加载后开局信息不完整时置为 true，通知上层转开局设置
  const gateBlocked = ref(false)
  const showSettings = ref(false), showPrompt = ref(false), showVote = ref(false), showPrivate = ref(false), showGameSettings = ref(false), gameSettingsRef = ref(null)
  const promptOptions = ref({scope: 'all', compactEarlierRounds: false, maxCharacters: null})
  const currentRound = computed(() => session.value.rounds.find(item => item.id === session.value.currentRoundId) || session.value.rounds[0])
  const prompt = computed(() => buildStrategyPrompt(session.value, {...promptOptions.value, gameMode: selectedMode.value}))
  const modeDesc = computed(() => selectedMode.value?.roles?.map(role => `${role.count > 1 ? role.count : ''}${role.text}`).join('·') || '')
  const persist = () => { if (!saveSession(window.localStorage, session.value)) ElMessage.warning('本地保存失败，内容仍保留在当前页面') }
  const applyTheme = theme => document.documentElement.dataset.theme = theme === 'system' ? '' : theme

  onMounted(() => {
    session.value = loadSession(window.localStorage)
    // 不静默补齐任何开局信息；缺失时置 gateBlocked，由上层引导回开局设置
    gateBlocked.value = !isSessionReady(session.value.game)
    hydrated.value = true
    applyTheme(session.value.uiPreferences?.theme || 'system')
  })
  watch(session, () => { if (hydrated.value) persist() }, {deep: true})
  watch(selectedMode, mode => { if (mode) session.value.game.modeId = mode.id })
  watch(() => session.value.uiPreferences?.theme, value => applyTheme(value || 'system'))

  const getSpeech = seat => currentRound.value.speeches[seat] || (currentRound.value.speeches[seat] = speech())
  const updateSpeech = (seat, value) => { getSpeech(seat).text = value }
  const toggleFlag = (seat, key) => { const item = getSpeech(seat); item.flags[key] = !item.flags[key] }
  const insertTemplate = (seat, type, target) => { getSpeech(seat).text = insertSpeechTemplate(getSpeech(seat).text, type, target) }
  const setPlayerStatus = (seat, key, value) => { session.value.players[seat][key] = value }
  const insertPublic = type => { currentRound.value.publicEvents = [currentRound.value.publicEvents.trim(), templates[type]].filter(Boolean).join(currentRound.value.publicEvents.trim() ? '\n' : '') }
  // 轮次自动推进：夜→日→夜→日；列表中间只切换，末尾才创建新阶段
  const currentIndex = computed(() => session.value.rounds.findIndex(item => item.id === currentRound.value.id))
  const isLastRound = computed(() => currentIndex.value === session.value.rounds.length - 1)
  const nextLabel = computed(() => {
    if (!isLastRound.value) return session.value.rounds[currentIndex.value + 1]?.label || ''
    const lastStandard = [...session.value.rounds].reverse().find(item => !item.isCustom)
    return nextRoundMeta(lastStandard || {dayNumber: 1, period: 'night'}).label
  })
  const nextRound = () => {
    const decision = resolveNextRound(session.value.rounds, session.value.currentRoundId)
    if (decision.type === 'switch') { if (decision.target) session.value.currentRoundId = decision.target }
    else { const item = createRound(decision.meta); session.value.rounds.push(item); session.value.currentRoundId = item.id }
  }
  const prevRound = () => { if (currentIndex.value > 0) session.value.currentRoundId = session.value.rounds[currentIndex.value - 1].id }
  const addCustomRound = label => { const name = label?.trim() || `自定义轮次${session.value.rounds.length + 1}`; const item = createRound({label: name, isCustom: true}); session.value.rounds.push(item); session.value.currentRoundId = item.id }
  const renameCurrentRound = label => { const name = label?.trim(); if (name && currentRound.value) currentRound.value.label = name }
  const deleteRound = async () => {
    const item = currentRound.value
    if (!item || session.value.rounds.length <= 1) return ElMessage.warning('至少保留一个轮次')
    const hasContent = item.publicEvents?.trim() || item.privateNotes?.trim() || Object.values(item.speeches || {}).some(value => value.text?.trim() || Object.values(value.flags || {}).some(Boolean))
    const remove = () => { const index = session.value.rounds.findIndex(roundItem => roundItem.id === item.id); session.value.rounds.splice(index, 1); session.value.currentRoundId = session.value.rounds[Math.max(0, index - 1)]?.id || session.value.rounds[0].id }
    if (hasContent) { try { await ElMessageBox.confirm(`「${item.label}」已有记录，确定删除？`, '删除轮次', {type: 'warning'}); remove() } catch { /* 取消 */ } } else remove()
  }
  const makeVote = (groups, abstainers, exiled) => { const text = makeVoteText(groups, abstainers, exiled); if (text) currentRound.value.publicEvents = [currentRound.value.publicEvents.trim(), text].filter(Boolean).join('\n'); showVote.value = false }
  // 身份切换复核：三选项（保留并自行检查 / 清空轮次非公开信息 / 取消修改）
  const roleReviewVisible = ref(false)
  const roleReviewState = ref(null) // {prevRole, prevCamp, prevPrivate, nextRole, privateRoundCount}
  const updateRole = async role => {
    // 先记下旧状态，供"取消修改"回滚；再应用新身份（含阵营推断）
    const prevRole = session.value.game.myRole
    const prevCamp = session.value.game.myCamp
    const prevPrivate = session.value.game.private
    const count = privateNoteRoundCount(session.value)
    session.value.game.myRole = role
    const camp = inferCamp(role)
    if (camp) session.value.game.myCamp = camp
    const nextType = privateTypeForRole(role)
    const privateChanged = !session.value.game.private || session.value.game.private.type !== nextType
    if (count > 0) {
      // 有轮次非公开信息 → 弹出三选项复核，不直接清空也不直接提交
      roleReviewState.value = {prevRole, prevCamp, prevPrivate, nextRole: role, nextType, privateChanged, privateRoundCount: count}
      roleReviewVisible.value = true
      return
    }
    applyPrivateReset(nextType, privateChanged)
  }
  // 身份已应用、结构化私有数据重置 + 提示词同步（不含轮次非公开信息的清理决策）
  const applyPrivateReset = (nextType, privateChanged) => {
    if (privateChanged) {
      const hadNotes = session.value.game.privateNotes?.trim()
      session.value.game.private = defaultPrivate(nextType)
      if (hadNotes) ElMessage.info('已保留"跨身份通用补充"说明，将用于新身份的提示词')
    }
    syncPrivateInfo(session.value.game)
  }
  const roleReviewKeep = () => {
    // 保留旧身份的非公开信息，但标记为待复核：提示词中单独分段，不当作当前身份确定掌握的信息
    markRoundPrivateNotesForReview(session.value)
    roleReviewVisible.value = false; roleReviewState.value = null
    ElMessage.info('已保留轮次非公开信息并标记为待复核，请在记录台逐轮确认或编辑')
  }
  const roleReviewClear = () => {
    clearRoundPrivateNotes(session.value)
    roleReviewVisible.value = false; roleReviewState.value = null
    ElMessage.info('已清空所有轮次的非公开信息')
  }
  // 用户确认当前轮非公开信息仍然有效：清除待复核标记，提示词中恢复为普通非公开信息段
  const confirmCurrentRoundPrivateNotes = () => {
    if (currentRound.value?.privateNotesNeedsReview) {
      confirmRoundPrivateNotes(currentRound.value)
      ElMessage.success('已确认该轮非公开信息仍然有效')
    }
  }
  // 用户编辑当前轮非公开信息时：视为已复核，清除待复核标记
  const onPrivateNotesInput = value => {
    if (currentRound.value) {
      currentRound.value.privateNotes = value
      if (currentRound.value.privateNotesNeedsReview) currentRound.value.privateNotesNeedsReview = false
    }
  }
  const roleReviewCancel = () => {
    const state = roleReviewState.value
    if (state) {
      session.value.game.myRole = state.prevRole
      session.value.game.myCamp = state.prevCamp
      session.value.game.private = state.prevPrivate
      syncPrivateInfo(session.value.game)
      ElMessage.info('已取消身份修改')
    }
    roleReviewVisible.value = false; roleReviewState.value = null
  }
  const copyPrompt = async () => { try { await navigator.clipboard.writeText(prompt.value); ElMessage.success('提示词已复制') } catch { ElMessage.error('复制失败，请手动复制') } }
  const resetGame = () => ElMessageBox.confirm('清空本局所有记录？此操作不可恢复。', '二次确认', {type: 'error'}).then(() => { session.value = createSession(); session.value.game.modeId = selectedMode.value?.id || null }).catch(() => {})
  return {session, selectedMode, modeDesc, currentRound, showSettings, showPrompt, showVote, showPrivate, showGameSettings, gameSettingsRef, gateBlocked, promptOptions, prompt, getSpeech, updateSpeech, toggleFlag, insertTemplate, setPlayerStatus, insertPublic, nextRound, prevRound, nextLabel, isLastRound, addCustomRound, renameCurrentRound, deleteRound, makeVote, updateRole, roleReviewVisible, roleReviewState, roleReviewKeep, roleReviewClear, roleReviewCancel, confirmCurrentRoundPrivateNotes, onPrivateNotesInput, copyPrompt, resetGame, openSettings: () => { showGameSettings.value = true }, handleSettingsClose: done => done()}
}
