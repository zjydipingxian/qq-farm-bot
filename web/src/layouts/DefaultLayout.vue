<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import AccountModal from '@/components/AccountModal.vue'
import Sidebar from '@/components/Sidebar.vue'
import { menuRoutes } from '@/router/menu'
import { getPlatformLabel, useAccountStore } from '@/stores/account'
import { useAppStore } from '@/stores/app'
import { useStatusStore } from '@/stores/status'
import { useUserStore } from '@/stores/user'

const appStore = useAppStore()
const accountStore = useAccountStore()
const statusStore = useStatusStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const { accounts, currentAccount, currentAccountId } = storeToRefs(accountStore)
const { status, realtimeConnected } = storeToRefs(statusStore)

const showAccountModal = ref(false)
const accountToEdit = ref<any>(null)
const systemConnected = ref(true)
const serverUptimeBase = ref(0)
const serverVersion = ref('')
const lastPingTime = ref(Date.now())
const now = useNow()
const appVersion = __APP_VERSION__

const showRenewModal = ref(false)
const renewCardCode = ref('')
const renewLoading = ref(false)
const renewError = ref('')
const renewSuccess = ref(false)
const tokenVisible = ref(false)
const tokenCopied = ref(false)

const pageTitle = computed(() => {
  const item = menuRoutes.find((menu) => {
    const path = menu.path ? `/${menu.path}` : '/'
    return path === '/' ? route.path === '/' : route.path.startsWith(path)
  })
  return item?.label || '控制台'
})

const pageDescription = computed(() => {
  const descriptions: Record<string, string> = {
    '/': '查看自动化状态、运行日志与关键资源。',
    '/personal': '管理农场、背包与任务执行。',
    '/friends': '查看好友互动与偷菜辅助状态。',
    '/analytics': '对比作物收益并管理策略黑名单。',
    '/settings': '配置账号、策略、自动化与用户安全。',
    '/config': '维护游戏配置数据。',
    '/admin': '管理用户、卡密和系统后台数据。',
  }
  return descriptions[route.path] || '集中管理 QQ 农场自动化任务。'
})

const accountOptions = computed(() => accounts.value.map(acc => ({
  label: acc.name || acc.nick || String(acc.uin || acc.id),
  value: String(acc.id),
})))

const uptime = computed(() => {
  const diff = Math.max(0, Math.floor(serverUptimeBase.value + (now.value.getTime() - lastPingTime.value) / 1000))
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return `${h}h ${m}m ${s}s`
})

const connectionStatus = computed(() => {
  if (!systemConnected.value)
    return { label: '系统离线', type: 'danger' as const, pulse: false }
  if (!currentAccount.value)
    return { label: '未选择账号', type: 'info' as const, pulse: false }
  if (status.value?.connection?.connected)
    return { label: realtimeConnected.value ? '实时在线' : '在线', type: 'success' as const, pulse: true }
  return { label: '账号离线', type: 'warning' as const, pulse: false }
})

async function checkConnection() {
  try {
    const res = await api.get('/api/ping')
    systemConnected.value = true
    if (res.data?.ok && res.data?.data) {
      if (res.data.data.uptime) {
        serverUptimeBase.value = res.data.data.uptime
        lastPingTime.value = Date.now()
      }
      if (res.data.data.version)
        serverVersion.value = res.data.data.version
    }

    const accountRef = currentAccount.value?.id || currentAccount.value?.uin
    if (accountRef)
      statusStore.connectRealtime(String(accountRef))
  }
  catch {
    systemConnected.value = false
  }
}

async function refreshStatusFallback() {
  if (realtimeConnected.value)
    return

  const accountRef = currentAccount.value?.id || currentAccount.value?.uin
  if (accountRef)
    await statusStore.fetchStatus(String(accountRef))
}

async function handleAccountSaved() {
  await accountStore.fetchAccounts()
  await refreshStatusFallback()
  showAccountModal.value = false
  accountToEdit.value = null
}

function openAddAccount() {
  accountToEdit.value = null
  showAccountModal.value = true
}

async function handleLogout() {
  await userStore.logout()
  router.push('/login')
}

function resetRenewModal() {
  renewCardCode.value = ''
  renewError.value = ''
  renewSuccess.value = false
}

function openRenewModal() {
  resetRenewModal()
  showRenewModal.value = true
}

async function handleRenew() {
  if (!renewCardCode.value.trim()) {
    renewError.value = '请输入卡密'
    return
  }
  renewLoading.value = true
  renewError.value = ''
  renewSuccess.value = false
  try {
    const res = await userStore.renew(renewCardCode.value.trim())
    if (res.ok) {
      renewSuccess.value = true
      renewCardCode.value = ''
      setTimeout(() => {
        showRenewModal.value = false
        renewSuccess.value = false
      }, 1200)
    }
    else {
      renewError.value = res.error || '续费失败'
    }
  }
  catch (e: any) {
    renewError.value = e?.response?.data?.error || e?.message || '续费失败'
  }
  finally {
    renewLoading.value = false
  }
}

async function copyToken() {
  if (!userStore.token)
    return
  try {
    await navigator.clipboard.writeText(userStore.token)
    tokenCopied.value = true
    setTimeout(() => {
      tokenCopied.value = false
    }, 1500)
  }
  catch {
    tokenCopied.value = false
  }
}

watch(currentAccountId, async (id) => {
  statusStore.connectRealtime(String(id || ''))
  await refreshStatusFallback()
}, { immediate: true })

watch(() => route.path, () => {
  if (window.innerWidth < 1024)
    appStore.closeSidebar()
})

onMounted(async () => {
  await Promise.all([
    accountStore.fetchAccounts(),
    userStore.fetchUserInfo(),
    checkConnection(),
  ])
})

onBeforeUnmount(() => {
  statusStore.disconnectRealtime()
})

useIntervalFn(checkConnection, 30000)
useIntervalFn(() => {
  refreshStatusFallback()
  accountStore.fetchAccounts()
}, 10000)
</script>

<template>
  <div class="app-shell">
    <div
      v-if="appStore.sidebarOpen"
      class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
      @click="appStore.closeSidebar"
    />

    <Sidebar />

    <main class="app-content">
      <header class="app-topbar px-3 lg:px-4">
        <div class="topbar-left">
          <button
            class="top-icon"
            type="button"
            aria-label="切换导航"
            @click="appStore.toggleNavigation"
          >
            <span class="i-carbon-menu" />
          </button>

          <div class="title-block">
            <div class="title-row">
              <h1 class="page-title truncate">
                {{ pageTitle }}
              </h1>
              <ElTag :type="connectionStatus.type" effect="light" round size="small">
                <span class="inline-flex items-center gap-1">
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="connectionStatus.pulse ? 'animate-pulse' : ''"
                    style="background: currentColor"
                  />
                  {{ connectionStatus.label }}
                </span>
              </ElTag>
            </div>
            <p class="page-description">
              {{ pageDescription }}
            </p>
          </div>
        </div>

        <div class="hidden items-center gap-2 md:flex">
          <ElSelect
            v-model="accountStore.currentAccountId"
            class="w-52"
            placeholder="选择账号"
            filterable
          >
            <ElOption
              v-for="item in accountOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>

          <ElButton type="primary" @click="openAddAccount">
            <span class="i-carbon-add mr-1" />
            添加账号
          </ElButton>

          <ElTooltip :content="appStore.isDark ? '切换到浅色模式' : '切换到深色模式'">
            <button class="top-icon" type="button" @click="appStore.toggleDark">
              <span v-if="appStore.isDark" class="i-carbon-sun" />
              <span v-else class="i-carbon-moon" />
            </button>
          </ElTooltip>

          <ElDropdown trigger="click">
            <button class="user-trigger" type="button">
              <span class="user-avatar">{{ (userStore.username || 'U').slice(0, 1).toUpperCase() }}</span>
              <span class="max-w-28 truncate">{{ userStore.username || '用户' }}</span>
              <span class="i-carbon-chevron-down text-sm" />
            </button>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem disabled>
                  {{ userStore.isAdmin ? '管理员' : '普通用户' }} / {{ userStore.expireTimeText }}
                </ElDropdownItem>
                <ElDropdownItem @click="openRenewModal">
                  <span class="i-carbon-renew mr-2" />续费/额度
                </ElDropdownItem>
                <ElDropdownItem v-if="userStore.token" @click="tokenVisible = !tokenVisible">
                  <span class="i-carbon-key mr-2" />{{ tokenVisible ? '隐藏 Token' : '显示 Token' }}
                </ElDropdownItem>
                <ElDropdownItem v-if="userStore.token" @click="copyToken">
                  <span :class="tokenCopied ? 'i-carbon-checkmark mr-2' : 'i-carbon-copy mr-2'" />{{ tokenCopied ? '已复制' : '复制 Token' }}
                </ElDropdownItem>
                <ElDropdownItem divided @click="handleLogout">
                  <span class="i-carbon-logout mr-2" />退出登录
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </header>

      <div
        v-if="tokenVisible && userStore.token"
        class="border-b px-6 py-2 text-xs font-mono"
        style="border-color: var(--theme-border); background: var(--theme-surface-soft); color: var(--theme-text-muted)"
      >
        Token: {{ userStore.token }}
      </div>

      <div class="page-scroll">
        <div class="quick-panel mb-4">
          <div class="quick-card">
            <span class="quick-icon i-carbon-user-avatar" />
            <div>
              <div class="quick-label">
                当前账号
              </div>
              <div class="quick-value">
                {{ currentAccount?.name || currentAccount?.nick || currentAccount?.uin || '未选择' }}
              </div>
            </div>
          </div>
          <div class="quick-card">
            <span class="quick-icon i-carbon-application" />
            <div>
              <div class="quick-label">
                平台
              </div>
              <div class="quick-value">
                {{ getPlatformLabel(currentAccount?.platform) || '-' }}
              </div>
            </div>
          </div>
          <div class="quick-card">
            <span class="quick-icon i-carbon-time" />
            <div>
              <div class="quick-label">
                服务运行
              </div>
              <div class="quick-value">
                {{ uptime }}
              </div>
            </div>
          </div>
          <div class="quick-card">
            <span class="quick-icon i-carbon-version" />
            <div>
              <div class="quick-label">
                版本
              </div>
              <div class="quick-value">
                Web {{ appVersion }}<span v-if="serverVersion"> / Core {{ serverVersion }}</span>
              </div>
            </div>
          </div>
        </div>

        <RouterView v-slot="{ Component, route: currentRoute }">
          <Transition name="slide-fade" mode="out-in">
            <component :is="Component" :key="currentRoute.path" />
          </Transition>
        </RouterView>
      </div>
    </main>

    <AccountModal
      :show="showAccountModal"
      :edit-data="accountToEdit"
      @close="showAccountModal = false; accountToEdit = null"
      @saved="handleAccountSaved"
    />

    <ElDialog v-model="showRenewModal" title="续费/额度" width="420px" append-to-body>
      <div class="space-y-3">
        <div class="rounded-lg p-3 text-sm" style="background: var(--theme-surface-soft); color: var(--theme-text-muted)">
          当前状态：{{ userStore.expireTimeText }}，账号额度 {{ userStore.accountLimit }}
        </div>
        <ElInput v-model="renewCardCode" placeholder="请输入卡密" clearable @keyup.enter="handleRenew" />
        <ElAlert v-if="renewError" :title="renewError" type="error" show-icon :closable="false" />
        <ElAlert v-if="renewSuccess" title="续费成功" type="success" show-icon :closable="false" />
      </div>
      <template #footer>
        <ElButton @click="showRenewModal = false">
          取消
        </ElButton>
        <ElButton type="primary" :loading="renewLoading" @click="handleRenew">
          确认使用
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped>
.topbar-left {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.top-icon {
  width: 34px;
  height: 34px;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid transparent;
  border-radius: var(--theme-radius-md);
  background: transparent;
  color: var(--theme-text-muted);
  cursor: pointer;
}

.top-icon:hover {
  background: var(--theme-surface-soft);
  color: var(--theme-text);
}

.title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.15;
}

.page-title {
  margin: 0;
  color: var(--theme-text);
  font-size: 17px;
  font-weight: 700;
}

.page-description {
  overflow: hidden;
  margin: 3px 0 0;
  color: var(--theme-text-muted);
  font-size: 12px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-trigger {
  height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 0;
  border-radius: var(--theme-radius-md);
  background: transparent;
  color: var(--theme-text);
  padding: 0 6px;
  cursor: pointer;
}

.user-trigger:hover {
  background: var(--theme-surface-soft);
}

.user-avatar {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #7b67ee, #3370ff);
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.quick-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.quick-card {
  min-height: 70px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-surface);
  padding: 12px;
}

.quick-icon {
  width: 30px;
  height: 30px;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: var(--theme-radius-md);
  background: var(--theme-primary-soft);
  color: var(--theme-primary);
  font-size: 17px;
}

.quick-label {
  color: var(--theme-text-muted);
  font-size: 12px;
}

.quick-value {
  overflow: hidden;
  margin-top: 3px;
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1024px) {
  .quick-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .quick-panel {
    grid-template-columns: 1fr;
  }
}
</style>
