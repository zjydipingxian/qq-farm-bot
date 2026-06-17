<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { menuRoutes } from '@/router/menu'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'

const appStore = useAppStore()
const userStore = useUserStore()
const route = useRoute()

const navItems = computed(() => {
  return menuRoutes
    .filter(item => !item.adminOnly || userStore.isAdmin)
    .map(item => ({
      path: item.path ? `/${item.path}` : '/',
      label: item.label,
      icon: item.icon,
    }))
})

function isActive(path: string) {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>

<template>
  <aside
    class="app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col transition-all duration-200 lg:static lg:translate-x-0"
    :class="[
      appStore.sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      appStore.sidebarCollapsed ? 'w-56 lg:w-16' : 'w-56',
      { 'app-sidebar--collapsed': appStore.sidebarCollapsed },
    ]"
  >
    <div class="sidebar-brand">
      <RouterLink to="/" class="brand-link" @click="appStore.closeSidebar">
        <div class="brand-logo">
          <span class="i-carbon-crop-growth" />
        </div>
        <div v-show="!appStore.sidebarCollapsed" class="min-w-0">
          <div class="brand-title">
            QQ Farm Bot
          </div>
          <!-- <div class="brand-subtitle">
            QQ Farm Bot
          </div> -->
        </div>
      </RouterLink>

      <!-- <button
        class="sidebar-close"
        type="button"
        :aria-label="appStore.sidebarCollapsed ? '展开导航' : '收起导航'"
        @click="appStore.toggleNavigation"
      >
        <span :class="appStore.sidebarCollapsed ? 'i-carbon-chevron-right' : 'i-carbon-chevron-left'" />
      </button> -->
    </div>

    <nav class="sidebar-nav">
      <ElTooltip
        v-for="item in navItems"
        :key="item.path"
        :content="item.label"
        :disabled="!appStore.sidebarCollapsed"
        placement="right"
        :show-after="160"
      >
        <RouterLink
          :to="item.path"
          class="nav-link"
          :class="{ 'nav-link--active': isActive(item.path) }"
          :aria-label="item.label"
          @click="appStore.closeSidebar"
        >
          <span :class="item.icon" class="nav-icon" />
          <span v-show="!appStore.sidebarCollapsed" class="truncate">{{ item.label }}</span>
        </RouterLink>
      </ElTooltip>
    </nav>

    <div v-show="!appStore.sidebarCollapsed" class="sidebar-footer">
      <div class="user-mini">
        <span class="user-mini__icon i-carbon-user-avatar" />
        <div class="min-w-0">
          <div class="user-mini__name truncate">
            {{ userStore.username || '未登录' }}
          </div>
          <div class="user-mini__role truncate">
            {{ userStore.isAdmin ? '管理员' : '成员' }}
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar-brand {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--theme-border);
  padding: 0 12px 0 16px;
}

.app-sidebar--collapsed .sidebar-brand {
  justify-content: center;
  padding: 0;
}

.app-sidebar--collapsed .brand-link {
  width: 44px;
  height: 56px;
  justify-content: center;
  gap: 0;
}

.app-sidebar--collapsed .brand-logo {
  width: 30px;
  height: 30px;
  font-size: 18px;
}

.brand-link {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  color: inherit;
  text-decoration: none;
}

.brand-logo {
  width: 28px;
  height: 28px;
  display: grid;
  flex-shrink: 0;
  place-items: center;
  border-radius: 6px;
  background: var(--theme-primary);
  color: white;
  font-size: 17px;
}

.brand-title {
  overflow: hidden;
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-subtitle {
  overflow: hidden;
  color: var(--theme-text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-close {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: transparent;
  color: var(--theme-text-muted);
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.sidebar-close:hover {
  border-color: color-mix(in srgb, var(--theme-primary) 30%, var(--theme-border));
  background: var(--theme-surface);
  color: var(--theme-primary);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 10px 8px;
}

.app-sidebar--collapsed .sidebar-nav {
  padding: 10px 6px;
}

.nav-link {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-radius: var(--theme-radius-md);
  color: var(--theme-text-muted);
  font-size: 13px;
  font-weight: 500;
  padding: 0 10px;
  text-decoration: none;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.nav-link:hover {
  background: var(--theme-surface);
  color: var(--theme-text);
}

.app-sidebar--collapsed .nav-link {
  justify-content: center;
  gap: 0;
  padding: 0;
}

.app-sidebar--collapsed .nav-link:hover {
  background: var(--theme-primary-soft);
  color: var(--theme-primary);
}

.nav-link--active {
  background: var(--theme-primary-soft);
  color: var(--theme-primary);
  font-weight: 600;
}

.nav-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  font-size: 16px;
}

.sidebar-footer {
  border-top: 1px solid var(--theme-border);
  padding: 10px;
}

.user-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: var(--theme-radius-md);
  padding: 8px;
}

.user-mini__icon {
  color: var(--theme-primary);
  font-size: 20px;
}

.user-mini__name {
  color: var(--theme-text);
  font-size: 12px;
  font-weight: 600;
}

.user-mini__role {
  color: var(--theme-text-muted);
  font-size: 11px;
}
</style>
