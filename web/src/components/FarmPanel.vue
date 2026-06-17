<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import LandCard from '@/components/LandCard.vue'
import { useAccountStore } from '@/stores/account'
import { useFarmStore } from '@/stores/farm'
import { useStatusStore } from '@/stores/status'

const farmStore = useFarmStore()
const accountStore = useAccountStore()
const statusStore = useStatusStore()
const { lands, summary, loading } = storeToRefs(farmStore)
const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const { status, loading: statusLoading, realtimeConnected } = storeToRefs(statusStore)

const operating = ref(false)
const activeOperation = ref('')

const operations = [
  { type: 'harvest', label: '收获', icon: 'i-carbon-crop-growth', buttonType: 'primary' as const },
  { type: 'clear', label: '一键务农', icon: 'i-carbon-clean', buttonType: 'success' as const },
  { type: 'plant', label: '种植', icon: 'i-carbon-sprout', buttonType: 'primary' as const, plain: true },
  { type: 'upgrade', label: '升级土地', icon: 'i-carbon-up-to-top', buttonType: 'warning' as const, plain: true },
  { type: 'all', label: '一键全收', icon: 'i-carbon-flash', buttonType: 'danger' as const, plain: true },
]

const summaryItems = [
  { key: 'harvestable', label: '可收', icon: 'i-carbon-crop-growth', type: 'warning' as const },
  { key: 'growing', label: '生长', icon: 'i-carbon-sprout', type: 'success' as const },
  { key: 'empty', label: '空闲', icon: 'i-carbon-checkbox', type: 'info' as const },
  { key: 'dead', label: '枯萎', icon: 'i-carbon-warning', type: 'danger' as const },
]

async function executeOperate(opType: string) {
  if (!currentAccountId.value || !opType)
    return

  operating.value = true
  activeOperation.value = opType
  try {
    await farmStore.operate(currentAccountId.value, opType)
  }
  finally {
    operating.value = false
    activeOperation.value = ''
  }
}

async function handleOperate(opType: string) {
  if (!currentAccountId.value)
    return

  const confirmMap: Record<string, string> = {
    harvest: '确定要收获所有成熟作物吗？',
    clear: '确定要一键务农吗？将执行除草、除虫、浇水。',
    plant: '确定要一键种植吗？系统会按策略配置执行。',
    upgrade: '确定要升级所有可升级土地吗？该操作会消耗金币。',
    all: '确定要一键全收吗？包含收获、除草、种植等操作。',
  }

  try {
    await ElMessageBox.confirm(
      confirmMap[opType] || '确定执行此操作吗？',
      '确认操作',
      {
        type: opType === 'all' || opType === 'upgrade' ? 'warning' : 'info',
        confirmButtonText: '确认执行',
        cancelButtonText: '取消',
        closeOnClickModal: false,
        closeOnPressEscape: true,
      },
    )
    await executeOperate(opType)
  }
  catch {
    // User cancelled.
  }
}

async function refresh() {
  if (currentAccountId.value) {
    const acc = currentAccount.value
    if (!acc)
      return

    if (!realtimeConnected.value)
      await statusStore.fetchStatus(currentAccountId.value)

    if (acc.running && status.value?.connection?.connected)
      farmStore.fetchLands(currentAccountId.value)
  }
}

watch(currentAccountId, () => {
  refresh()
})

const { pause, resume } = useIntervalFn(() => {
  if (lands.value) {
    lands.value = lands.value.map((land: any) =>
      land.matureInSec > 0 ? { ...land, matureInSec: land.matureInSec - 1 } : land,
    )
  }
}, 1000)

const { pause: pauseRefresh, resume: resumeRefresh } = useIntervalFn(refresh, 60000)

onMounted(() => {
  refresh()
  resume()
  resumeRefresh()
})

onUnmounted(() => {
  pause()
  pauseRefresh()
})
</script>

<template>
  <section class="farm-console-panel">
    <header class="farm-console-header">
      <div class="farm-console-title">
        <span class="title-icon i-carbon-crop-growth" />
        <div>
          <h2>土地详情</h2>
          <p>查看作物状态并执行批量农场操作。</p>
        </div>
      </div>

      <div class="farm-console-actions">
        <ElButton
          v-for="op in operations"
          :key="op.type"
          :type="op.buttonType"
          :plain="op.plain"
          :loading="operating && activeOperation === op.type"
          :disabled="operating"
          @click="handleOperate(op.type)"
        >
          <span :class="op.icon" class="mr-1" />
          {{ op.label }}
        </ElButton>
      </div>
    </header>

    <div class="farm-summary-strip">
      <ElTag
        v-for="item in summaryItems"
        :key="item.key"
        :type="item.type"
        effect="light"
        round
        size="large"
      >
        <span class="summary-tag">
          <span :class="item.icon" />
          <span>{{ item.label }}</span>
          <strong>{{ summary?.[item.key] || 0 }}</strong>
        </span>
      </ElTag>
    </div>

    <div class="farm-grid-zone">
      <div v-if="loading || statusLoading" class="farm-loading">
        <span class="i-svg-spinners-90-ring-with-bg text-3xl" />
      </div>

      <ElEmpty v-else-if="!currentAccountId" description="请先添加或选择农场账号" />

      <ElEmpty v-else-if="!status?.connection?.connected" description="账号未连接，请先运行账号或检查网络连接" />

      <ElEmpty v-else-if="!lands || lands.length === 0" description="暂无土地数据" />

      <div v-else class="land-grid">
        <LandCard
          v-for="land in lands"
          :key="land.id"
          :land="land"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.farm-console-panel {
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-surface);
  overflow: hidden;
}

.farm-console-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid var(--theme-border);
  padding: 18px 20px;
}

.farm-console-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  width: 34px;
  height: 34px;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--theme-radius-md);
  background: var(--theme-primary-soft);
  color: var(--theme-primary);
  font-size: 18px;
}

.farm-console-title h2 {
  margin: 0;
  color: var(--theme-text);
  font-size: 18px;
  font-weight: 700;
}

.farm-console-title p {
  margin: 2px 0 0;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.farm-console-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.farm-console-actions :deep(.el-button) {
  margin-left: 0;
}

.farm-summary-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  border-bottom: 1px solid var(--theme-border-subtle, var(--theme-border));
  background: var(--theme-surface-soft);
  padding: 12px 20px;
}

.summary-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.summary-tag strong {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
}

.farm-grid-zone {
  padding: 20px;
}

.farm-loading {
  min-height: 220px;
  display: grid;
  place-items: center;
  color: var(--theme-primary);
}

.land-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

@media (max-width: 768px) {
  .farm-console-header {
    align-items: stretch;
    flex-direction: column;
  }

  .farm-console-actions {
    justify-content: flex-start;
  }
}
</style>
