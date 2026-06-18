<script setup lang="ts">
import { useIntervalFn, useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import LandCard from '@/components/LandCard.vue'
import { useAccountStore } from '@/stores/account'
import { useFriendStore } from '@/stores/friend'
import { useStatusStore } from '@/stores/status'
import { useToastStore } from '@/stores/toast'

type RadarGrade = 'S' | 'A' | 'B' | 'C'
type RadarRecommendation = 'steal_now' | 'wait' | 'skip' | 'retry'
type ScanMode = 'reset' | 'continue'

interface FriendRadarResult {
  gid: string
  name: string
  avatarUrl: string
  level: number
  blacklisted: boolean
  scanned: boolean
  scanning: boolean
  error: string
  stealableLandCount: number
  nearMatureLandCount: number
  fastestMatureInSec: number | null
  score: number
  grade: RadarGrade
  recommendation: RadarRecommendation
  lands?: any[]
}

const NEAR_MATURE_SECONDS = 10 * 60
const BLACKLIST_PENALTY = 1000
const DEFAULT_SCAN_LIMIT = 20

const accountStore = useAccountStore()
const friendStore = useFriendStore()
const statusStore = useStatusStore()
const toast = useToastStore()

const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const {
  friends,
  blacklist,
  friendLands,
  friendLandsLoading,
  loading: friendsLoading,
  stealReports,
  stealReportsLoading,
  friendValueRanking,
  friendValueRankingLoading,
} = storeToRefs(friendStore)
const { status, realtimeConnected } = storeToRefs(statusStore)

const activeTab = shallowRef('radar')
const radarResults = ref<Record<string, FriendRadarResult>>({})
const scanning = shallowRef(false)
const stopping = shallowRef(false)
const scanCursor = shallowRef(0)
const scanTargetCount = shallowRef(0)
const activeFriendName = shallowRef('')
const pageError = shallowRef('')
const selectedGid = shallowRef('')
const detailDrawerVisible = shallowRef(false)
const scanRunId = shallowRef(0)
const reportStatus = shallowRef('all')
const reportSource = shallowRef('all')
const rankingDays = shallowRef(7)
const refreshingMatureGids = new Set<string>()
const isCompactViewport = useMediaQuery('(max-width: 900px)')

const canScan = computed(() => {
  return !!currentAccountId.value && !!currentAccount.value?.running && !!status.value?.connection?.connected
})

const connectionText = computed(() => {
  if (!currentAccountId.value)
    return '未选择账号'
  if (!currentAccount.value?.running)
    return '账号未启动'
  if (!status.value?.connection?.connected)
    return '账号离线'
  return realtimeConnected.value ? '实时在线' : '在线'
})

const blacklistSet = computed(() => new Set(blacklist.value.map(item => Number(item.gid))))
const visibleResults = computed(() => sortRadarResults(Object.values(radarResults.value)))
const selectedFriend = computed(() => visibleResults.value.find(item => item.gid === selectedGid.value) || null)
const scannedCount = computed(() => visibleResults.value.filter(item => item.scanned).length)
const stealableFriendCount = computed(() => visibleResults.value.filter(item => item.stealableLandCount > 0 && !item.blacklisted).length)
const totalStealableLands = computed(() => visibleResults.value.reduce((sum, item) => sum + (item.blacklisted ? 0 : item.stealableLandCount), 0))
const nearMatureFriendCount = computed(() => visibleResults.value.filter(item => item.nearMatureLandCount > 0 && !item.blacklisted).length)

const emptyDescription = computed(() => {
  if (!currentAccountId.value)
    return '请先选择账号'
  if (!canScan.value)
    return '请先启动账号并保持连接'
  if (scanning.value)
    return '正在扫描好友农场'
  return '暂无雷达结果，点击上方按钮开始扫描'
})

const gradeWeight: Record<RadarGrade, number> = { S: 4, A: 3, B: 2, C: 1 }

const recommendationText: Record<RadarRecommendation, string> = {
  steal_now: '立即偷菜',
  wait: '等待成熟',
  skip: '暂时跳过',
  retry: '重试扫描',
}

const reportStatusOptions = [
  { label: '全部结果', value: 'all' },
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failed' },
]

const reportSourceOptions = [
  { label: '全部来源', value: 'all' },
  { label: '手动', value: 'manual' },
  { label: '自动', value: 'auto' },
  { label: '雷达', value: 'radar' },
]

function getStealableLandCount(lands: any[]) {
  return lands.filter((land: any) => land?.unlocked && land.status === 'stealable').length
}

function getNearMatureLands(lands: any[]) {
  return lands.filter((land: any) => {
    const matureInSec = Number(land?.matureInSec)
    return land?.unlocked && Number.isFinite(matureInSec) && matureInSec > 0 && matureInSec <= NEAR_MATURE_SECONDS
  })
}

function getFastestMatureInSec(lands: any[]) {
  const values = lands
    .map((land: any) => Number(land?.matureInSec))
    .filter((value: number) => Number.isFinite(value) && value > 0)
  return values.length > 0 ? Math.min(...values) : null
}

function getRadarGrade(score: number, stealableLandCount: number, nearMatureLandCount: number): RadarGrade {
  if (stealableLandCount > 0 && score >= 300)
    return 'S'
  if (stealableLandCount > 0 && score >= 120)
    return 'A'
  if (stealableLandCount === 0 && nearMatureLandCount > 0)
    return 'B'
  return 'C'
}

function getRecommendation(result: Pick<FriendRadarResult, 'error' | 'stealableLandCount' | 'nearMatureLandCount'>): RadarRecommendation {
  if (result.error)
    return 'retry'
  if (result.stealableLandCount > 0)
    return 'steal_now'
  if (result.nearMatureLandCount > 0)
    return 'wait'
  return 'skip'
}

function getFriendName(friend: any) {
  return String(friend?.remark || friend?.name || friend?.gid || '未知好友')
}

function getFriendAvatar(friend: any) {
  const direct = String(friend?.avatarUrl || friend?.avatar_url || '').trim()
  if (direct)
    return direct
  const uin = String(friend?.uin || '').trim()
  return uin ? `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=100` : ''
}

function buildRadarResult(friend: any, lands: any[], blacklisted: boolean): FriendRadarResult {
  const safeLands = Array.isArray(lands) ? lands : []
  const stealableLandCount = getStealableLandCount(safeLands)
  const nearMatureLandCount = getNearMatureLands(safeLands).length
  const fastestMatureInSec = getFastestMatureInSec(safeLands)
  const level = Number(friend?.level || 0)
  const score = stealableLandCount * 100 + nearMatureLandCount * 30 + level * 2 - (blacklisted ? BLACKLIST_PENALTY : 0)
  const grade = getRadarGrade(score, stealableLandCount, nearMatureLandCount)
  const base: FriendRadarResult = {
    gid: String(friend?.gid || ''),
    name: getFriendName(friend),
    avatarUrl: getFriendAvatar(friend),
    level,
    blacklisted,
    scanned: true,
    scanning: false,
    error: '',
    stealableLandCount,
    nearMatureLandCount,
    fastestMatureInSec,
    score,
    grade,
    recommendation: 'skip',
    lands: safeLands,
  }
  return {
    ...base,
    recommendation: getRecommendation(base),
  }
}

function sortRadarResults(list: FriendRadarResult[]) {
  return [...list].sort((a, b) => {
    if (a.blacklisted !== b.blacklisted)
      return a.blacklisted ? 1 : -1
    if (gradeWeight[a.grade] !== gradeWeight[b.grade])
      return gradeWeight[b.grade] - gradeWeight[a.grade]
    if (a.score !== b.score)
      return b.score - a.score
    const aMature = a.fastestMatureInSec ?? Number.MAX_SAFE_INTEGER
    const bMature = b.fastestMatureInSec ?? Number.MAX_SAFE_INTEGER
    if (aMature !== bMature)
      return aMature - bMature
    return b.level - a.level
  })
}

function formatCountdown(seconds: number | null) {
  if (seconds === null)
    return '-'
  const safe = Math.max(0, Math.floor(seconds))
  const min = Math.floor(safe / 60)
  const sec = safe % 60
  if (min >= 60) {
    const hour = Math.floor(min / 60)
    const restMin = min % 60
    return `${hour}小时${restMin}分`
  }
  return `${min}分${String(sec).padStart(2, '0')}秒`
}

function formatDateTime(value: string) {
  if (!value)
    return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function nextScanDelay() {
  return 300 + Math.floor(Math.random() * 301)
}

async function loadRadarBaseData(forceSync = false) {
  if (!currentAccountId.value)
    return
  pageError.value = ''
  try {
    await statusStore.fetchStatus(currentAccountId.value)
    await friendStore.fetchFriends(currentAccountId.value, forceSync)
    await friendStore.fetchBlacklist(currentAccountId.value)
  }
  catch (e: any) {
    pageError.value = e?.response?.data?.error || e?.message || '加载好友雷达数据失败'
  }
}

async function scanFriend(friend: any) {
  if (!currentAccountId.value)
    return
  const gid = String(friend?.gid || '')
  if (!gid)
    return

  radarResults.value[gid] = {
    gid,
    name: getFriendName(friend),
    avatarUrl: getFriendAvatar(friend),
    level: Number(friend?.level || 0),
    blacklisted: blacklistSet.value.has(Number(gid)),
    scanned: false,
    scanning: true,
    error: '',
    stealableLandCount: 0,
    nearMatureLandCount: 0,
    fastestMatureInSec: null,
    score: 0,
    grade: 'C',
    recommendation: 'skip',
  }

  try {
    await friendStore.fetchFriendLands(currentAccountId.value, gid)
    const lands = friendLands.value[gid] || []
    radarResults.value[gid] = buildRadarResult(friend, lands, blacklistSet.value.has(Number(gid)))
    if (!selectedGid.value)
      selectedGid.value = gid
  }
  catch (e: any) {
    radarResults.value[gid] = {
      ...radarResults.value[gid],
      scanned: true,
      scanning: false,
      error: e?.response?.data?.error || e?.message || '扫描失败',
      recommendation: 'retry',
    }
  }
}

async function startScan(limit: number, mode: ScanMode = 'reset') {
  if (!canScan.value) {
    toast.warning('请先启动账号并保持连接')
    return
  }
  if (scanning.value)
    return

  if (friends.value.length === 0)
    await loadRadarBaseData()

  if (friends.value.length === 0) {
    toast.warning('暂无好友数据，请先刷新好友列表')
    return
  }

  if (mode === 'reset') {
    radarResults.value = {}
    scanCursor.value = 0
    selectedGid.value = ''
  }

  const runId = scanRunId.value + 1
  scanRunId.value = runId
  const startIndex = mode === 'continue' ? scanCursor.value : 0
  const endIndex = Math.min(friends.value.length, startIndex + Math.max(1, limit))
  scanTargetCount.value = endIndex
  scanning.value = true
  stopping.value = false

  try {
    for (let index = startIndex; index < endIndex; index++) {
      if (stopping.value || scanRunId.value !== runId)
        break
      const friend = friends.value[index]
      activeFriendName.value = getFriendName(friend)
      await scanFriend(friend)
      scanCursor.value = index + 1
      if (index < endIndex - 1)
        await sleep(nextScanDelay())
    }
  }
  finally {
    if (scanRunId.value === runId) {
      activeFriendName.value = ''
      scanning.value = false
      stopping.value = false
    }
  }
}

function stopScan() {
  stopping.value = true
  scanRunId.value += 1
}

async function refreshFriends() {
  if (!currentAccountId.value)
    return
  await loadRadarBaseData(true)
  toast.success('好友列表已刷新')
}

async function retryFriend(result: FriendRadarResult) {
  const friend = friends.value.find(item => String(item?.gid || '') === result.gid)
  if (!friend) {
    toast.warning('没有找到这个好友，请刷新好友列表')
    return
  }
  await scanFriend(friend)
}

async function stealFriend(result: FriendRadarResult) {
  if (!currentAccountId.value)
    return
  const response = await friendStore.operate(currentAccountId.value, result.gid, 'steal')
  if (response?.ok === false) {
    toast.error(response.message || '偷菜失败')
    await reloadReports()
    return
  }
  toast.success(response?.message || '偷菜操作已执行')
  await retryFriend(result)
  await reloadReports()
}

async function selectFriend(result: FriendRadarResult) {
  selectedGid.value = result.gid
  if (!result.lands || result.lands.length === 0)
    await retryFriend(result)
  if (isCompactViewport.value)
    detailDrawerVisible.value = true
}

function getDisplayLands(result: FriendRadarResult | null) {
  const lands = Array.isArray(result?.lands) ? result.lands : []
  return [...lands].sort((a: any, b: any) => {
    const aStealable = a?.status === 'stealable' ? 1 : 0
    const bStealable = b?.status === 'stealable' ? 1 : 0
    if (aStealable !== bStealable)
      return bStealable - aStealable
    const aMature = Number(a?.matureInSec) || Number.MAX_SAFE_INTEGER
    const bMature = Number(b?.matureInSec) || Number.MAX_SAFE_INTEGER
    if (aMature !== bMature)
      return aMature - bMature
    return (Number(a?.id) || 0) - (Number(b?.id) || 0)
  })
}

async function reloadReports() {
  if (!currentAccountId.value)
    return
  const params: Record<string, any> = { page: 1, pageSize: 80 }
  if (reportStatus.value !== 'all')
    params.status = reportStatus.value
  if (reportSource.value !== 'all')
    params.source = reportSource.value
  await friendStore.fetchStealReports(currentAccountId.value, params)
}

async function reloadRanking() {
  if (!currentAccountId.value)
    return
  await friendStore.fetchFriendValueRanking(currentAccountId.value, {
    days: rankingDays.value,
    page: 1,
    pageSize: 80,
  })
}

function reportResultText(report: any) {
  return report?.success ? '成功' : '失败'
}

function sourceText(source: string) {
  if (source === 'manual')
    return '手动'
  if (source === 'auto')
    return '自动'
  if (source === 'radar')
    return '雷达'
  return source || '-'
}

onMounted(async () => {
  await loadRadarBaseData()
  await Promise.all([reloadReports(), reloadRanking()])
  if (canScan.value)
    void startScan(DEFAULT_SCAN_LIMIT, 'reset')
})

watch(currentAccountId, async () => {
  stopScan()
  radarResults.value = {}
  scanCursor.value = 0
  selectedGid.value = ''
  await loadRadarBaseData()
  await Promise.all([reloadReports(), reloadRanking()])
  if (canScan.value)
    void startScan(DEFAULT_SCAN_LIMIT, 'reset')
})

watch([reportStatus, reportSource], () => {
  void reloadReports()
})

watch(rankingDays, () => {
  void reloadRanking()
})

watch(activeTab, (tab) => {
  if (tab === 'reports')
    void reloadReports()
  if (tab === 'ranking')
    void reloadRanking()
})

onBeforeUnmount(() => {
  stopScan()
})

useIntervalFn(() => {
  for (const gid of Object.keys(radarResults.value)) {
    const item = radarResults.value[gid]
    if (!item)
      continue

    let shouldRefresh = false
    const nextLands = Array.isArray(item.lands)
      ? item.lands.map((land: any) => {
          if (land.matureInSec <= 0)
            return land
          const nextMatureInSec = Math.max(0, land.matureInSec - 1)
          if (nextMatureInSec === 0)
            shouldRefresh = true
          return { ...land, matureInSec: nextMatureInSec }
        })
      : item.lands

    const nextFastestMatureInSec = item.fastestMatureInSec !== null && item.fastestMatureInSec > 0
      ? Math.max(0, item.fastestMatureInSec - 1)
      : item.fastestMatureInSec

    if (item.fastestMatureInSec !== null && item.fastestMatureInSec > 0 && nextFastestMatureInSec === 0)
      shouldRefresh = true

    radarResults.value[gid] = {
      ...item,
      fastestMatureInSec: nextFastestMatureInSec,
      lands: nextLands,
    }

    if (shouldRefresh && !refreshingMatureGids.has(gid)) {
      refreshingMatureGids.add(gid)
      void retryFriend(radarResults.value[gid]).finally(() => refreshingMatureGids.delete(gid))
    }
  }
}, 1000)
</script>

<template>
  <section class="friend-radar-page">
    <div class="radar-metrics">
      <div class="radar-metric">
        <span>已扫描</span>
        <strong>{{ scannedCount }} / {{ friends.length }}</strong>
      </div>
      <div class="radar-metric">
        <span>可偷好友</span>
        <strong>{{ stealableFriendCount }}</strong>
      </div>
      <div class="radar-metric">
        <span>可偷土地</span>
        <strong>{{ totalStealableLands }}</strong>
      </div>
      <div class="radar-metric">
        <span>快成熟</span>
        <strong>{{ nearMatureFriendCount }}</strong>
      </div>
      <div class="radar-metric">
        <span>连接</span>
        <strong>{{ connectionText }}</strong>
      </div>
    </div>

    <ElTabs v-model="activeTab" class="radar-tabs">
      <ElTabPane label="偷菜雷达" name="radar">
        <div class="radar-toolbar">
          <div class="radar-actions">
            <ElButton :loading="scanning" :disabled="scanning || !canScan" @click="startScan(20, 'reset')">
              <span class="i-carbon-search mr-1" />
              扫描前 20
            </ElButton>
            <ElButton :disabled="scanning || !canScan" @click="startScan(50, 'reset')">
              扫描前 50
            </ElButton>
            <ElButton :disabled="scanning || !canScan || scanCursor >= friends.length" @click="startScan(20, 'continue')">
              继续 20
            </ElButton>
            <ElButton :disabled="scanning || !canScan" @click="startScan(friends.length, 'reset')">
              全量扫描
            </ElButton>
            <ElButton v-if="scanning" type="danger" plain @click="stopScan">
              停止
            </ElButton>
            <ElButton :loading="friendsLoading" :disabled="scanning || !currentAccountId" @click="refreshFriends">
              <span class="i-carbon-renew mr-1" />
              刷新好友
            </ElButton>
          </div>
          <p v-if="scanning" class="radar-progress">
            正在扫描：{{ activeFriendName || '好友' }}，进度 {{ scanCursor }} / {{ scanTargetCount }}
          </p>
          <p v-else class="radar-progress">
            排序规则：可偷优先，其次快成熟、评分高、非黑名单好友优先。
          </p>
        </div>

        <ElAlert v-if="pageError" :title="pageError" type="error" show-icon :closable="false" />

        <ElEmpty v-if="visibleResults.length === 0" :description="emptyDescription" />

        <div v-else class="radar-workbench">
          <div class="radar-table">
            <button
              v-for="item in visibleResults"
              :key="item.gid"
              type="button"
              class="radar-row"
              :class="{ 'is-selected': selectedGid === item.gid, 'is-muted': item.blacklisted }"
              @click="selectFriend(item)"
            >
              <span class="friend-name">
                <img v-if="item.avatarUrl" :src="item.avatarUrl" alt="" loading="lazy">
                <span v-else class="avatar-fallback i-carbon-user" />
                <span>
                  <strong>{{ item.name }}</strong>
                  <small>Lv{{ item.level }} / {{ item.gid }}</small>
                </span>
              </span>
              <span class="grade-pill" :class="`grade-${item.grade.toLowerCase()}`">{{ item.grade }}</span>
              <span class="metric-cell"><small>可偷</small>{{ item.stealableLandCount }}</span>
              <span class="metric-cell"><small>快熟</small>{{ item.nearMatureLandCount }}</span>
              <span class="metric-cell"><small>倒计时</small>{{ formatCountdown(item.fastestMatureInSec) }}</span>
              <span class="metric-cell"><small>评分</small>{{ item.score }}</span>
              <span class="row-state">
                <ElTag v-if="item.blacklisted" type="danger" size="small">黑名单</ElTag>
                <ElTag v-else-if="item.error" type="warning" size="small">失败</ElTag>
                <ElTag v-else-if="item.scanning" type="info" size="small">扫描中</ElTag>
                <ElTag v-else-if="item.stealableLandCount > 0" type="success" size="small">可偷</ElTag>
                <ElTag v-else-if="item.nearMatureLandCount > 0" type="info" size="small">快成熟</ElTag>
                <ElTag v-else size="small">暂无价值</ElTag>
              </span>
            </button>
          </div>

          <aside class="radar-detail-desktop">
            <div v-if="selectedFriend" class="detail-panel">
              <div class="detail-head">
                <div>
                  <h3>{{ selectedFriend.name }}</h3>
                  <p>Lv{{ selectedFriend.level }} / GID {{ selectedFriend.gid }}</p>
                </div>
                <span class="grade-pill" :class="`grade-${selectedFriend.grade.toLowerCase()}`">{{ selectedFriend.grade }}</span>
              </div>
              <div class="detail-actions">
                <ElButton size="small" :loading="friendLandsLoading[selectedFriend.gid]" @click="retryFriend(selectedFriend)">
                  刷新土地
                </ElButton>
                <ElButton size="small" type="success" :disabled="selectedFriend.stealableLandCount === 0 || selectedFriend.blacklisted" @click="stealFriend(selectedFriend)">
                  立即偷菜
                </ElButton>
              </div>
              <div class="detail-summary">
                <span>建议：{{ recommendationText[selectedFriend.recommendation] }}</span>
                <span>可偷 {{ selectedFriend.stealableLandCount }} 块</span>
                <span>快成熟 {{ selectedFriend.nearMatureLandCount }} 块</span>
              </div>
              <div v-if="friendLandsLoading[selectedFriend.gid]" class="panel-empty">正在加载土地详情</div>
              <div v-else-if="getDisplayLands(selectedFriend).length > 0" class="land-grid">
                <LandCard v-for="land in getDisplayLands(selectedFriend)" :key="land.id" :land="land" />
              </div>
              <div v-else class="panel-empty">暂无土地详情</div>
            </div>
            <div v-else class="panel-empty">点击左侧好友查看土地详情</div>
          </aside>
        </div>
      </ElTabPane>

      <ElTabPane label="偷菜战报" name="reports">
        <div class="report-toolbar">
          <ElSelect v-model="reportStatus" size="small" class="filter-select">
            <ElOption v-for="item in reportStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
          <ElSelect v-model="reportSource" size="small" class="filter-select">
            <ElOption v-for="item in reportSourceOptions" :key="item.value" :label="item.label" :value="item.value" />
          </ElSelect>
          <ElButton size="small" :loading="stealReportsLoading" @click="reloadReports">
            刷新战报
          </ElButton>
        </div>
        <ElTable v-loading="stealReportsLoading" :data="stealReports" border stripe class="compact-table" height="100%">
          <ElTableColumn prop="createdAt" label="时间" min-width="170">
            <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
          </ElTableColumn>
          <ElTableColumn label="好友" min-width="150">
            <template #default="{ row }">{{ row.friendName || row.friendGid }}</template>
          </ElTableColumn>
          <ElTableColumn label="来源" width="80">
            <template #default="{ row }">{{ sourceText(row.source) }}</template>
          </ElTableColumn>
          <ElTableColumn label="结果" width="80">
            <template #default="{ row }">
              <ElTag :type="row.success ? 'success' : 'danger'" size="small">{{ reportResultText(row) }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="plantName" label="作物" min-width="120" />
          <ElTableColumn prop="landId" label="土地" width="80" />
          <ElTableColumn prop="gold" label="金币" width="90" />
          <ElTableColumn prop="exp" label="经验" width="90" />
          <ElTableColumn prop="reason" label="失败原因" min-width="180" />
        </ElTable>
      </ElTabPane>

      <ElTabPane label="好友价值榜" name="ranking">
        <div class="report-toolbar">
          <ElSegmented v-model="rankingDays" :options="[{ label: '7 天', value: 7 }, { label: '30 天', value: 30 }, { label: '90 天', value: 90 }]" />
          <ElButton size="small" :loading="friendValueRankingLoading" @click="reloadRanking">
            刷新榜单
          </ElButton>
        </div>
        <ElTable v-loading="friendValueRankingLoading" :data="friendValueRanking" border stripe class="compact-table" height="100%">
          <ElTableColumn type="index" label="排名" width="70" />
          <ElTableColumn label="好友" min-width="150">
            <template #default="{ row }">{{ row.friendName || row.friendGid }}</template>
          </ElTableColumn>
          <ElTableColumn prop="score" label="综合分" width="100" />
          <ElTableColumn prop="successCount" label="成功" width="90" />
          <ElTableColumn prop="successLandCount" label="土地" width="90" />
          <ElTableColumn prop="failedCount" label="失败" width="90" />
          <ElTableColumn prop="gold" label="金币" width="90" />
          <ElTableColumn prop="exp" label="经验" width="90" />
          <ElTableColumn label="最近成功" min-width="170">
            <template #default="{ row }">{{ formatDateTime(row.lastSuccessAt) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="recommendation" label="建议" min-width="120" />
        </ElTable>
      </ElTabPane>
    </ElTabs>

    <ElDrawer v-model="detailDrawerVisible" title="好友土地详情" size="92%">
      <div v-if="selectedFriend" class="detail-panel detail-panel--drawer">
        <div class="detail-head">
          <div>
            <h3>{{ selectedFriend.name }}</h3>
            <p>Lv{{ selectedFriend.level }} / GID {{ selectedFriend.gid }}</p>
          </div>
          <span class="grade-pill" :class="`grade-${selectedFriend.grade.toLowerCase()}`">{{ selectedFriend.grade }}</span>
        </div>
        <div class="detail-actions">
          <ElButton size="small" :loading="friendLandsLoading[selectedFriend.gid]" @click="retryFriend(selectedFriend)">
            刷新土地
          </ElButton>
          <ElButton size="small" type="success" :disabled="selectedFriend.stealableLandCount === 0 || selectedFriend.blacklisted" @click="stealFriend(selectedFriend)">
            立即偷菜
          </ElButton>
        </div>
        <div class="land-grid">
          <LandCard v-for="land in getDisplayLands(selectedFriend)" :key="land.id" :land="land" />
        </div>
      </div>
    </ElDrawer>
  </section>
</template>

<style scoped>
.friend-radar-page {
  height: calc(100vh - 96px);
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 12px;
}

.radar-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.radar-metric {
  min-height: 68px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: var(--theme-surface);
  padding: 10px 12px;
  box-shadow: var(--theme-shadow-sm);
}

.radar-metric span {
  display: block;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.radar-metric strong {
  display: block;
  overflow: hidden;
  margin-top: 5px;
  color: var(--theme-text);
  font-size: 18px;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.radar-tabs {
  min-height: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: var(--theme-surface);
  padding: 0 12px 12px;
}

.radar-tabs :deep(.el-tabs__content) {
  min-height: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  overflow: hidden;
}

.radar-tabs :deep(.el-tab-pane) {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.radar-toolbar,
.report-toolbar {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.radar-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.radar-actions :deep(.el-button),
.report-toolbar :deep(.el-button) {
  margin-left: 0;
}

.radar-progress {
  width: 100%;
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 13px;
}

.radar-workbench {
  height: calc(100dvh - 245px);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  grid-template-rows: minmax(0, 1fr);
  gap: 10px;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.radar-table {
  height: 100%;
  max-height: 100%;
  overflow-x: auto;
  overflow-y: auto;
  min-height: 0;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
}

.radar-detail-desktop {
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.radar-row {
  width: 100%;
  min-height: 52px;
  display: grid;
  grid-template-columns: minmax(190px, 1.4fr) 44px repeat(4, minmax(72px, 0.5fr)) minmax(90px, 0.7fr);
  align-items: center;
  gap: 8px;
  border: 0;
  border-bottom: 1px solid var(--theme-border);
  background: var(--theme-surface);
  color: var(--theme-text);
  cursor: pointer;
  padding: 7px 10px;
  text-align: left;
}

.radar-row:last-child {
  border-bottom: 0;
}

.radar-row:hover,
.radar-row.is-selected {
  background: var(--theme-surface-soft);
}

.radar-row.is-muted {
  opacity: 0.66;
}

.friend-name {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.friend-name img,
.avatar-fallback {
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  object-fit: cover;
}

.avatar-fallback {
  display: grid;
  place-items: center;
  background: var(--theme-primary-soft);
  color: var(--theme-primary);
}

.friend-name strong,
.friend-name small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.friend-name strong {
  font-size: 13px;
}

.friend-name small,
.metric-cell small {
  color: var(--theme-text-muted);
  font-size: 11px;
}

.grade-pill {
  width: 32px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 800;
}

.grade-s {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.grade-a {
  border-color: #fed7aa;
  background: #fff7ed;
  color: #c2410c;
}

.grade-b {
  border-color: #bae6fd;
  background: #f0f9ff;
  color: #0369a1;
}

.grade-c {
  border-color: var(--theme-border);
  background: var(--theme-surface-soft);
  color: var(--theme-text-muted);
}

.metric-cell {
  min-width: 0;
  display: grid;
  gap: 1px;
  font-size: 13px;
  font-weight: 700;
}

.row-state {
  display: flex;
  justify-content: flex-start;
}

.detail-panel {
  height: 100%;
  max-height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: var(--theme-surface);
  padding: 12px;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.detail-head h3 {
  margin: 0;
  color: var(--theme-text);
  font-size: 16px;
}

.detail-head p {
  margin: 4px 0 0;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.detail-actions,
.detail-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.detail-summary span {
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  background: var(--theme-surface-soft);
  padding: 5px 8px;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.land-grid {
  min-height: 0;
  max-height: 100%;
  flex: 1 1 auto;
  display: grid;
  align-content: start;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  margin-top: 10px;
  overflow-y: auto;
  padding-right: 2px;
}

.land-grid :deep(.land-card) {
  min-height: 132px;
  border-radius: 6px;
  box-shadow: none;
}

.land-grid :deep(.land-card__footer) {
  display: none;
}

.panel-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  border: 1px dashed var(--theme-border);
  border-radius: 8px;
  color: var(--theme-text-muted);
  font-size: 13px;
}

.filter-select {
  width: 132px;
}

.compact-table {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

@media (max-width: 1180px) {
  .radar-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .radar-workbench {
    height: calc(100dvh - 245px);
    grid-template-columns: 1fr;
  }

  .radar-detail-desktop {
    display: none;
  }

  .radar-row {
    grid-template-columns: minmax(180px, 1fr) 42px repeat(2, minmax(58px, 0.5fr)) minmax(72px, 0.6fr);
  }

  .radar-row .metric-cell:nth-of-type(5),
  .radar-row .row-state {
    display: none;
  }
}

@media (max-width: 640px) {
  .friend-radar-page {
    height: calc(100dvh - 76px);
    padding: 10px;
  }

  .radar-metrics {
    grid-template-columns: 1fr 1fr;
  }

  .radar-row {
    grid-template-columns: minmax(150px, 1fr) 38px 52px 62px;
  }

  .radar-workbench {
    height: calc(100dvh - 235px);
  }

  .radar-row .metric-cell:nth-of-type(4),
  .radar-row .metric-cell:nth-of-type(5),
  .radar-row .metric-cell:nth-of-type(6),
  .radar-row .row-state {
    display: none;
  }
}
</style>
