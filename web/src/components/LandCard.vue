<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  land: any
}>()

const land = computed(() => props.land)

const growProgress = computed(() => {
  const matureInSec = Number(land.value.matureInSec) || 0
  const totalGrowTime = Number(land.value.totalGrowTime) || 0

  if (totalGrowTime <= 0 || matureInSec <= 0)
    return 0

  return Math.min(100, Math.max(0, 100 - (matureInSec / totalGrowTime) * 100))
})

const statusMeta = computed(() => {
  const status = land.value.status
  if (status === 'locked')
    return { label: '未解锁', className: 'is-locked', tagType: 'info' as const }
  if (status === 'dead')
    return { label: '枯萎', className: 'is-dead', tagType: 'danger' as const }
  if (status === 'harvestable')
    return { label: '可收获', className: 'is-harvestable', tagType: 'warning' as const }
  if (status === 'stealable')
    return { label: '可偷取', className: 'is-stealable', tagType: 'success' as const }
  if (status === 'growing')
    return { label: '生长中', className: 'is-growing', tagType: 'success' as const }
  return { label: land.value.phaseName || '未开垦', className: 'is-idle', tagType: 'info' as const }
})

const landLevelClass = computed(() => `level-${Number(land.value.level) || 0}`)

function formatTime(sec: number) {
  if (sec <= 0)
    return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h > 0 ? `${h}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function getSafeImageUrl(url: string) {
  if (!url)
    return ''
  if (url.startsWith('http://'))
    return url.replace('http://', 'https://')
  return url
}

function getLandTypeName(level: number) {
  const typeMap: Record<number, string> = {
    0: '普通',
    1: '黄土地',
    2: '红土地',
    3: '黑土地',
    4: '金土地',
    5: '紫金土地',
  }
  return typeMap[Number(level) || 0] || '普通'
}

function getPlantSizeText(land: any) {
  const size = Number(land?.plantSize) || 1
  if (size <= 1)
    return ''
  return `${size}x${size}`
}
</script>

<template>
  <article class="land-card" :class="[statusMeta.className, landLevelClass]">
    <div class="land-card__topline" />

    <header class="land-card__header">
      <span class="land-id">#{{ land.id }}</span>
      <ElTag :type="statusMeta.tagType" effect="light" round size="small">
        {{ statusMeta.label }}
      </ElTag>
    </header>

    <div class="land-card__body">
      <div class="plant-preview">
        <img
          v-if="land.seedImage"
          :src="getSafeImageUrl(land.seedImage)"
          :alt="land.plantName || '作物'"
          class="plant-image"
          loading="lazy"
          referrerpolicy="no-referrer"
        >
        <span v-else class="plant-placeholder i-carbon-sprout" />
      </div>

      <div class="plant-info">
        <div class="plant-name" :title="land.plantName">
          {{ land.plantName || '-' }}
        </div>
        <div class="plant-meta">
          <span class="land-type-chip">{{ getLandTypeName(land.level) }}</span>
          <span>季 {{ land.totalSeason > 0 ? (`${land.currentSeason}/${land.totalSeason}`) : '-/-' }}</span>
        </div>
      </div>
    </div>

    <div class="land-progress">
      <div class="progress-row">
        <span>{{ land.matureInSec > 0 ? '成熟倒计时' : (land.phaseName || '当前阶段') }}</span>
        <strong>{{ land.matureInSec > 0 ? formatTime(land.matureInSec) : statusMeta.label }}</strong>
      </div>
      <ElProgress
        :percentage="growProgress"
        :stroke-width="6"
        :show-text="false"
        status="success"
      />
    </div>

    <footer class="land-card__footer">
      <ElTag v-if="land.plantSize > 1" type="danger" effect="light" round size="small">
        合种 {{ getPlantSizeText(land) }}
      </ElTag>
      <ElTag v-if="land.needWater" type="primary" effect="light" round size="small">
        <span class="i-carbon-rain-drop mr-1" />需浇水
      </ElTag>
      <ElTag v-if="land.needWeed" type="success" effect="light" round size="small">
        <span class="i-carbon-sprout mr-1" />需除草
      </ElTag>
      <ElTag v-if="land.needBug" type="danger" effect="light" round size="small">
        <span class="i-carbon-warning mr-1" />需除虫
      </ElTag>
    </footer>
  </article>
</template>

<style scoped>
.land-card {
  position: relative;
  min-height: 208px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--land-border, var(--theme-border));
  border-radius: var(--theme-radius-lg);
  background: var(--land-surface, var(--theme-surface));
  overflow: hidden;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

.land-card:hover {
  border-color: color-mix(
    in srgb,
    var(--land-accent, var(--theme-primary)) 58%,
    var(--land-border, var(--theme-border))
  );
  box-shadow: 0 8px 22px rgba(31, 35, 41, 0.08);
  transform: translateY(-1px);
}

.land-card__topline {
  height: 4px;
  background: linear-gradient(
    90deg,
    var(--land-accent, var(--theme-border)),
    var(--land-accent-2, var(--land-accent, var(--theme-border)))
  );
}

.land-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px 0;
}

.land-id {
  color: var(--theme-text-muted);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
}

.land-card__body {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 16px 14px;
}

.plant-preview {
  width: 72px;
  height: 72px;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid var(--land-border, var(--theme-border));
  border-radius: var(--theme-radius-lg);
  background: var(--land-preview, var(--theme-surface-soft));
}

.plant-image {
  max-width: 54px;
  max-height: 54px;
  object-fit: contain;
}

.plant-placeholder {
  color: var(--theme-text-muted);
  font-size: 30px;
}

.plant-info {
  min-width: 0;
  flex: 1;
}

.plant-name {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plant-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  color: var(--theme-text-muted);
  font-size: 13px;
}

.land-type-chip {
  color: var(--land-accent-strong, var(--theme-text));
  font-weight: 600;
}

.land-progress {
  padding: 0 16px 14px;
}

.progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--theme-text-muted);
  font-size: 13px;
}

.progress-row strong {
  color: var(--land-accent-strong, var(--land-accent, var(--theme-text)));
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 13px;
}

.land-progress :deep(.el-progress-bar__outer) {
  background-color: var(--land-track, var(--theme-border));
}

.land-progress :deep(.el-progress-bar__inner) {
  background: linear-gradient(
    90deg,
    var(--land-accent, var(--theme-success)),
    var(--land-accent-2, var(--land-accent, var(--theme-success)))
  );
}

.land-card__footer {
  min-height: 42px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
  border-top: 1px solid var(--theme-border-subtle, var(--theme-border));
  background: var(--land-footer, var(--theme-surface-soft));
  padding: 10px 16px;
}

.level-0 {
  --land-accent: #6b7280;
  --land-accent-2: #9ca3af;
  --land-accent-strong: #4b5563;
  --land-border: #d9dde5;
  --land-surface: #ffffff;
  --land-preview: #f6f7f9;
  --land-track: #e8ebf0;
  --land-footer: #f7f8fa;
}

.level-1 {
  --land-accent: #c69a2d;
  --land-accent-2: #dfbd62;
  --land-accent-strong: #8a6416;
  --land-border: #ead9a8;
  --land-surface: linear-gradient(180deg, #fffdf8 0%, #fffaf0 100%);
  --land-preview: #fff7df;
  --land-track: #efe5c9;
  --land-footer: #fffaf0;
}

.level-2 {
  --land-accent: #b9634f;
  --land-accent-2: #d48a72;
  --land-accent-strong: #884131;
  --land-border: #e8c4b8;
  --land-surface: linear-gradient(180deg, #fffafa 0%, #fff3ef 100%);
  --land-preview: #fff0ea;
  --land-track: #f0d8d0;
  --land-footer: #fff6f3;
}

.level-3 {
  --land-accent: #374151;
  --land-accent-2: #697386;
  --land-accent-strong: #1f2937;
  --land-border: #c8ced8;
  --land-surface: linear-gradient(180deg, #fbfcfd 0%, #f1f3f6 100%);
  --land-preview: #eef1f5;
  --land-track: #dce1e8;
  --land-footer: #f4f6f8;
}

.level-4 {
  --land-accent: #d6a019;
  --land-accent-2: #f1d06a;
  --land-accent-strong: #94660d;
  --land-border: #e8cf7d;
  --land-surface: linear-gradient(180deg, #fffdf6 0%, #fff7df 100%);
  --land-preview: linear-gradient(135deg, #fff7d7 0%, #fffdf4 100%);
  --land-track: #efe2bd;
  --land-footer: #fff9e8;
}

.level-5 {
  --land-accent: #7c5cff;
  --land-accent-2: #d7a72f;
  --land-accent-strong: #5a3fd1;
  --land-border: #d6c9ff;
  --land-surface: linear-gradient(180deg, #fdfbff 0%, #f6f1ff 100%);
  --land-preview: radial-gradient(circle at 70% 20%, rgba(215, 167, 47, 0.18), transparent 42%), #f2edff;
  --land-track: #e6defa;
  --land-footer: #f9f6ff;
}

.is-dead {
  filter: saturate(0.72);
}

.is-locked {
  opacity: 0.72;
}

:global(html.dark) .level-0 {
  --land-accent: #8b95a5;
  --land-accent-2: #aab2bf;
  --land-accent-strong: #d5dae2;
  --land-border: #3a4150;
  --land-surface: #202530;
  --land-preview: #262c38;
  --land-track: #343b49;
  --land-footer: #242a35;
}

:global(html.dark) .level-1 {
  --land-accent: #c79a31;
  --land-accent-2: #e0be61;
  --land-accent-strong: #f0d58a;
  --land-border: #594a26;
  --land-surface: linear-gradient(180deg, #29261d 0%, #252217 100%);
  --land-preview: #332b18;
  --land-track: #42391f;
  --land-footer: #29261c;
}

:global(html.dark) .level-2 {
  --land-accent: #c87662;
  --land-accent-2: #e19783;
  --land-accent-strong: #f0b4a4;
  --land-border: #5a3832;
  --land-surface: linear-gradient(180deg, #2d2423 0%, #271f1d 100%);
  --land-preview: #362624;
  --land-track: #49332f;
  --land-footer: #2e2422;
}

:global(html.dark) .level-3 {
  --land-accent: #111827;
  --land-accent-2: #6b7280;
  --land-accent-strong: #d9dee8;
  --land-border: #4b5565;
  --land-surface: linear-gradient(180deg, #20242c 0%, #191d24 100%);
  --land-preview: #111827;
  --land-track: #363d49;
  --land-footer: #1d222b;
}

:global(html.dark) .level-4 {
  --land-accent: #d2a324;
  --land-accent-2: #f1cf69;
  --land-accent-strong: #f3d981;
  --land-border: #6a5524;
  --land-surface: linear-gradient(180deg, #2e291b 0%, #272316 100%);
  --land-preview: linear-gradient(135deg, #403415 0%, #2a2619 100%);
  --land-track: #4a3f24;
  --land-footer: #2c281b;
}

:global(html.dark) .level-5 {
  --land-accent: #9b8cff;
  --land-accent-2: #d7a72f;
  --land-accent-strong: #c7bdff;
  --land-border: #594f84;
  --land-surface: linear-gradient(180deg, #29243a 0%, #211d30 100%);
  --land-preview: radial-gradient(circle at 70% 20%, rgba(215, 167, 47, 0.2), transparent 42%), #30284b;
  --land-track: #423960;
  --land-footer: #282238;
}
</style>
