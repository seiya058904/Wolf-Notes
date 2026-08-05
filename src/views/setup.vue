<template>
  <div class="setup-page">
    <header class="setup-topbar">
      <button type="button" class="home" @click="$emit('cancel')">返回首页</button>
      <h2 class="title">开局设置</h2>
      <div class="stepper">
        <button type="button" :class="{active: step === 1, done: step > 1}" @click="step = 1">① 基础信息</button>
        <span class="arrow">→</span>
        <button type="button" :class="{active: step === 2}" :disabled="!baseReady" @click="step = 2">② 我的已知信息</button>
      </div>
    </header>

    <main class="setup-body">
      <section class="setup-main">
        <!-- 第 1 步：基础信息（版型 + 座位 + 身份） -->
        <template v-if="step === 1">
          <div class="panel">
            <h3>选择版型</h3>
            <div class="mode-grid">
              <button v-for="mode in gameModes" :key="mode.id" type="button" class="mode-card" :class="{active: modeId === mode.id}" @click="selectMode(mode)">
                <span class="mode-name">{{ mode.name }}</span>
                <span class="mode-type">{{ mode.type }}</span>
              </button>
            </div>
            <p v-if="selectedMode" class="mode-desc">角色构成：{{ modeDesc }}</p>
          </div>
          <div class="panel">
            <h3>选择我的座位</h3>
            <div class="seat-grid">
              <button v-for="n in 12" :key="n" type="button" class="seat" :class="{active: mySeat === n}" @click="mySeat = n">{{ n }}号</button>
            </div>
          </div>
          <div class="panel">
            <h3>选择我的真实身份</h3>
            <div class="role-grid">
              <button v-for="role in roleOptions" :key="role.value" type="button" class="role-btn" :class="{active: myRole === role.value}" @click="selectRole(role.value)">{{ role.label }}</button>
            </div>
            <div v-if="needCamp" class="camp-field">
              <label>该身份阵营未知，请手动选择阵营：</label>
              <el-radio-group v-model="myCamp" class="camp-options">
                <el-radio value="好人">好人</el-radio>
                <el-radio value="狼人">狼人</el-radio>
                <el-radio value="第三方">第三方</el-radio>
              </el-radio-group>
            </div>
          </div>
        </template>

        <!-- 第 2 步：我的已知信息 -->
        <template v-else>
          <div class="panel">
            <h3>我的已知信息</h3>
            <PrivateInfoForm v-model:value="privateData" :seat="mySeat"/>
            <div class="field notes-field">
              <label>跨身份通用补充</label>
              <el-input v-model="privateNotes" type="textarea" :rows="3" placeholder="切换身份后仍会保留并交给 AI，请勿填写身份专属信息"/>
            </div>
          </div>
        </template>
      </section>

      <aside class="setup-summary">
        <h3>开局摘要</h3>
        <p class="summary-line">{{ summaryLine }}</p>
        <p class="summary-private">{{ privateInfoText }}</p>
        <div class="nav">
          <button v-if="step > 1" type="button" class="btn" @click="step--">上一步</button>
          <button v-if="step === 1" type="button" class="btn primary" :disabled="!baseReady" @click="step = 2">下一步</button>
          <button v-if="step === 2" type="button" class="btn confirm" :disabled="!canConfirm" @click="confirmAndStart">确认并进入记录台</button>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import {computed, onMounted, ref} from 'vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import {storeToRefs} from 'pinia'
import {useGameModeStore} from '@/stores/gameModeStore'
import PrivateInfoForm from '@/components/privateInfoForm.vue'
import {
    aliasRole, buildPrivateInfoText, createSession, defaultPrivate, hasSavedSession,
    inferCamp, isPrivateInfoConfirmed, privateTypeForRole, syncPrivateInfo
} from '@/lib/gameSession'

const props = defineProps({
    // 旧会话（"继续上一局"补全时传入；null 表示全新对局）
    draft: {type: Object, default: null}
})
const emit = defineEmits(['cancel', 'confirm'])

const store = useGameModeStore()
const {gameModes, selectedModeId} = storeToRefs(store)

const step = ref(1)
const modeId = ref(props.draft?.game?.modeId ?? null)
const mySeat = ref(props.draft?.game?.mySeat ?? null)
const myRole = ref(props.draft?.game?.myRole || '')
const myCamp = ref(props.draft?.game?.myCamp || '')
const privateNotes = ref(props.draft?.game?.privateNotes || '')
const privateData = ref(initPrivate())

function initPrivate() {
    const draft = props.draft?.game
    if (draft?.private) return JSON.parse(JSON.stringify(draft.private))
    // 旧数据无结构化 private 时按当前身份初始化；旧 privateInfo 文本迁入跨身份通用补充
    if (draft?.privateInfo?.trim() && !privateNotes.value) privateNotes.value = draft.privateInfo.trim()
    return defaultPrivate(privateTypeForRole(props.draft?.game?.myRole || ''))
}

const selectedMode = computed(() => gameModes.value.find(mode => mode.id === modeId.value) || null)
const modeDesc = computed(() => selectedMode.value?.roles?.map(role => `${role.count > 1 ? role.count : ''}${aliasRole(role.text)}`).join('·') || '')
const displayRole = computed(() => myRole.value ? aliasRole(myRole.value) : '')

// 身份选项：当前版型角色（简称存储、全称显示）+ 通用身份（按显示名去重，版型角色优先）
const roleOptions = computed(() => {
    const modeRoles = (selectedMode.value?.roles || []).map(role => ({label: aliasRole(role.text), value: role.text}))
    const common = ['平民', '狼人', '预言家', '女巫', '猎人', '守卫', '其他'].map(text => ({label: text, value: text}))
    const seen = new Set()
    const options = []
    for (const item of [...modeRoles, ...common]) {
        if (seen.has(item.label)) continue
        seen.add(item.label)
        options.push(item)
    }
    return options
})

const needCamp = computed(() => Boolean(myRole.value) && !inferCamp(myRole.value))
const baseReady = computed(() => Boolean(modeId.value && mySeat.value && myRole.value && myCamp.value))
const privateInfoText = computed(() => buildPrivateInfoText(privateData.value, privateNotes.value))
const summaryLine = computed(() => [selectedMode.value?.name, mySeat.value ? `${mySeat.value}号` : '', displayRole.value, myCamp.value ? `${myCamp.value}阵营` : ''].filter(Boolean).join(' · ') || '尚未选择基础信息')
const canConfirm = computed(() => baseReady.value && isPrivateInfoConfirmed(privateData.value))

const selectMode = (mode) => { modeId.value = mode.id; store.selectMode(mode.id) }

const selectRole = (role) => {
    myRole.value = role
    myCamp.value = inferCamp(role)
    // 只重置身份结构化数据；跨身份通用补充 privateNotes 保留
    if (privateNotes.value.trim()) ElMessage.info('已保留“跨身份通用补充”说明，将用于新身份的提示词')
    privateData.value = defaultPrivate(privateTypeForRole(role))
}

const confirmAndStart = async () => {
    // 组装会话：继续上一局补全时复用旧会话（保留轮次/发言/备注）；全新对局用 createSession()
    const session = props.draft?.schemaVersion === 3 ? props.draft : createSession()
    session.game.modeId = modeId.value
    session.game.mySeat = mySeat.value
    session.game.myRole = myRole.value
    session.game.myCamp = myCamp.value
    session.game.private = JSON.parse(JSON.stringify(privateData.value))
    session.game.privateNotes = privateNotes.value
    syncPrivateInfo(session.game)
    const start = () => emit('confirm', session)
    // 开始新对局且本地已有旧对局：必须明确确认替换，取消则保留旧数据
    if (!props.draft && hasSavedSession(window.localStorage)) {
        try {
            await ElMessageBox.confirm('创建新对局将替换现有的旧对局（旧对局的轮次和发言将被清空），确定继续吗？', '替换旧对局', {confirmButtonText: '确定替换', cancelButtonText: '取消', type: 'warning'})
            start()
        } catch { /* 用户取消：保留原数据 */ }
    } else {
        start()
    }
}

onMounted(async () => {
    if (!store.isInitialized) await store.initializeStore()
    // 可预选上次使用版型，但用户仍需在流程中确认
    if (!modeId.value && selectedModeId.value) modeId.value = selectedModeId.value
})
</script>

<style scoped lang="scss">
.setup-page {
  min-height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  max-width: 1080px;
  margin: 0 auto;
  padding: 16px;
  box-sizing: border-box;
}

.setup-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.setup-topbar .title { font-size: 18px; margin: 0; }
.home { border: 1px solid var(--border-color); border-radius: 9px; background: var(--bg-card); color: var(--text-primary); padding: 7px 12px; cursor: pointer; }

.stepper { display: flex; align-items: center; gap: 6px; }
.stepper button { border: 1px solid var(--border-color); border-radius: 9px; background: var(--bg-card); color: var(--text-secondary); padding: 6px 14px; cursor: pointer; font-size: 13px; }
.stepper button.active { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 700; box-shadow: 0 2px 8px rgba(90, 84, 217, 0.35); }
.stepper button.done { color: var(--accent); border-color: rgba(90, 84, 217, 0.5); }
.stepper button:disabled { opacity: 0.45; cursor: not-allowed; }
.stepper .arrow { color: var(--text-muted); }

.setup-body { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; align-items: start; }

.setup-main { display: flex; flex-direction: column; gap: 14px; }

.panel { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 16px; }
.panel h3 { margin: 0 0 12px; font-size: 16px; }

.mode-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; max-height: 260px; overflow: auto; }
.mode-card { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-input); color: var(--text-primary); cursor: pointer; text-align: left; }
.mode-card.active { border-color: var(--accent); background: rgba(90, 84, 217, 0.1); }
.mode-card .mode-name { font-weight: 600; font-size: 14px; }
.mode-card .mode-type { font-size: 11px; color: var(--text-muted); }
.mode-desc { color: var(--text-primary); font-size: 13px; font-weight: 500; margin: 10px 0 0; }

.seat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
.seat { padding: 12px 0; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-input); color: var(--text-primary); font-size: 15px; cursor: pointer; }
.seat.active { border-color: var(--accent); background: rgba(90, 84, 217, 0.1); color: var(--accent); font-weight: 700; }

.role-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
.role-btn { padding: 10px 6px; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-input); color: var(--text-primary); font-size: 14px; cursor: pointer; }
.role-btn.active { border-color: var(--accent); background: rgba(90, 84, 217, 0.1); color: var(--accent); font-weight: 700; }

.camp-field { margin-top: 14px; display: flex; flex-direction: column; gap: 8px; }
.camp-field label { font-size: 13px; color: var(--text-secondary); }
.camp-options { display: flex; gap: 16px; }

.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.notes-field { margin-top: 14px; }

.setup-summary { position: sticky; top: 16px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.setup-summary h3 { margin: 0; font-size: 15px; }
.summary-line { font-size: 14px; font-weight: 600; line-height: 1.6; }
.summary-private { font-size: 13px; color: var(--text-secondary); line-height: 1.6; word-break: break-all; white-space: pre-wrap; }
.nav { display: flex; flex-direction: column; gap: 8px; }
.btn { border: 1px solid var(--border-color); border-radius: 9px; background: var(--bg-card); color: var(--text-primary); padding: 9px 16px; cursor: pointer; font-size: 14px; }
.btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn.confirm { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 700; padding: 12px 16px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }

@media (max-width: 720px) {
  .setup-page { padding: 10px; }
  .setup-body { grid-template-columns: 1fr; }
  .setup-summary { position: static; }
  .seat-grid { grid-template-columns: repeat(4, 1fr); }
  .mode-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
