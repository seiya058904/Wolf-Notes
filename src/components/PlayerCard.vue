<template>
  <article class="player-card" :class="{'is-eliminated': player.lifeStatus === 'eliminated'}">
    <header>
      <strong>{{ seat }}号</strong>
      <div class="status-row">
        <button type="button" :class="['status', player.lifeStatus]" @click="cycleLife">{{ player.lifeStatus === 'alive' ? '存活' : '出局' }}</button>
        <button type="button" :class="['status', player.electionStatus]" @click="cycleElection">{{ electionText }}</button>
      </div>
    </header>
    <el-input :model-value="speech.text" type="textarea" :rows="3" :placeholder="`${seat}号本轮发言`" @update:model-value="value => $emit('update:text', value)"/>
    <div class="flags">
      <button v-for="flag in flagOptions" :key="flag.key" type="button" :class="{active: speech.flags?.[flag.key]}" @click="$emit('toggle:flag', flag.key)">{{ flag.label }}</button>
      <button type="button" class="quick" :class="{active: showTemplates}" @click="showTemplates = !showTemplates">快捷输入{{ showTemplates ? ' ⌃' : ' ⌄' }}</button>
    </div>
    <div v-if="showTemplates" class="templates">
      <button v-for="item in templateOptions" :key="item.key" type="button" @click="$emit('insert:template', item.key)">{{ item.label }}</button>
    </div>
  </article>
</template>

<script setup>
import {computed, ref} from 'vue'
const props = defineProps({seat: {type: Number, required: true}, player: {type: Object, required: true}, speech: {type: Object, required: true}})
const emit = defineEmits(['update:text', 'toggle:flag', 'insert:template', 'update:life', 'update:election'])
const flagOptions = [{key: 'noSpeech', label: '未发言'}, {key: 'lowInformation', label: '滑水'}, {key: 'noLastWords', label: '无遗言'}]
const templateOptions = [{key: 'seer', label: '自称预言家'}, {key: 'gold-water', label: '发金水'}, {key: 'black-water', label: '发查杀'}, {key: 'witch', label: '自称女巫'}, {key: 'silver-water', label: '发银水'}, {key: 'hunter', label: '自称猎人'}, {key: 'withdraw', label: '退水'}]
// 快捷输入：模板按钮默认收起，点击"快捷输入"展开（仍只向发言框插入可编辑文字）
const showTemplates = ref(false)
const electionText = computed(() => ({none: '警下', candidate: '警上', withdrawn: '退水'}[props.player.electionStatus] || '警下'))
const cycleLife = () => emit('update:life', props.player.lifeStatus === 'alive' ? 'eliminated' : 'alive')
const cycleElection = () => emit('update:election', {none: 'candidate', candidate: 'withdrawn', withdrawn: 'none'}[props.player.electionStatus] || 'none')
</script>

<style scoped lang="scss">
.player-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:10px;box-shadow:var(--shadow-sm)}.player-card.is-eliminated{opacity:.66}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}strong{font-size:15px}.status-row,.flags,.templates{display:flex;flex-wrap:wrap;gap:4px}.status,.flags button,.templates button{border:1px solid var(--border-color);background:var(--bg-input);color:var(--text-secondary);border-radius:999px;padding:3px 7px;font-size:11px;cursor:pointer}.status.alive{color:#16794b}.status.eliminated{color:#be3a3a}.status.candidate{color:#2f6ddb}.status.withdrawn{color:#996b12}.flags{margin:7px 0}.flags button.active{background:var(--accent);border-color:var(--accent);color:#fff}.flags button.quick.active{background:var(--bg-input);border-color:var(--accent);color:var(--accent)}.templates{display:flex;flex-wrap:wrap;gap:4px}.templates button{font-size:10px;padding:2px 6px}:deep(.el-textarea__inner){resize:vertical;background:var(--bg-input);color:var(--text-primary);border-color:var(--border-color);min-height:68px}@media(max-width:600px){.player-card{padding:9px}}
</style>
