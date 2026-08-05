<template>
  <div>
    <Home v-if="currentView === 'home'" @start="handleStart" @continue="handleContinue" @new="handleNew"/>
    <Setup v-else-if="currentView === 'setup'" :draft="setupDraft" @cancel="handleCancelSetup" @confirm="handleSetupConfirm"/>
    <Main v-else-if="currentView === 'werewolf'" @go-home="goHome" @missing-setup="handleMissingSetup"/>
    <Spy v-else-if="currentView === 'spy'" @go-home="goHome"/>
  </div>
</template>

<script setup>
import {ref, onMounted} from 'vue'
import {ElMessage} from 'element-plus'
import {useGameModeStore} from '@/stores/gameModeStore'
import Home from '@/views/home.vue'
import Setup from '@/views/setup.vue'
import Main from '@/views/main.vue'
import Spy from '@/views/spy.vue'
import {isSessionReady, loadSession, resolveInitialView, saveSession} from '@/lib/gameSession'

const store = useGameModeStore()
// 页面与数据分离：当前视图不持久化，初始化恒为首页。
const currentView = ref(resolveInitialView())
// 开局设置草稿：null 表示全新对局；传入旧会话表示"继续上一局"但需补全开局信息。
const setupDraft = ref(null)

const goHome = () => { currentView.value = 'home' }

// 谁是卧底等游戏类型入口（狼人杀改走 continue/new 两个明确入口）
const handleStart = (game) => { currentView.value = game }

// 继续上一局：完整会话直接进入记录台；不完整则转到开局设置预填补全（不清空任何数据）
const handleContinue = () => {
  const session = loadSession(window.localStorage)
  if (isSessionReady(session.game)) {
    currentView.value = 'werewolf'
  } else {
    setupDraft.value = session
    currentView.value = 'setup'
    ElMessage.warning('上一局的开局信息不完整，请先补全后再进入记录台')
  }
}

// 开始新对局：进入开局设置（不立即清空旧数据，确认时才替换）
const handleNew = () => {
  setupDraft.value = null
  currentView.value = 'setup'
}

const handleCancelSetup = () => { currentView.value = 'home' }

// 开局设置最终确认后才创建/更新会话并进入记录台
const handleSetupConfirm = (session) => {
  saveSession(window.localStorage, session)
  currentView.value = 'werewolf'
}

// 记录台访问门禁：加载后发现开局信息缺失，返回开局设置补全
const handleMissingSetup = () => {
  setupDraft.value = loadSession(window.localStorage)
  currentView.value = 'setup'
  ElMessage.warning('开局信息不完整，请先完成开局设置')
}

onMounted(async () => {
  await store.initializeStore()
  // 每次加载/刷新都回到首页，绝不因本地会话自动进入记录台
  currentView.value = resolveInitialView()
})

// 欢迎页
console.log(
    "%c两水夹明镜，双桥落彩虹。",
    "font-weight: 600; font-size: 20px; background: linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet); color: transparent; -webkit-background-clip: text; background-clip: text;"
);
console.log('开源地址：https://github.com/syhy0612/lrsNotes');
</script>

<style lang="scss" scoped>
</style>
