<template>
  <main class="board">
    <header class="topbar">
      <button class="home" type="button" @click="$emit('go-home')">返回</button>
      <button class="mode" type="button" @click="openSettings">{{ selectedMode?.name || '选择版型' }}</button>
      <el-tooltip :content="`当前主题：${themeText}`" placement="bottom"><button class="theme" type="button" @click="cycleTheme">主题</button></el-tooltip>
      <div class="top-actions">
        <button type="button" @click="showSettings = true">我的信息</button>
        <button class="primary" type="button" @click="showPrompt = true"><span class="full-label">生成 AI 策略提示词</span><span class="short-label">AI策略</span></button>
      </div>
    </header>
    <p v-if="modeDesc" class="mode-desc">{{ modeDesc }}</p>

    <section class="round-bar">
      <button type="button" class="arrow" title="上一阶段" @click="prevRound">‹</button>
      <div class="round-tabs">
        <button
          v-for="item in session.rounds"
          :key="item.id"
          type="button"
          :class="{active: item.id === session.currentRoundId}"
          :title="item.isCustom ? '自定义轮次' : item.label"
          @click="session.currentRoundId = item.id"
        >
          {{ item.label }}
        </button>
      </div>
      <button v-if="isLastRound" type="button" class="next" @click="nextRound">进入{{ nextLabel }}</button>
      <button v-else type="button" class="arrow" :title="`切换到${nextLabel}`" @click="nextRound">›</button>
      <el-dropdown trigger="click" @command="handleRoundCommand">
        <button type="button" class="more">···</button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="rename">重命名当前轮次</el-dropdown-item>
            <el-dropdown-item command="add-custom">添加自定义轮次</el-dropdown-item>
            <el-dropdown-item command="delete" divided>删除当前轮次</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </section>

    <section class="workspace" :class="{ 'workspace-night-collapsed': currentRound.period === 'night' && !openSections.speeches }">
      <!-- 夜间模式默认隐藏发言区 -->
      <div v-if="currentRound.period === 'day'" class="speeches-panel"><div class="section-title"><div><span>本轮发言</span><small>原话优先，模板会直接插入发言框</small></div><el-select v-model="templateTarget" size="small" placeholder="模板目标"><el-option v-for="seat in 12" :key="seat" :label="`${seat}号`" :value="seat"/></el-select></div><div class="players-grid"><PlayerCard v-for="seat in 12" :key="seat" :seat="seat" :player="session.players[seat]" :speech="getSpeech(seat)" @update:text="value => updateSpeech(seat, value)" @toggle:flag="flag => toggleFlag(seat, flag)" @insert:template="type => insertTemplate(seat, type, templateTarget)" @update:life="value => setPlayerStatus(seat, 'lifeStatus', value)" @update:election="value => setPlayerStatus(seat, 'electionStatus', value)"/></div></div>
      <div v-else class="speeches-panel collapsed">
        <button type="button" class="show-speeches" :aria-expanded="openSections.speeches ? 'true' : 'false'" @click="toggleSection('speeches')">{{ openSections.speeches ? '收起玩家备注' : '显示玩家备注' }}</button>
        <div v-if="openSections.speeches" class="players-grid">
          <PlayerCard v-for="seat in 12" :key="seat" :seat="seat" :player="session.players[seat]" :speech="getSpeech(seat)" @update:text="value => updateSpeech(seat, value)" @toggle:flag="flag => toggleFlag(seat, flag)" @insert:template="type => insertTemplate(seat, type, templateTarget)" @update:life="value => setPlayerStatus(seat, 'lifeStatus', value)" @update:election="value => setPlayerStatus(seat, 'electionStatus', value)"/>
        </div>
      </div>
      <aside class="notes-panel">
        <!-- 夜间模式：非公开信息在前 -->
        <section v-if="currentRound.period === 'night'" class="notes-section">
          <button type="button" class="collapse-title" @click="toggleSection('private')">
            <span>本轮非公开信息</span><small>仅供你和 AI 分析使用，其他玩家未必知道</small><em class="badge">{{ privateBadge }}</em>
          </button>
          <div v-show="openSections.private" class="collapse-body">
            <div v-if="currentRound.privateNotesNeedsReview" class="review-banner">
              <span>该轮非公开信息来自身份切换前，尚未确认是否仍然有效。编辑即视为已复核，或点击右侧按钮确认。</span>
              <button type="button" class="confirm-review" @click="confirmCurrentRoundPrivateNotes">确认内容仍然有效</button>
            </div>
            <el-input :model-value="currentRound.privateNotes" @update:model-value="onPrivateNotesInput" type="textarea" :rows="5" placeholder="例如：第一夜狼队最终刀11号。"/>
          </div>
        </section>
        <section v-if="currentRound.period === 'day'" class="notes-section">
          <button type="button" class="collapse-title" @click="toggleSection('public')">
            <span>本轮公共信息</span><small>只记死亡、放逐、警徽和票型等确定事实</small><em class="badge">{{ publicBadge }}</em>
          </button>
          <div v-show="openSections.public" class="collapse-body">
            <div class="event-templates"><button v-for="item in eventTemplates" :key="item.key" type="button" @click="insertPublic(item.key)">{{ item.label }}</button><button type="button" @click="showVote = true">票型助手</button></div>
            <el-input v-model="currentRound.publicEvents" type="textarea" :rows="6" placeholder="例如：1号和11号昨夜死亡。4号被放逐。"/>
          </div>
        </section>
        <section v-if="currentRound.period === 'night'" class="notes-section">
          <button type="button" class="collapse-title" @click="toggleSection('public')">
            <span>本轮公共信息</span><small>只记死亡、放逐、警徽和票型等确定事实</small><em class="badge">{{ publicBadge }}</em>
          </button>
          <div v-show="openSections.public" class="collapse-body">
            <div class="event-templates"><button v-for="item in eventTemplates" :key="item.key" type="button" @click="insertPublic(item.key)">{{ item.label }}</button><button type="button" @click="showVote = true">票型助手</button></div>
            <el-input v-model="currentRound.publicEvents" type="textarea" :rows="6" placeholder="例如：1号和11号昨夜死亡。4号被放逐。"/>
          </div>
        </section>
        <section v-if="currentRound.period === 'day'" class="notes-section">
          <button type="button" class="collapse-title" @click="toggleSection('private')">
            <span>本轮非公开信息</span><small>仅供你和 AI 分析使用，其他玩家未必知道</small><em class="badge">{{ privateBadge }}</em>
          </button>
          <div v-show="openSections.private" class="collapse-body">
            <div v-if="currentRound.privateNotesNeedsReview" class="review-banner">
              <span>该轮非公开信息来自身份切换前，尚未确认是否仍然有效。编辑即视为已复核，或点击右侧按钮确认。</span>
              <button type="button" class="confirm-review" @click="confirmCurrentRoundPrivateNotes">确认内容仍然有效</button>
            </div>
            <el-input :model-value="currentRound.privateNotes" @update:model-value="onPrivateNotesInput" type="textarea" :rows="5" placeholder="例如：第一夜狼队最终刀11号。"/>
          </div>
        </section>
        <section class="notes-section">
          <button type="button" class="collapse-title" @click="toggleSection('transcript')">
            <span>本轮原始转写</span><small>可粘贴整段语音识别，交给 AI 整理发言</small><em class="badge">{{ transcriptBadge }}</em>
          </button>
          <div v-show="openSections.transcript" class="collapse-body">
            <el-input v-model="currentRound.rawTranscript" type="textarea" :rows="8" placeholder="粘贴本轮连续语音转写；可包含系统播报和玩家原话，AI 会结合上下文分析。"/>
          </div>
        </section>
        <section class="notes-section">
          <button type="button" class="collapse-title" @click="toggleSection('notes')">
            <span>整体备注</span><small>不属于某一轮的补充判断</small><em class="badge">{{ notesBadge }}</em>
          </button>
          <div v-show="openSections.notes" class="collapse-body">
            <el-input v-model="session.overallNotes" type="textarea" :rows="4" placeholder="写下你的整体判断…"/>
          </div>
        </section>
        <button class="danger" type="button" @click="resetGame">清空整局</button>
      </aside>
    </section>

    <el-dialog v-model="showSettings" title="我的信息" width="540px"><div class="settings-form"><div class="setting-row"><label>我的座位</label><el-select v-model="session.game.mySeat" placeholder="选择座位"><el-option v-for="n in 12" :key="n" :label="`${n}号`" :value="n"/></el-select></div><div class="setting-row"><label>真实身份</label><el-select :model-value="session.game.myRole" filterable allow-create placeholder="真实身份" @update:model-value="updateRole"><el-option v-for="(role, index) in availableRoles" :key="index" :label="role" :value="role"/></el-select></div><div class="setting-row"><label>阵营</label><el-select v-model="session.game.myCamp" placeholder="阵营（身份未知时选择）"><el-option label="好人" value="好人"/><el-option label="狼人" value="狼人"/><el-option label="第三方" value="第三方"/></el-select></div><div class="setting-row"><label>私有信息</label><PrivateInfoForm v-if="session.game.private" v-model:value="session.game.private" :seat="session.game.mySeat"/></div><div class="setting-row"><label>跨身份通用补充</label><el-input v-model="session.game.privateNotes" type="textarea" :rows="3" placeholder="切换身份后仍会保留并交给 AI，请勿填写身份专属信息"/></div></div></el-dialog>
    <el-dialog v-model="roleReviewVisible" title="身份切换复核" width="520px"><template v-if="roleReviewState"><p class="role-review-text">身份已从 <strong>{{ aliasRole(roleReviewState.prevRole) || '未设置' }}</strong> 修改为 <strong>{{ aliasRole(roleReviewState.nextRole) }}</strong>。</p><p class="role-review-text">当前有 <strong>{{ roleReviewState.privateRoundCount }}</strong> 个轮次包含非公开信息，其中可能存在仅原身份能够知道的内容（例如狼队刀口、查验结果、用药等）。</p><p class="role-review-hint">选择"保留并自行检查"后，这些信息将被标记为<strong>待复核</strong>，提示词中单独分段，不会被当作当前身份确定掌握的信息。请在记录台逐轮确认或编辑后再交给 AI。</p></template><template #footer><el-button @click="roleReviewCancel">取消修改</el-button><el-button type="warning" @click="roleReviewClear">清空轮次非公开信息</el-button><el-button type="primary" @click="roleReviewKeep">保留并自行检查</el-button></template></el-dialog>
    <el-dialog v-model="showVote" title="票型助手（可选）" width="560px"><p class="tip">生成后仍是一段可编辑的公共事件文本。</p><div v-for="(group, index) in voteGroups" :key="index" class="vote-row"><el-select v-model="group.target" placeholder="被投玩家"><el-option v-for="seat in 12" :key="seat" :label="`${seat}号`" :value="seat"/></el-select><el-select v-model="group.voters" multiple placeholder="投票玩家"><el-option v-for="seat in 12" :key="seat" :label="`${seat}号`" :value="seat"/></el-select><button type="button" @click="voteGroups.splice(index, 1)">移除</button></div><button type="button" @click="voteGroups.push({target: null, voters: []})">新增目标</button><div class="vote-row"><el-select v-model="abstainers" multiple placeholder="弃票玩家"><el-option v-for="seat in 12" :key="seat" :label="`${seat}号`" :value="seat"/></el-select><el-select v-model="exiled" placeholder="最终放逐"><el-option v-for="seat in 12" :key="seat" :label="`${seat}号`" :value="seat"/></el-select></div><template #footer><el-button @click="showVote = false">取消</el-button><el-button type="primary" @click="submitVote">生成票型文本</el-button></template></el-dialog>
    <el-dialog v-model="showPrompt" title="AI 策略提示词" width="760px"><div class="prompt-options"><el-checkbox v-model="promptOptions.compactEarlierRounds">紧凑早期轮次</el-checkbox><el-input-number v-model="promptOptions.maxCharacters" :min="1" placeholder="字符上限（可选）" controls-position="right"/></div><el-input :model-value="prompt" type="textarea" :rows="22" readonly/><template #footer><el-button @click="showPrompt = false">关闭</el-button><el-button type="primary" @click="copyPrompt">复制提示词</el-button></template></el-dialog>
    <el-dialog v-model="showGameSettings" title="版型设置" width="520px"><GameSettings ref="gameSettingsRef"/></el-dialog>
  </main>
</template>

<script setup>
import {computed, onMounted, ref, watch} from 'vue'
import {ElMessageBox} from 'element-plus'
import {useBoard} from '@/composables/useBoard'
import PlayerCard from './PlayerCard.vue'
import GameSettings from './gameSettings.vue'
import PrivateInfoForm from './privateInfoForm.vue'
import {aliasRole, defaultPrivate, privateTypeForRole} from '@/lib/gameSession'
const emit = defineEmits(['go-home', 'missing-setup'])
const {session, selectedMode, modeDesc, currentRound, showSettings, showPrompt, showVote, showGameSettings, gameSettingsRef, gateBlocked, promptOptions, prompt, getSpeech, updateSpeech, toggleFlag, insertTemplate, setPlayerStatus, insertPublic, nextRound, prevRound, nextLabel, isLastRound, addCustomRound, renameCurrentRound, deleteRound, makeVote, updateRole, roleReviewVisible, roleReviewState, roleReviewKeep, roleReviewClear, roleReviewCancel, confirmCurrentRoundPrivateNotes, onPrivateNotesInput, copyPrompt, resetGame, openSettings} = useBoard()
const templateTarget = ref(null), voteGroups = ref([{target: null, voters: []}]), abstainers = ref([]), exiled = ref(null)
// 移动端三输入区默认收起（桌面默认展开）
const openSections = ref({public: true, private: true, notes: true, transcript: false, speeches: false})
onMounted(() => {
  if (window.matchMedia('(max-width: 720px)').matches) openSections.value = {public: false, private: false, notes: false, transcript: false, speeches: false}
})
const toggleSection = key => { openSections.value[key] = !openSections.value[key] }
const countLines = text => (text || '').split('\n').filter(Boolean).length
const publicBadge = computed(() => { const n = countLines(currentRound.value?.publicEvents); return n ? `已记录 ${n} 项` : '未记录' })
const privateBadge = computed(() => { const n = countLines(currentRound.value?.privateNotes); return n ? `已记录 ${n} 项` : '未记录' })
const notesBadge = computed(() => countLines(session.value.overallNotes) ? '已记录' : '未记录')
const transcriptBadge = computed(() => currentRound.value?.rawTranscript?.trim() ? `${currentRound.value.rawTranscript.trim().length}字` : '未记录')
const eventTemplates = [{key: 'death', label: '死亡'}, {key: 'exile', label: '放逐'}, {key: 'selfDestruct', label: '自爆'}, {key: 'sheriff', label: '警长'}, {key: 'withdrawn', label: '退水'}, {key: 'vote', label: '票型'}]
// 身份选项：版型角色显示全称（存储全称，与阵营映射/私有信息类型兼容）
const availableRoles = computed(() => selectedMode.value?.roles?.map(role => aliasRole(role.text)) || [])
const themeText = computed(() => ({system: '跟随系统', light: '白色', dark: '黑色'}[session.value.uiPreferences?.theme || 'system']))
const cycleTheme = () => { const current = session.value.uiPreferences.theme || 'system'; session.value.uiPreferences.theme = {system: 'light', light: 'dark', dark: 'system'}[current] }
const handleRoundCommand = async command => {
    if (command === 'rename') {
        try {
            const {value} = await ElMessageBox.prompt('输入新的轮次名称', '重命名当前轮次', {inputValue: currentRound.value?.label || '', inputPlaceholder: '轮次名称', confirmButtonText: '确定', cancelButtonText: '取消'})
            if (value !== null && value.trim()) renameCurrentRound(value)
        } catch { /* 取消 */ }
    } else if (command === 'add-custom') {
        try {
            const {value} = await ElMessageBox.prompt('用于特殊玩法或复盘细分，如"第一天警上"', '添加自定义轮次', {inputPlaceholder: '自定义轮次名称', confirmButtonText: '添加', cancelButtonText: '取消'})
            if (value !== null && value.trim()) addCustomRound(value)
        } catch { /* 取消 */ }
    } else if (command === 'delete') {
        deleteRound()
    }
}
const submitVote = () => { makeVote(voteGroups.value, abstainers.value, exiled.value); voteGroups.value = [{target: null, voters: []}]; abstainers.value = []; exiled.value = null }
// 记录台访问门禁：加载后发现开局信息不完整，通知上层返回开局设置
watch(gateBlocked, blocked => { if (blocked) emit('missing-setup') })
// 打开"我的信息"时确保结构化私有信息存在；旧数据无 private 时按身份初始化，历史文本迁入跨身份通用补充
watch(showSettings, open => {
  if (open && !session.value.game.private) {
    const oldText = session.value.game.privateInfo?.trim()
    session.value.game.private = defaultPrivate(privateTypeForRole(session.value.game.myRole))
    if (oldText && !session.value.game.privateNotes) session.value.game.privateNotes = oldText
  }
})
</script>

<style scoped lang="scss">
.board{max-width:1240px;margin:0 auto;padding:18px;color:var(--text-primary)}button{font:inherit}.topbar,.round-bar,.section-title,.round-tools,.top-actions{display:flex;align-items:center;gap:8px}.top-actions{margin-left:auto}.topbar button,.round-bar>button,.round-tools button,.event-templates button,.danger,.collapse-title{border:1px solid var(--border-color);border-radius:9px;background:var(--bg-card);color:var(--text-primary);padding:8px 10px;cursor:pointer}.mode{font-weight:700;font-size:18px}.primary{background:var(--accent)!important;color:white!important;border-color:var(--accent)!important}.short-label{display:none}.mode-desc{color:var(--text-primary);font-size:13px;font-weight:500;margin:10px 0}.round-bar{flex-wrap:wrap;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:10px;margin-bottom:12px}.round-bar .arrow{padding:5px 10px}.round-tabs{display:flex;gap:5px;overflow:auto;max-width:100%;flex:1}.round-tabs button{white-space:nowrap;border:0;background:var(--bg-input);color:var(--text-secondary);border-radius:7px;padding:7px 9px;cursor:pointer}.round-tabs button.active{background:var(--accent);color:white}.next{background:var(--accent)!important;color:#fff!important;border-color:var(--accent)!important;font-weight:600}.more{padding:5px 10px;letter-spacing:1px}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px}.speeches-panel,.notes-panel section{background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:12px}.section-title{justify-content:space-between;margin-bottom:10px}.section-title span{display:block;font-weight:700}.section-title small{display:block;color:var(--text-muted);font-size:11px;margin-top:2px}.players-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.notes-panel{display:flex;flex-direction:column;gap:12px}.notes-section{padding:0}.collapse-title{display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:100%;text-align:left;border:0;border-radius:10px;background:transparent}.collapse-title span{font-weight:700;font-size:14px}.collapse-title small{color:var(--text-muted);font-size:11px;flex:1;min-width:120px}.collapse-title .badge{font-style:normal;font-size:11px;color:var(--accent);border:1px solid var(--border-color);border-radius:999px;padding:2px 8px;background:var(--bg-input)}.collapse-body{padding-top:10px}.event-templates{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}.event-templates button{padding:5px 7px;font-size:12px}.danger{color:#bd3b3b}.settings-form{display:flex;flex-direction:column;gap:12px}.setting-row{display:flex;flex-direction:column;gap:6px}.setting-row label{font-size:13px;font-weight:600;color:var(--text-secondary)}.vote-row{display:flex;gap:8px;align-items:center;margin:9px 0}.vote-row .el-select{flex:1}.tip{color:var(--text-secondary);font-size:13px}.prompt-options{display:flex;gap:12px;align-items:center;margin-bottom:10px}.prompt-options .el-input-number{width:190px}
/* 发言/公共/非公开/备注输入区统一深色表面（浅色主题下即浅色输入区） */
:deep(.el-textarea__inner){background:var(--bg-input);color:var(--text-primary);border-color:var(--border-color)}
:deep(.el-textarea__inner::placeholder){color:var(--text-muted)}

/* 夜间模式发言区折叠样式 */
.speeches-panel.collapsed {
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
}

.show-speeches {
  width: 100%;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 12px;
  font-weight: 500;
  cursor: pointer;
}

.show-speeches:hover {
  background: var(--accent-dark, var(--accent));
}

.collapsed .players-grid {
  margin-top: 12px;
}

/* 夜晚且玩家备注折叠时：信息区扩展为全宽，消除左侧空白 */
.workspace-night-collapsed {
  grid-template-columns: 1fr;
}

/* 待复核提示横幅 */
.review-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-left: 3px solid var(--accent);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}
.review-banner span {
  flex: 1;
  min-width: 200px;
  line-height: 1.5;
}
.confirm-review {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: white;
  border-radius: 7px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.confirm-review:hover {
  opacity: 0.9;
}

/* 复核弹窗提示文案 */
.role-review-hint {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
  margin: 8px 0 0;
}
.role-review-hint strong {
  color: var(--text-primary);
}
@media(max-width:720px){.board{padding:10px 8px}.topbar{align-items:center;flex-wrap:wrap;gap:6px}.mode{font-size:15px;order:0}.top-actions{width:100%;justify-content:space-between;margin-left:0}.top-actions .primary{flex:1}.full-label{display:none}.short-label{display:inline}.home,.theme{padding:6px 9px}.workspace{grid-template-columns:1fr}.players-grid{grid-template-columns:1fr}.round-tools .el-input{max-width:none;flex:1}.section-title .el-select{width:110px}.prompt-options{align-items:flex-start;flex-direction:column}}
</style>

<style lang="scss">
/* 弹窗（含提示词）在两种主题下使用主题表面，避免深色主题出现大片白色 */
.el-dialog{background:var(--bg-card);color:var(--text-primary)}
.el-dialog__title{color:var(--text-primary)}
.el-dialog .el-textarea__inner{background:var(--bg-input);color:var(--text-primary);border-color:var(--border-color)}
.el-dialog .el-textarea__inner::placeholder{color:var(--text-muted)}
.el-message-box{background:var(--bg-card);color:var(--text-primary)}
</style>
