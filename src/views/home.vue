<template>
  <div class="home">
    <div class="content">
      <img src="/logo.svg" alt="logo" class="logo">
      <h1 class="title">在线笔记</h1>
      <p class="subtitle">快速记录 · 智能标记 · 一键导出</p>
      <div class="game-section">
        <span class="wolf-title">狼人杀</span>
        <div class="wolf-actions">
          <button v-if="hasSession" class="start-btn start-btn--primary" @click="$emit('continue')">继续上一局</button>
          <button class="start-btn start-btn--outline" @click="$emit('new')">{{ hasSession ? '开始新对局' : '开始狼人杀对局' }}</button>
        </div>
      </div>
      <div class="other-section">
        <span class="other-title">其他模式</span>
        <button class="start-btn start-btn--ghost" @click="$emit('start', 'spy')">谁是卧底</button>
      </div>
      <div class="links">
        <a href="https://github.com/seiya058904/Wolf-Notes" target="_blank">GitHub</a>
      </div>
    </div>
  </div>
</template>

<script setup>
import {onMounted, ref} from 'vue'
import {hasSavedSession} from '@/lib/gameSession'

defineEmits(['start', 'continue', 'new'])

// 是否存在已保存的狼人杀对局：有则提供"继续上一局"入口
const hasSession = ref(false)
onMounted(() => { hasSession.value = hasSavedSession(window.localStorage) })
</script>

<style lang="scss" scoped>
.home {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
}

.content { text-align: center; }

.logo {
  width: 90px;
  height: auto;
  margin-bottom: 12px;
  filter: drop-shadow(0 2px 8px rgba(0,0,0,0.1));
}

.title {
  font-size: 32px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: 2px;
  margin-bottom: 8px;
  /* Use system font stack for title to avoid font-swap flash */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.subtitle {
  font-size: 13px;
  font-weight: 400;
  color: #aeaeb2;
  letter-spacing: 2px;
  text-indent: 2px; /* Fix centering offset caused by letter-spacing */
  margin-top: 0;
  margin-bottom: 24px;
  line-height: 18px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}

.game-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin-top: 32px;
}

.wolf-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

.wolf-title {
  font-size: 12px;
  color: #aeaeb2;
  letter-spacing: 4px;
}

.other-section {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.other-title {
  font-size: 11px;
  color: #d1d1d6;
  letter-spacing: 3px;
}

.start-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: 24px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;
  border: 1.5px solid transparent;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }

  &:active { transform: translateY(0); }

  &--primary {
    background: #5856d6;
    border-color: #5856d6;
    color: white;
    padding: 14px 40px;
    font-size: 16px;
    &:hover { background: #6e6ceb; border-color: #6e6ceb; }
  }

  &--outline {
    background: transparent;
    border-color: #aeaeb2;
    color: #1d1d1f;
    &:hover { border-color: #5856d6; color: #5856d6; }
  }

  &--ghost {
    background: transparent;
    border-color: #d1d1d6;
    color: #aeaeb2;
    padding: 8px 20px;
    font-size: 13px;
    &:hover { color: #6e6e73; border-color: #aeaeb2; }
  }
}

.links {
  margin-top: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #d1d1d6;
  font-size: 12px;

  a {
    color: #aeaeb2;
    text-decoration: none;
    &:hover { color: #6e6e73; }
  }
}

@media (max-width: 400px) {
  .start-btn { width: 240px; justify-content: center; }
}
</style>
