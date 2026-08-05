<template>
  <div class="private-info-form">
    <!-- 狼人 / 狼人特殊角色 -->
    <template v-if="data.type === 'wolf'">
      <div class="field">
        <label>已知狼队友</label>
        <el-select v-model="data.knownTeammates" multiple :placeholder="`选择除自己（${seat}号）以外的座位`" class="full">
          <el-option v-for="n in 12" :key="n" :label="`${n}号`" :value="n" :disabled="n === seat"/>
        </el-select>
      </div>
      <div class="field">
        <label>队友状态</label>
        <el-radio-group v-model="data.teammateState" class="stack">
          <el-radio value="known">已选择已知队友</el-radio>
          <el-radio value="none">没有已知队友</el-radio>
          <el-radio value="solo">独立狼人或特殊身份</el-radio>
          <el-radio value="unknown">暂时不确定</el-radio>
        </el-radio-group>
      </div>
    </template>

    <!-- 预言家 -->
    <template v-else-if="data.type === 'seer'">
      <div class="field">
        <label>查验情况</label>
        <el-radio-group v-model="seerMode" class="stack">
          <el-radio value="none">尚未查验或暂未记录</el-radio>
          <el-radio value="checked">已有查验记录</el-radio>
        </el-radio-group>
      </div>
      <div v-if="seerMode === 'checked'" class="checks">
        <div v-for="(check, index) in data.checks" :key="index" class="check-row">
          <el-input v-model="check.round" size="small" placeholder="轮次，如第一夜" class="round"/>
          <el-select v-model="check.target" size="small" placeholder="目标" class="target">
            <el-option v-for="n in 12" :key="n" :label="`${n}号`" :value="n"/>
          </el-select>
          <el-select v-model="check.result" size="small" placeholder="结果" class="result">
            <el-option label="好人" value="好人"/>
            <el-option label="狼人" value="狼人"/>
            <el-option label="其他" value="其他"/>
            <el-option label="不确定" value="不确定"/>
          </el-select>
          <el-button type="danger" :icon="Delete" circle size="small" @click="data.checks.splice(index, 1)"/>
        </div>
        <el-button size="small" type="primary" plain @click="data.checks.push({round: '', target: null, result: ''})">添加查验记录</el-button>
      </div>
    </template>

    <!-- 女巫 -->
    <template v-else-if="data.type === 'witch'">
      <div class="field">
        <label>已知夜间刀口或死亡目标</label>
        <el-select v-model="data.nightKill" clearable placeholder="暂未知（可留空）" class="full">
          <el-option v-for="n in 12" :key="n" :label="`${n}号`" :value="n"/>
        </el-select>
      </div>
      <div class="field">
        <label>解药</label>
        <el-radio-group v-model="data.saveUsed" class="stack">
          <el-radio value="used">已使用</el-radio>
          <el-radio value="none">未使用</el-radio>
          <el-radio value="not-occurred">尚未发生</el-radio>
          <el-radio value="unknown">暂不确定</el-radio>
        </el-radio-group>
        <el-select v-if="data.saveUsed === 'used'" v-model="data.saveTarget" placeholder="解药目标" class="full">
          <el-option v-for="n in 12" :key="n" :label="`${n}号`" :value="n"/>
        </el-select>
      </div>
      <div class="field">
        <label>毒药</label>
        <el-radio-group v-model="data.poisonUsed" class="stack">
          <el-radio value="used">已使用</el-radio>
          <el-radio value="none">未使用</el-radio>
          <el-radio value="not-occurred">尚未发生</el-radio>
          <el-radio value="unknown">暂不确定</el-radio>
        </el-radio-group>
        <el-select v-if="data.poisonUsed === 'used'" v-model="data.poisonTarget" placeholder="毒药目标" class="full">
          <el-option v-for="n in 12" :key="n" :label="`${n}号`" :value="n" :disabled="n === seat"/>
        </el-select>
      </div>
    </template>

    <!-- 守卫 -->
    <template v-else-if="data.type === 'guard'">
      <div class="field">
        <label>守护情况</label>
        <el-radio-group v-model="data.state" class="stack">
          <el-radio value="none">本轮未守护</el-radio>
          <el-radio value="not-occurred">尚未发生</el-radio>
          <el-radio value="guarded">有守护</el-radio>
        </el-radio-group>
      </div>
      <template v-if="data.state === 'guarded'">
        <div class="field">
          <label>守护目标</label>
          <el-select v-model="data.target" placeholder="守护对象" class="full">
            <el-option v-for="n in 12" :key="n" :label="`${n}号`" :value="n" :disabled="n === seat"/>
          </el-select>
        </div>
        <div class="field">
          <label>对应轮次</label>
          <el-input v-model="data.round" placeholder="如：第一夜" class="full"/>
        </div>
      </template>
    </template>

    <!-- 平民 -->
    <template v-else-if="data.type === 'villager'">
      <div class="plain-tip">你当前没有额外夜间私有信息。</div>
    </template>

    <!-- 其他 -->
    <template v-else>
      <div class="field">
        <label>私有信息或身份补充</label>
        <el-input v-model="data.text" type="textarea" :rows="4" placeholder="写下只有你掌握的补充信息，例如：我是幸运儿、接到技能等"/>
      </div>
    </template>
  </div>
</template>

<script setup>
import {computed} from 'vue'
import {Delete} from '@element-plus/icons-vue'
import {isPrivateInfoConfirmed} from '@/lib/gameSession'

const props = defineProps({
  value: {type: Object, required: true},
  seat: {type: Number, default: null}
})
const emit = defineEmits(['update:value'])

const data = computed({
  get: () => props.value,
  set: v => emit('update:value', v)
})

// 预言家：有查验记录（列表非空）时切换到列表编辑。
// state 语义：null=尚未表态（两选项均未选中，需主动选择）；'none'=已确认"尚未查验"；有记录时保持 null。
const seerMode = computed({
  get: () => {
    if ((data.value.checks || []).length > 0) return 'checked'
    return data.value.state === 'none' ? 'none' : null
  },
  set: mode => {
    if (mode === 'none') {
      data.value.checks = []
      data.value.state = 'none'
    } else {
      data.value.state = null
      if (!data.value.checks.length) data.value.checks = [{round: '', target: null, result: ''}]
    }
  }
})

defineExpose({
  confirmed: computed(() => isPrivateInfoConfirmed(data.value))
})
</script>

<style scoped lang="scss">
.private-info-form { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.stack { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.full { width: 100%; }
.checks { display: flex; flex-direction: column; gap: 8px; }
.check-row { display: flex; gap: 6px; align-items: center; }
.check-row .round { width: 150px; }
.check-row .target { width: 110px; }
.check-row .result { width: 110px; }
.plain-tip { color: var(--text-secondary); font-size: 13px; padding: 8px 0; }
@media (max-width: 480px) {
  .check-row { flex-wrap: wrap; }
  .check-row .round { width: 100%; }
  .check-row .target { flex: 1; min-width: 90px; }
  .check-row .result { flex: 1; min-width: 90px; }
}
</style>
