<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { ElMessageBox } from 'element-plus'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/api'
import LandCard from '@/components/LandCard.vue'
import { useAccountStore } from '@/stores/account'
import { useFriendStore } from '@/stores/friend'
import { useStatusStore } from '@/stores/status'
import { useToastStore } from '@/stores/toast'

const accountStore = useAccountStore()
const friendStore = useFriendStore()
const statusStore = useStatusStore()
const toast = useToastStore()
const { currentAccountId, currentAccount } = storeToRefs(accountStore)
const {
  friends,
  loading,
  friendLands,
  friendLandsLoading,
  blacklist,
  interactRecords,
  interactLoading,
  interactError,
  knownFriendGids,
  knownFriendGidSyncCooldownSec,
  friendsListCacheTtlSec,
  knownFriendSettingsLoading,
  knownFriendSettingsSaving,
} = storeToRefs(friendStore)
const { status, loading: statusLoading, realtimeConnected } = storeToRefs(statusStore)

const isQqAccount = computed(() => {
  const acc = currentAccount.value
  if (!acc)
    return false
  const platform = String(acc.platform || 'qq').toLowerCase()
  return platform === 'qq'
})

const knownFriendGidCount = computed(() => knownFriendGids.value.length)
const knownFriendGidSet = computed(() => new Set(knownFriendGids.value.map(Number)))
const friendGidSet = computed(() => new Set(friends.value.map(f => Number(f.gid))))
const blacklistGidSet = computed(() => new Set(blacklist.value.map(item => Number(item.gid))))
const showGidListModal = ref(false)
const gidSearchKeyword = ref('')

const filteredKnownFriendGids = computed(() => {
  const keyword = gidSearchKeyword.value.trim().toLowerCase()
  const list = knownFriendGids.value.map(gid => ({
    gid: Number(gid),
    synced: friendGidSet.value.has(Number(gid)),
  }))
  if (!keyword)
    return list
  return list.filter(item => String(item.gid).includes(keyword))
})

const syncedGidCount = computed(() => filteredKnownFriendGids.value.filter(item => item.synced).length)
const unsyncedGidCount = computed(() => filteredKnownFriendGids.value.filter(item => !item.synced).length)

async function handleRemoveGidFromList(gid: number) {
  if (!currentAccountId.value)
    return
  await friendStore.removeKnownFriendGid(currentAccountId.value, gid)
}

async function handleRemoveUnsyncedGids() {
  if (!currentAccountId.value)
    return
  const unsyncedGids = filteredKnownFriendGids.value.filter(item => !item.synced).map(item => item.gid)
  if (unsyncedGids.length === 0) {
    toast.info('没有需要删除的未同步 GID')
    return
  }
  const result = await friendStore.removeUnsyncedKnownFriendGids(currentAccountId.value, unsyncedGids)
  if (result.ok && result.removedCount > 0) {
    toast.success(`已删除 ${result.removedCount} 个未同步的 GID`)
  }
}

function openGidListModal() {
  gidSearchKeyword.value = ''
  showGidListModal.value = true
}

const TABS = [
  { key: 'friends', label: '好友列表', icon: 'i-carbon-user-multiple' },
  { key: 'blacklist', label: '好友黑名单', icon: 'i-carbon-warning' },
  { key: 'visitors', label: '最近访客', icon: 'i-carbon-view' },
] as const

type TabKey = typeof TABS[number]['key']

const activeTab = ref<TabKey>('friends')

const avatarErrorKeys = ref<Set<string>>(new Set())
const searchKeyword = ref('')
const localKnownFriendGidSyncCooldownSec = ref(300)
const localFriendsListCacheTtlSec = ref(60)
const showBatchAddGidModal = ref(false)
const batchGidInput = ref('')

const interactFilter = ref('all')
const interactFilters = [
  { key: 'all', label: '全部' },
  { key: 'steal', label: '偷菜' },
  { key: 'help', label: '帮忙' },
  { key: 'bad', label: '捣乱' },
]

async function confirmAction(message: string, action: () => Promise<any>, type: 'warning' | 'error' = 'warning') {
  try {
    await ElMessageBox.confirm(message, '确认操作', {
      type,
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      closeOnClickModal: false,
      closeOnPressEscape: true,
      distinguishCancelAndClose: true,
      customClass: 'admin-confirm-dialog',
    })
    await action()
  }
  catch (e: any) {
    if (e === 'cancel' || e === 'close')
      return
    toast.error(e?.message || '操作失败')
  }
}

const selectedFriendId = ref('')
const currentPage = ref(1)
const pageSize = 25

const sortedFriends = computed(() => {
  return [...friends.value].sort((a: any, b: any) => {
    const levelA = Number(a?.level || 0)
    const levelB = Number(b?.level || 0)
    return levelB - levelA
  })
})

const filteredFriends = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const list = sortedFriends.value
  if (!keyword)
    return list

  return list.filter((friend: any) => {
    const name = String(friend?.name || '').toLowerCase()
    const gid = String(friend?.gid || '')
    const uin = String(friend?.uin || '')
    return name.includes(keyword) || gid.includes(keyword) || uin.includes(keyword)
  })
})

const totalPages = computed(() => Math.ceil(filteredFriends.value.length / pageSize) || 1)

const paginatedFriends = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredFriends.value.slice(start, end)
})

const selectedFriend = computed(() => {
  if (!selectedFriendId.value)
    return paginatedFriends.value[0] || filteredFriends.value[0] || null
  return filteredFriends.value.find((friend: any) => String(friend.gid) === selectedFriendId.value) || paginatedFriends.value[0] || null
})

const selectedFriendKey = computed(() => selectedFriend.value ? String(selectedFriend.value.gid) : '')

function goToPage(page: number) {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

watch(searchKeyword, () => {
  currentPage.value = 1
})

function selectFriend(friendId: string | number) {
  const key = String(friendId)
  selectedFriendId.value = key
  if (currentAccountId.value && currentAccount.value?.running && status.value?.connection?.connected)
    friendStore.fetchFriendLands(currentAccountId.value, key)
}

watch(paginatedFriends, (list) => {
  if (list.length === 0) {
    selectedFriendId.value = ''
    return
  }
  const existsOnPage = list.some((friend: any) => String(friend.gid) === selectedFriendId.value)
  if (!selectedFriendId.value || !existsOnPage)
    selectFriend(list[0].gid)
}, { immediate: true })

const filteredInteractRecords = computed(() => {
  if (interactFilter.value === 'all')
    return interactRecords.value

  const actionTypeMap: Record<string, number> = {
    steal: 1,
    help: 2,
    bad: 3,
  }
  const targetActionType = actionTypeMap[interactFilter.value] || 0
  return interactRecords.value.filter((record: any) => Number(record?.actionType) === targetActionType)
})

const visibleInteractRecords = computed(() => filteredInteractRecords.value.slice(0, 50))

async function loadData() {
  if (currentAccountId.value) {
    const acc = currentAccount.value
    if (!acc)
      return

    if (!realtimeConnected.value) {
      await statusStore.fetchStatus(currentAccountId.value)
    }

    if (acc.running && status.value?.connection?.connected) {
      avatarErrorKeys.value.clear()
      friendStore.fetchFriends(currentAccountId.value)
      friendStore.fetchBlacklist(currentAccountId.value)
      friendStore.fetchInteractRecords(currentAccountId.value)
      if (isQqAccount.value) {
        friendStore.fetchKnownFriendSettings(currentAccountId.value)
      }
    }
  }
}

useIntervalFn(() => {
  for (const gid in friendLands.value) {
    if (friendLands.value[gid]) {
      friendLands.value[gid] = friendLands.value[gid].map((l: any) =>
        l.matureInSec > 0 ? { ...l, matureInSec: l.matureInSec - 1 } : l,
      )
    }
  }
}, 1000)

onMounted(() => {
  loadData()
})

watch(currentAccountId, () => {
  selectedFriendId.value = ''
  loadData()
})

async function handleRefreshFriends() {
  if (!currentAccountId.value)
    return
  try {
    await api.post('/api/friends/clear-cache', {}, {
      headers: { 'x-account-id': currentAccountId.value },
    })
  }
  catch {
    // ignore
  }
  await friendStore.fetchFriends(currentAccountId.value, true)
}

async function handleOp(friendId: string, type: string, e: Event) {
  e.stopPropagation()
  if (!currentAccountId.value)
    return

  const opNames: Record<string, string> = {
    steal: '偷取',
    farming: '一键务农',
    bad: '捣乱',
  }

  if (type === 'bad') {
    await confirmAction('确定对好友执行捣乱操作吗?', async () => {
      toast.info('已在捣乱中，间隔较长，请稍后返回好友土地查看')
      friendStore.operate(currentAccountId.value!, friendId, type)
      return { ok: true }
    }, 'error')
  }
  else {
    await confirmAction(`确定对好友执行${opNames[type] || type}操作吗?`, async () => {
      const result = await friendStore.operate(currentAccountId.value!, friendId, type)
      if (result?.ok) {
        toast.success(result.message || `${opNames[type] || type}完成`)
      }
      else {
        toast.error(result?.message || `${opNames[type] || type}失败`)
      }
      return result
    })
  }
}

async function handleToggleBlacklist(friend: any, e: Event) {
  e.stopPropagation()
  if (!currentAccountId.value)
    return
  const gid = Number(friend.gid)
  const isBlocked = blacklistGidSet.value.has(gid)
  if (!isBlocked) {
    await friendStore.toggleBlacklist(currentAccountId.value, gid)
    return
  }
  const name = String(friend?.name || `GID ${gid}`).trim()
  await confirmAction(`确定将 ${name} 移出黑名单吗？`, async () => {
    await friendStore.toggleBlacklist(currentAccountId.value!, gid)
    toast.success(`已移出黑名单: ${name}`)
  })
}

function getFriendStatusText(friend: any) {
  const p = friend.plant || {}
  const info = []
  if (p.stealNum)
    info.push(`偷${p.stealNum}`)
  if (p.dryNum)
    info.push(`水${p.dryNum}`)
  if (p.weedNum)
    info.push(`草${p.weedNum}`)
  if (p.insectNum)
    info.push(`虫${p.insectNum}`)
  return info.length ? info.join(' ') : '无操作'
}

function getFriendLevel(friend: any) {
  const level = Number.parseInt(String(friend?.level ?? ''), 10)
  if (!Number.isFinite(level) || level <= 0)
    return 0
  return level
}

function getFriendGold(friend: any) {
  const gold = Number.parseInt(String(friend?.gold ?? ''), 10)
  if (!Number.isFinite(gold) || gold < 0)
    return 0
  return gold
}

function formatFriendGold(value: unknown) {
  const gold = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(gold) || gold < 0)
    return '0'
  return gold.toLocaleString('zh-CN')
}

function getFriendAvatar(friend: any) {
  const direct = String(friend?.avatarUrl || friend?.avatar_url || '').trim()
  if (direct)
    return direct
  const uin = String(friend?.uin || '').trim()
  if (uin)
    return `https://q1.qlogo.cn/g?b=qq&nk=${uin}&s=100`
  return ''
}

function getFriendAvatarKey(friend: any) {
  const key = String(friend?.gid || friend?.uin || '').trim()
  return key || String(friend?.name || '').trim()
}

function canShowFriendAvatar(friend: any) {
  const key = getFriendAvatarKey(friend)
  if (!key)
    return false
  return !!getFriendAvatar(friend) && !avatarErrorKeys.value.has(key)
}

function handleFriendAvatarError(friend: any) {
  const key = getFriendAvatarKey(friend)
  if (!key)
    return
  avatarErrorKeys.value.add(key)
}

async function handleRemoveFromBlacklist(gid: number) {
  if (!currentAccountId.value)
    return
  await confirmAction(`确定将 GID ${gid} 移出黑名单吗？`, async () => {
    await friendStore.toggleBlacklist(currentAccountId.value!, gid)
    toast.success(`已移出黑名单: GID ${gid}`)
  })
}

async function refreshInteractRecords() {
  if (!currentAccountId.value)
    return
  await friendStore.fetchInteractRecords(currentAccountId.value)
}

function getInteractAvatar(record: any) {
  return String(record?.avatarUrl || '').trim()
}

function getInteractAvatarKey(record: any) {
  const key = String(record?.visitorGid || record?.key || record?.nick || '').trim()
  return key ? `interact:${key}` : ''
}

function canShowInteractAvatar(record: any) {
  const key = getInteractAvatarKey(record)
  if (!key)
    return false
  return !!getInteractAvatar(record) && !avatarErrorKeys.value.has(key)
}

function handleInteractAvatarError(record: any) {
  const key = getInteractAvatarKey(record)
  if (!key)
    return
  avatarErrorKeys.value.add(key)
}

function getInteractBadgeClass(actionType: number) {
  if (Number(actionType) === 1)
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (Number(actionType) === 2)
    return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
  if (Number(actionType) === 3)
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

function formatInteractTime(timestamp: number) {
  const ts = Number(timestamp) || 0
  if (!ts)
    return '--'

  const date = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minute = 60 * 1000
  const hour = 60 * minute

  if (diff >= 0 && diff < minute)
    return '刚刚'
  if (diff >= minute && diff < hour)
    return `${Math.floor(diff / minute)} 分钟前`

  const sameDay = now.getFullYear() === date.getFullYear()
    && now.getMonth() === date.getMonth()
    && now.getDate() === date.getDate()

  if (sameDay) {
    return `今天 ${date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`
  }

  if (now.getFullYear() === date.getFullYear()) {
    return `${date.getMonth() + 1}-${date.getDate()} ${date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })}`
  }

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function normalizeKnownFriendGidSyncCooldownSec(value: number) {
  const v = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(v) || v <= 0)
    return 600
  return Math.max(30, Math.min(86400, v))
}

function normalizeFriendsListCacheTtlSec(value: number) {
  const v = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(v) || v <= 0)
    return 60
  return Math.max(10, Math.min(86400, v))
}

async function handleRemoveKnownFriendGid(friend: any, e: Event) {
  e.stopPropagation()
  if (!currentAccountId.value)
    return
  const gid = Number(friend?.gid) || 0
  const name = String(friend?.name || `GID ${gid}`).trim()
  await confirmAction(
    `确定将 ${name} 移出同步列表吗？后续如果最近访客再次命中，这个 GID 仍可被自动同步回来。`,
    async () => {
      await friendStore.removeKnownFriendGid(currentAccountId.value!, gid)
      await refreshFriendsAfterKnownGidChange()
      toast.success(`已移出同步列表: ${name}`)
    },
  )
}

async function refreshFriendsAfterKnownGidChange() {
  if (!currentAccountId.value)
    return
  await friendStore.fetchFriends(currentAccountId.value, true)
}

async function handleSaveKnownFriendSettings() {
  if (!currentAccountId.value)
    return
  const cooldownSec = normalizeKnownFriendGidSyncCooldownSec(localKnownFriendGidSyncCooldownSec.value)
  const cacheTtlSec = normalizeFriendsListCacheTtlSec(localFriendsListCacheTtlSec.value)
  await friendStore.saveKnownFriendSettings(currentAccountId.value, {
    knownFriendGidSyncCooldownSec: cooldownSec,
    friendsListCacheTtlSec: cacheTtlSec,
  })
  toast.success('设置已保存')
}

watch(knownFriendGidSyncCooldownSec, (val) => {
  localKnownFriendGidSyncCooldownSec.value = val
}, { immediate: true })

watch(friendsListCacheTtlSec, (val) => {
  localFriendsListCacheTtlSec.value = val
}, { immediate: true })

function parseBatchGids(input: string): number[] {
  const text = String(input || '').trim()
  if (!text)
    return []
  const gids: number[] = []
  const parts = text.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean)
  for (const part of parts) {
    const num = Number.parseInt(part, 10)
    if (Number.isFinite(num) && num > 0 && !gids.includes(num)) {
      gids.push(num)
    }
  }
  return gids
}

async function handleBatchAddKnownFriendGids() {
  if (!currentAccountId.value)
    return
  const gids = parseBatchGids(batchGidInput.value)
  if (gids.length === 0) {
    toast.error('请输入有效的 GID 列表')
    return
  }
  const result = await friendStore.batchAddKnownFriendGids(currentAccountId.value, gids)
  if (result.ok) {
    batchGidInput.value = ''
    showBatchAddGidModal.value = false
    await refreshFriendsAfterKnownGidChange()
    toast.success(`已批量添加 ${result.addedCount} 个 GID`)
  }
}
</script>

<template>
  <div class="friends-page p-4">
    <div class="friends-header mb-3 flex flex-wrap items-center justify-start gap-2">
      <div class="flex flex-wrap items-center justify-start gap-2">
        <div v-if="activeTab === 'friends'" class="relative">
          <span class="i-carbon-search absolute left-3 top-1/2 text-gray-400 -translate-y-1/2" />
          <input
            v-model="searchKeyword"
            type="text"
            placeholder="搜索好友..."
            class="h-9 w-full border farm-input border-gray-300 rounded-lg bg-white py-1.5 pl-10 pr-4 text-sm sm:w-64 dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
        </div>
        <ElButton
          v-if="activeTab === 'friends'"
          size="small"
          :loading="loading"
          :disabled="loading"
          @click="handleRefreshFriends"
        >
          <span v-if="!loading" class="i-carbon-renew mr-1" />
          刷新列表
        </ElButton>
        <div v-if="activeTab === 'friends' && friends.length" class="text-sm text-gray-500">
          共 {{ filteredFriends.length }}/{{ friends.length }} 名好友
        </div>
        <div v-if="activeTab === 'blacklist'" class="text-sm text-gray-500">
          共 {{ blacklist.length }} 人
        </div>
        <div v-if="activeTab === 'visitors' && interactRecords.length" class="text-sm text-gray-500">
          共 {{ filteredInteractRecords.length }}/{{ interactRecords.length }} 条记录
        </div>
      </div>
    </div>

    <div class="friends-tabs mb-3 flex border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
        :class="activeTab === tab.key
          ? 'border-b-2'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'"
        :style="{ borderColor: activeTab === tab.key ? 'var(--theme-primary)' : 'transparent', color: activeTab === tab.key ? 'var(--theme-primary)' : undefined }"
        @click="activeTab = tab.key"
      >
        <div :class="tab.icon" />
        {{ tab.label }}
        <span
          v-if="tab.key === 'blacklist' && blacklist.length > 0"
          class="rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
          {{ blacklist.length }}
        </span>
      </button>
    </div>

    <div v-if="loading || statusLoading || interactLoading" class="flex justify-center py-12">
      <span class="i-svg-spinners-90-ring-with-bg text-4xl text-[var(--theme-primary)]" />
    </div>

    <div v-else-if="!currentAccountId" class="flex flex-col items-center justify-center gap-4 farm-card rounded-2xl bg-white p-12 text-center text-gray-500 shadow-md dark:bg-gray-800">
      <span class="i-carbon-user-avatar text-4xl text-gray-400" />
      <div>
        <div class="text-lg text-gray-700 font-medium dark:text-gray-300">
          未登录账号
        </div>
        <div class="mt-1 text-sm text-gray-400">
          请先添加农场账号
        </div>
      </div>
    </div>

    <div v-else-if="!status?.connection?.connected" class="flex flex-col items-center justify-center gap-4 farm-card rounded-2xl bg-white p-12 text-center text-gray-500 shadow-md dark:bg-gray-800">
      <span class="i-carbon-cloud-offline text-4xl text-gray-400" />
      <div>
        <div class="text-lg text-gray-700 font-medium dark:text-gray-300">
          账号未登录
        </div>
        <div class="mt-1 text-sm text-gray-400">
          请先运行账号或检查网络连接
        </div>
      </div>
    </div>

    <template v-else>
      <div v-if="activeTab === 'friends'" class="friends-workspace space-y-3">
        <div v-if="currentAccountId && isQqAccount" class="mb-3 border border-[var(--theme-border-subtle)] rounded-lg bg-[var(--theme-surface)] px-4 py-3">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="i-carbon-data-base text-lg text-[var(--theme-primary)]" />
                <h3 class="text-lg text-gray-700 font-semibold dark:text-gray-200">
                  QQ 好友自动同步
                </h3>
                <button
                  class="farm-badge cursor-pointer rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 transition dark:bg-blue-900/30 hover:bg-blue-200 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  @click="openGidListModal"
                >
                  {{ knownFriendGidCount }}
                </button>
              </div>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                QQ 新好友接口依赖已知 GID。系统会自动从最近访客补充，进入好友农场明确失败时自动移除失效 GID。
              </p>
            </div>
            <div class="flex shrink-0 gap-2">
              <button
                class="cartoon-btn rounded-xl bg-slate-100 px-3 py-1.5 text-sm text-slate-700 transition dark:bg-slate-800 hover:bg-slate-200 dark:text-slate-300 disabled:opacity-50 dark:hover:bg-slate-700"
                :disabled="knownFriendSettingsLoading"
                @click="currentAccountId && friendStore.fetchKnownFriendSettings(currentAccountId)"
              >
                <div v-if="knownFriendSettingsLoading" class="i-svg-spinners-90-ring-with-bg mr-1 inline-block align-text-bottom" />
                刷新
              </button>
              <button
                class="cartoon-btn rounded-xl bg-blue-100 px-3 py-1.5 text-sm text-blue-700 transition dark:bg-blue-900/30 hover:bg-blue-200 dark:text-blue-300 disabled:opacity-50 dark:hover:bg-blue-900/50"
                :disabled="knownFriendSettingsSaving"
                @click="handleSaveKnownFriendSettings"
              >
                <div v-if="knownFriendSettingsSaving" class="i-svg-spinners-90-ring-with-bg mr-1 inline-block align-text-bottom" />
                保存设置
              </button>
              <button
                class="cartoon-btn rounded-xl bg-blue-100 px-3 py-1.5 text-sm text-blue-700 transition dark:bg-blue-900/30 hover:bg-blue-200 dark:text-blue-400 disabled:opacity-50 dark:hover:bg-blue-900/50"
                @click="showBatchAddGidModal = true"
              >
                批量新增 GID
              </button>
            </div>
          </div>

          <div class="grid mt-4 gap-3 lg:grid-cols-2">
            <div>
              <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">访客检测入库冷却(秒)</label>
              <input
                v-model.number="localKnownFriendGidSyncCooldownSec"
                type="number"
                class="w-full border farm-input border-gray-300 rounded-xl bg-white px-3 py-2 text-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
            </div>
            <div>
              <label class="mb-1 block text-xs text-gray-500 dark:text-gray-400">好友列表缓存(秒)</label>
              <input
                v-model.number="localFriendsListCacheTtlSec"
                type="number"
                class="w-full border farm-input border-gray-300 rounded-xl bg-white px-3 py-2 text-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
            </div>
          </div>
        </div>

        <div v-if="friends.length === 0" class="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-8 text-center text-gray-500">
          暂无好友或数据加载失败
        </div>

        <template v-else>
          <div class="friend-toolbar">
            <div class="flex-1" />
            <ElButton
              :loading="loading"
              :disabled="loading"
              @click="handleRefreshFriends"
            >
              <span v-if="!loading" class="i-carbon-renew mr-1" />
              刷新列表
            </ElButton>
          </div>

          <div class="friend-workbench">
            <ElScrollbar class="friend-list-pane" role="listbox" aria-label="好友列表">
              <button
                v-for="friend in paginatedFriends"
                :key="friend.gid"
                class="friend-list-item"
                :class="[
                  String(friend.gid) === selectedFriendKey ? 'friend-list-item--active' : '',
                  blacklistGidSet.has(Number(friend.gid)) ? 'friend-list-item--muted' : '',
                ]"
                type="button"
                @click="selectFriend(friend.gid)"
              >
                <div class="h-9 w-9 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 ring-1 ring-gray-100 dark:bg-gray-600 dark:ring-gray-700">
                  <img
                    v-if="canShowFriendAvatar(friend)"
                    :src="getFriendAvatar(friend)"
                    class="h-full w-full object-cover"
                    loading="lazy"
                    @error="handleFriendAvatarError(friend)"
                  >
                  <span v-else class="i-carbon-user-avatar text-gray-400" />
                </div>
                <div class="min-w-0 flex-1 text-left">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm text-[var(--theme-text)] font-semibold">
                      {{ friend.name || `GID:${friend.gid}` }}
                    </span>
                    <span v-if="blacklistGidSet.has(Number(friend.gid))" class="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">已屏蔽</span>
                  </div>
                  <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--theme-text-muted)]">
                    <span>GID {{ friend.gid }}</span>
                    <span v-if="getFriendLevel(friend) > 0" class="rounded bg-[var(--theme-surface-soft)] px-1.5 py-0.5">
                      Lv.{{ getFriendLevel(friend) }}
                    </span>
                    <span v-if="getFriendGold(friend) > 0" class="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      {{ formatFriendGold(friend.gold) }}
                    </span>
                  </div>
                </div>
                <span class="i-carbon-chevron-right shrink-0 text-sm text-[var(--theme-text-muted)]" />
              </button>
            </ElScrollbar>

            <ElScrollbar class="friend-detail-pane">
              <template v-if="selectedFriend">
                <div class="friend-detail-header">
                  <div class="h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 ring-1 ring-gray-100 dark:bg-gray-600 dark:ring-gray-700">
                    <img
                      v-if="canShowFriendAvatar(selectedFriend)"
                      :src="getFriendAvatar(selectedFriend)"
                      class="h-full w-full object-cover"
                      loading="lazy"
                      @error="handleFriendAvatarError(selectedFriend)"
                    >
                    <span v-else class="i-carbon-user-avatar text-xl text-gray-400" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="truncate text-lg text-[var(--theme-text)] font-semibold">
                        {{ selectedFriend.name || `GID:${selectedFriend.gid}` }}
                      </h3>
                      <span v-if="blacklistGidSet.has(Number(selectedFriend.gid))" class="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">已屏蔽</span>
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--theme-text-muted)]">
                      <span>GID {{ selectedFriend.gid }}</span>
                      <span v-if="getFriendLevel(selectedFriend) > 0">Lv.{{ getFriendLevel(selectedFriend) }}</span>
                      <span v-if="getFriendGold(selectedFriend) > 0">金币 {{ formatFriendGold(selectedFriend.gold) }}</span>
                    </div>
                  </div>
                </div>

                <div class="friend-detail-actions">
                  <ElButton size="small" type="primary" plain @click="handleOp(selectedFriend.gid, 'steal', $event)">
                    偷取
                  </ElButton>
                  <ElButton size="small" type="success" plain @click="handleOp(selectedFriend.gid, 'farming', $event)">
                    一键务农
                  </ElButton>
                  <ElButton size="small" type="danger" plain @click="handleOp(selectedFriend.gid, 'bad', $event)">
                    捣乱
                  </ElButton>
                  <ElButton size="small" plain @click="handleToggleBlacklist(selectedFriend, $event)">
                    {{ blacklistGidSet.has(Number(selectedFriend.gid)) ? '移出黑名单' : '加入黑名单' }}
                  </ElButton>
                  <ElButton
                    v-if="isQqAccount && knownFriendGidSet.has(Number(selectedFriend.gid))"
                    size="small"
                    type="warning"
                    plain
                    @click="handleRemoveKnownFriendGid(selectedFriend, $event)"
                  >
                    移出同步列表
                  </ElButton>
                </div>

                <div class="friend-detail-status">
                  <span class="i-carbon-information text-[var(--theme-primary)]" />
                  <span :class="getFriendStatusText(selectedFriend) !== '无操作' ? 'text-teal-600 font-medium dark:text-teal-300' : 'text-[var(--theme-text-muted)]'">
                    {{ getFriendStatusText(selectedFriend) }}
                  </span>
                </div>

                <div class="friend-land-panel friend-land-panel--detail">
                  <div class="mb-3 flex items-center justify-between">
                    <h4 class="text-sm text-[var(--theme-text)] font-semibold">
                      土地状态
                    </h4>
                    <ElButton   :loading="friendLandsLoading[selectedFriendKey]" @click="selectFriend(selectedFriend.gid)">
                      刷新土地
                    </ElButton>
                  </div>
                  <div v-if="friendLandsLoading[selectedFriendKey]" class="flex justify-center py-8">
                    <div class="i-svg-spinners-90-ring-with-bg text-2xl text-[var(--theme-primary)]" />
                  </div>
                  <div v-else-if="!friendLands[selectedFriendKey] || friendLands[selectedFriendKey]?.length === 0" class="py-8 text-center text-sm text-[var(--theme-text-muted)]">
                    无土地数据
                  </div>
                  <div v-else class="friend-land-grid">
                    <LandCard
                      v-for="land in friendLands[selectedFriendKey]"
                      :key="land.id"
                      :land="land"
                    />
                  </div>
                </div>
              </template>
              <div v-else class="py-12 text-center text-sm text-[var(--theme-text-muted)]">
                请选择好友查看土地状态
              </div>
            </ElScrollbar>
          </div>

          <!-- 分页控件 -->
          <div v-if="filteredFriends.length > pageSize" class="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              class="border cartoon-btn border-gray-200 rounded-xl bg-white px-3 py-1.5 text-sm text-gray-600 transition dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:text-gray-300 disabled:opacity-50 dark:hover:bg-gray-700"
              :disabled="currentPage === 1"
              @click="goToPage(1)"
            >
              首页
            </button>
            <button
              class="border cartoon-btn border-gray-200 rounded-xl bg-white px-3 py-1.5 text-sm text-gray-600 transition dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:text-gray-300 disabled:opacity-50 dark:hover:bg-gray-700"
              :disabled="currentPage === 1"
              @click="goToPage(currentPage - 1)"
            >
              上一页
            </button>
            <div class="flex items-center gap-1">
              <template v-for="p in totalPages" :key="p">
                <button
                  v-if="p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)"
                  class="h-8 w-8 rounded-xl text-sm transition"
                  :class="p === currentPage
                    ? 'text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
                  :style="p === currentPage ? { backgroundColor: 'var(--theme-primary)' } : {}"
                  @click="goToPage(p)"
                >
                  {{ p }}
                </button>
                <span
                  v-else-if="p === currentPage - 2 || p === currentPage + 2"
                  class="px-1 text-gray-400"
                >...</span>
              </template>
            </div>
            <button
              class="border cartoon-btn border-gray-200 rounded-xl bg-white px-3 py-1.5 text-sm text-gray-600 transition dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:text-gray-300 disabled:opacity-50 dark:hover:bg-gray-700"
              :disabled="currentPage === totalPages"
              @click="goToPage(currentPage + 1)"
            >
              下一页
            </button>
            <button
              class="border cartoon-btn border-gray-200 rounded-xl bg-white px-3 py-1.5 text-sm text-gray-600 transition dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:text-gray-300 disabled:opacity-50 dark:hover:bg-gray-700"
              :disabled="currentPage === totalPages"
              @click="goToPage(totalPages)"
            >
              末页
            </button>
            <span class="text-sm text-gray-500 dark:text-gray-400">
              共 {{ filteredFriends.length }} 位好友
            </span>
          </div>
        </template>
      </div>

      <div v-else-if="activeTab === 'blacklist'" class="data-workspace">
        <div class="data-note">
          <span class="i-carbon-information text-[var(--theme-primary)]" />
          <span>加入黑名单的好友在自动偷菜和帮助时会被跳过。</span>
        </div>

        <div v-if="blacklist.length === 0" class="data-empty">
          <span class="i-carbon-warning-alt text-2xl text-gray-300" />
          <span>暂无黑名单好友</span>
        </div>

        <div v-else class="record-list-panel">
          <div class="record-list-head">
            <span>好友</span>
            <span>保护状态</span>
            <span>GID</span>
            <span class="text-right">操作</span>
          </div>
          <div
            v-for="item in blacklist"
            :key="item.gid"
            class="record-row blacklist-row"
          >
            <div class="record-person">
              <div class="record-avatar">
                <img
                  v-if="item.avatarUrl"
                  :src="item.avatarUrl"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                >
                <span v-else class="i-carbon-user text-gray-400" />
              </div>
              <div class="min-w-0">
                <div class="truncate text-sm text-[var(--theme-text)] font-semibold">
                  {{ item.name || `GID:${item.gid}` }}
                </div>
                <div class="text-xs text-[var(--theme-text-muted)]">
                  自动偷菜和帮助时跳过
                </div>
              </div>
            </div>
            <div class="record-tag-cell">
              <span class="record-soft-tag record-soft-tag--gray">黑名单保护</span>
            </div>
            <div class="record-mono">
              {{ item.gid }}
            </div>
            <div class="record-action">
              <button class="record-link-danger" @click="handleRemoveFromBlacklist(item.gid)">
                移出
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'visitors'" class="data-workspace">
        <div class="interact-filter-toolbar">
          <ElRadioGroup v-model="interactFilter" >
            <ElRadioButton
              v-for="item in interactFilters"
              :key="item.key"
              :value="item.key"
            >
              {{ item.label }}
            </ElRadioButton>
          </ElRadioGroup>
          <ElButton
            :loading="interactLoading"
            @click="refreshInteractRecords"
          >
            刷新
          </ElButton>
        </div>

        <div v-if="!!interactError" class="rounded-lg bg-red-50 px-4 py-6 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
          {{ interactError }}
        </div>

        <div v-else-if="visibleInteractRecords.length === 0" class="data-empty">
          <span class="i-carbon-view text-2xl text-gray-300" />
          <span>暂无访客记录</span>
        </div>

        <div v-else class="record-list-panel visitors-record-panel">
          <div class="record-list-head visitors-record-head">
            <span>访客</span>
            <span>行为</span>
            <span>等级</span>
            <span>详情</span>
            <span class="text-right">时间</span>
          </div>
          <div
            v-for="record in visibleInteractRecords"
            :key="record.key"
            class="record-row visitor-row"
          >
            <div class="record-person">
              <div class="record-avatar">
                <img
                  v-if="canShowInteractAvatar(record)"
                  :src="getInteractAvatar(record)"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  @error="handleInteractAvatarError(record)"
                >
                <span v-else class="i-carbon-user text-gray-400" />
              </div>
              <div class="min-w-0">
                <div class="truncate text-sm text-[var(--theme-text)] font-semibold">
                  {{ record.nick || `GID:${record.visitorGid}` }}
                </div>
                <div class="text-xs text-[var(--theme-text-muted)]">
                  GID {{ record.visitorGid || '--' }}
                </div>
              </div>
            </div>
            <div class="record-tag-cell">
              <span class="record-soft-tag" :class="getInteractBadgeClass(record.actionType)">
                {{ record.actionLabel }}
              </span>
            </div>
            <div class="record-mono">
              {{ record.level ? `Lv.${record.level}` : '--' }}
            </div>
            <div class="record-detail">
              {{ record.actionDetail || record.actionLabel }}
            </div>
            <div class="record-time">
              {{ formatInteractTime(record.serverTimeMs) }}
            </div>
          </div>
          <div v-if="filteredInteractRecords.length > visibleInteractRecords.length" class="data-table-footer">
            仅展示最近 {{ visibleInteractRecords.length }} 条
          </div>
        </div>
      </div>
    </template>

    <Teleport to="body">
      <div
        v-if="showBatchAddGidModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showBatchAddGidModal = false"
      >
        <div class="max-w-lg w-full rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
          <h3 class="mb-4 text-lg text-gray-800 font-semibold dark:text-gray-100">
            批量新增 GID
          </h3>
          <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
            支持一行一个或用逗号/空格分隔，自动去重
          </p>
          <textarea
            v-model="batchGidInput"
            rows="8"
            placeholder="每行一个 GID，或用逗号、空格分隔&#10;例如：&#10;12345678&#10;87654321&#10;或&#10;12345678, 87654321, 11111111"
            class="mb-4 w-full border farm-input border-gray-300 rounded-xl bg-white p-3 text-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <div class="flex justify-end gap-3">
            <button
              class="border cartoon-btn border-gray-300 rounded-xl bg-white px-4 py-2 text-sm text-gray-700 transition dark:border-gray-600 dark:bg-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-600"
              @click="showBatchAddGidModal = false"
            >
              取消
            </button>
            <button
              class="cartoon-btn rounded-xl px-4 py-2 text-sm text-white transition disabled:opacity-50"
              :disabled="knownFriendSettingsSaving || !batchGidInput.trim()"
              :style="{ backgroundColor: 'var(--theme-primary)' }"
              @click="handleBatchAddKnownFriendGids"
            >
              <div v-if="knownFriendSettingsSaving" class="i-svg-spinners-90-ring-with-bg mr-1 inline-block align-text-bottom" />
              确认添加
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="showGidListModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showGidListModal = false"
      >
        <div class="max-h-[80vh] max-w-2xl w-full flex flex-col rounded-2xl bg-white shadow-xl dark:bg-gray-800">
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <div>
              <h3 class="text-lg text-gray-800 font-semibold dark:text-gray-100">
                已导入的 GID 列表
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                共 {{ knownFriendGidCount }} 个 GID，
                <span class="text-yellow-600 dark:text-yellow-400">已同步 {{ syncedGidCount }} 个</span>，
                <span class="text-red-600 dark:text-red-400">未同步 {{ unsyncedGidCount }} 个</span>
              </p>
            </div>
            <button
              class="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-gray-700"
              @click="showGidListModal = false"
            >
              <span class="text-xl">✕</span>
            </button>
          </div>

          <div class="shrink-0 border-b border-gray-200 p-4 dark:border-gray-700">
            <div class="flex gap-2">
              <input
                v-model="gidSearchKeyword"
                type="text"
                placeholder="搜索 GID..."
                class="flex-1 border farm-input border-gray-300 rounded-xl bg-white px-3 py-2 text-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
              <button
                class="shrink-0 cartoon-btn rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700 transition dark:bg-red-900/30 hover:bg-red-200 dark:text-red-400 disabled:opacity-50 dark:hover:bg-red-900/50"
                :disabled="knownFriendSettingsSaving || unsyncedGidCount === 0"
                @click="handleRemoveUnsyncedGids"
              >
                <div v-if="knownFriendSettingsSaving" class="i-svg-spinners-90-ring-with-bg mr-1 inline-block align-text-bottom" />
                删除未同步 ({{ unsyncedGidCount }})
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div v-if="filteredKnownFriendGids.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400">
              暂无数据
            </div>
            <div v-else class="grid gap-2 lg:grid-cols-3 sm:grid-cols-2">
              <div
                v-for="item in filteredKnownFriendGids"
                :key="item.gid"
                class="flex items-center justify-between border rounded-xl p-2 transition"
                :class="[
                  item.synced
                    ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700/50 dark:bg-yellow-900/20'
                    : 'border-red-300 bg-red-50 dark:border-red-700/50 dark:bg-red-900/20',
                ]"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="text-sm font-mono"
                    :class="item.synced ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'"
                  >
                    {{ item.gid }}
                  </span>
                  <span
                    v-if="item.synced"
                    class="rounded bg-yellow-200 px-1 py-0.5 text-xs text-yellow-700 dark:bg-yellow-800/50 dark:text-yellow-300"
                  >
                    已同步
                  </span>
                  <span
                    v-else
                    class="rounded bg-red-200 px-1 py-0.5 text-xs text-red-700 dark:bg-red-800/50 dark:text-red-300"
                  >
                    未同步
                  </span>
                </div>
                <button
                  class="rounded p-1 text-gray-400 transition hover:bg-gray-200 hover:text-red-500 dark:hover:bg-gray-700"
                  :disabled="knownFriendSettingsSaving"
                  @click="handleRemoveGidFromList(item.gid)"
                >
                  <span class="text-sm">🗑️</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.friend-toolbar {
  display: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0;
  background: transparent;
}

.friends-page {
  min-height: 0;
  height: calc(100dvh - 72px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.friends-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.interact-filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 0 0 10px;
  border-bottom: 1px solid var(--theme-border);
}

.friend-workbench {
  display: grid;
  grid-template-columns: minmax(270px, 340px) minmax(0, 1fr);
  flex: 1;
  height: auto;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-surface);
}

.friend-list-pane {
  height: 100%;
  min-height: 0;
  border-right: 1px solid var(--theme-border);
  background: var(--theme-surface-soft);
}

.friend-list-pane :deep(.el-scrollbar__view) {
  padding: 0;
}

.friend-list-item {
  width: 100%;
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 0;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--theme-border);
  border-radius: 0;
  background: transparent;
  padding: 8px 12px 8px 10px;
  color: inherit;
  cursor: pointer;
  transition:
    background-color var(--theme-duration-fast),
    border-color var(--theme-duration-fast),
    opacity var(--theme-duration-fast);
}

.friend-list-item:hover {
  background: color-mix(in srgb, var(--theme-surface) 72%, var(--theme-surface-soft));
}

.friend-list-item--active {
  border-left-color: var(--theme-primary);
  background: var(--theme-surface);
}

.friend-list-item--muted {
  opacity: 0.62;
}

.friend-detail-pane {
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.friend-detail-pane :deep(.el-scrollbar__view) {
  padding: 12px 16px;
}

.friend-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--theme-border);
}

.friend-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--theme-border);
}

.friend-detail-actions :deep(.el-button) {
  margin-left: 0;
}

.friend-detail-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0;
  border-bottom: 1px solid var(--theme-border);
  background: transparent;
  padding: 10px 12px;
  font-size: 13px;
}

.friend-land-panel {
  padding: 10px 0 0;
  border-top: 1px solid var(--theme-border);
  background: transparent;
}

.friend-land-panel--detail {
  border: 0;
  border-radius: 0;
}

.friend-land-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.friend-land-panel--detail :deep(.land-card) {
  min-height: 136px;
  border-radius: 6px;
  box-shadow: none;
}

.friend-land-panel--detail :deep(.land-card__header) {
  padding: 8px 10px 0;
}

.friend-land-panel--detail :deep(.land-card__topline) {
  height: 2px;
}

.friend-land-panel--detail :deep(.land-card__body) {
  gap: 8px;
  padding: 8px 10px;
}

.friend-land-panel--detail :deep(.plant-preview) {
  width: 46px;
  height: 46px;
  border-radius: 6px;
}

.friend-land-panel--detail :deep(.plant-image) {
  max-width: 36px;
  max-height: 36px;
}

.friend-land-panel--detail :deep(.plant-name) {
  font-size: 13px;
}

.friend-land-panel--detail :deep(.plant-meta),
.friend-land-panel--detail :deep(.progress-row) {
  font-size: 12px;
}

.friend-land-panel--detail :deep(.land-progress) {
  padding: 0 10px 8px;
}

.friend-land-panel--detail :deep(.land-card__footer) {
  display: none;
}

.compact-list-row {
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-surface);
  padding: 12px 14px;
  box-shadow: none;
  transition: background-color var(--theme-duration-fast);
}

.compact-list-row:hover {
  background: var(--theme-surface-soft);
}

.data-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

.data-note {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--theme-border);
  padding: 0 0 10px;
  color: var(--theme-text-muted);
  font-size: 13px;
}

.data-empty {
  flex: 1;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed var(--theme-border);
  border-radius: var(--theme-radius-md);
  color: var(--theme-text-muted);
  background: color-mix(in srgb, var(--theme-surface) 72%, transparent);
}

.record-list-panel {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-surface);
}

.record-list-head,
.record-row {
  display: grid;
  grid-template-columns: minmax(220px, 1.4fr) minmax(120px, 0.6fr) minmax(120px, 0.6fr) minmax(88px, 0.4fr);
  align-items: center;
  column-gap: 16px;
}

.visitors-record-head,
.visitor-row {
  grid-template-columns: minmax(220px, 1.25fr) minmax(110px, 0.55fr) minmax(80px, 0.35fr) minmax(260px, 1fr) minmax(100px, 0.45fr);
}

.record-list-head {
  position: sticky;
  top: 0;
  z-index: 1;
  border-bottom: 1px solid var(--theme-border);
  background: var(--theme-surface-soft);
  padding: 10px 14px;
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 600;
}

.record-row {
  min-height: 56px;
  border-bottom: 1px solid var(--theme-border);
  padding: 10px 14px;
  transition: background-color var(--theme-duration-fast);
}

.record-row:hover {
  background: var(--theme-surface-soft);
}

.record-row:last-child {
  border-bottom: 0;
}

.record-person {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.record-avatar {
  width: 34px;
  height: 34px;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-surface-soft);
}

.record-tag-cell {
  min-width: 0;
}

.record-soft-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
}

.record-soft-tag--gray {
  background: color-mix(in srgb, var(--theme-text-muted) 12%, transparent);
  color: var(--theme-text-muted);
}

.record-mono {
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-detail {
  min-width: 0;
  overflow: hidden;
  color: var(--theme-text);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-time,
.record-action {
  color: var(--theme-text-muted);
  font-size: 12px;
  text-align: right;
}

.record-link-danger {
  border: 0;
  background: transparent;
  color: #dc2626;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.record-link-danger:hover {
  color: #b91c1c;
}

.data-table-footer {
  border-top: 1px solid var(--theme-border);
  padding: 8px 12px;
  color: var(--theme-text-muted);
  font-size: 12px;
  text-align: center;
}

@media (max-width: 640px) {
  .friend-workbench {
    grid-template-columns: 1fr;
    height: auto;
    min-height: 0;
  }

  .friend-list-pane {
    max-height: 320px;
    height: 320px;
    border-right: 0;
    border-bottom: 1px solid var(--theme-border);
  }

  .friend-detail-pane :deep(.el-scrollbar__view) {
    padding: 12px;
  }

  .friend-detail-pane {
    height: auto;
  }

  .friend-land-grid {
    grid-template-columns: 1fr;
  }

  .record-list-head {
    display: none;
  }

  .record-row,
  .visitor-row {
    grid-template-columns: 1fr;
    row-gap: 8px;
  }

  .record-time,
  .record-action {
    text-align: left;
  }
}
</style>
