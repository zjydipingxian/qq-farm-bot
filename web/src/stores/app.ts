import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import api from '@/api'

const THEME_KEY = 'ui_theme'

export type Theme = 'light' | 'dark'

interface ThemeTokens {
  isDark: boolean
  bg: string
  page: string
  surface: string
  surfaceSoft: string
  text: string
  textMuted: string
  border: string
  primary: string
  primarySoft: string
  secondary: string
  success: string
  warning: string
  danger: string
  gradient: string
}

const themeTokens: Record<Theme, ThemeTokens> = {
  light: {
    isDark: false,
    bg: '#f7f8fa',
    page: '#f2f3f5',
    surface: '#ffffff',
    surfaceSoft: '#f7f8fa',
    text: '#1f2329',
    textMuted: '#646a73',
    border: '#dee0e3',
    primary: '#3370ff',
    primarySoft: '#e8efff',
    secondary: '#7b67ee',
    success: '#2ea121',
    warning: '#f54a45',
    danger: '#f54a45',
    gradient: 'linear-gradient(135deg, #3370ff 0%, #7b67ee 100%)',
  },
  dark: {
    isDark: true,
    bg: '#101319',
    page: '#171a22',
    surface: '#1f2430',
    surfaceSoft: '#252b38',
    text: '#f2f3f5',
    textMuted: '#a8abb2',
    border: '#333948',
    primary: '#5b8cff',
    primarySoft: '#25365f',
    secondary: '#9b8cff',
    success: '#4cc05f',
    warning: '#ff9c40',
    danger: '#ff6b66',
    gradient: 'linear-gradient(135deg, #5b8cff 0%, #9b8cff 100%)',
  },
}

function normalizeTheme(theme: unknown): Theme {
  return theme === 'dark' ? 'dark' : 'light'
}

function applyCssTokens(theme: Theme) {
  if (typeof document === 'undefined')
    return

  const root = document.documentElement
  const t = themeTokens[theme]

  root.classList.toggle('dark', t.isDark)
  root.style.colorScheme = t.isDark ? 'dark' : 'light'

  root.style.setProperty('--theme-bg', t.bg)
  root.style.setProperty('--theme-page', t.page)
  root.style.setProperty('--theme-surface', t.surface)
  root.style.setProperty('--theme-surface-soft', t.surfaceSoft)
  root.style.setProperty('--theme-text', t.text)
  root.style.setProperty('--theme-text-muted', t.textMuted)
  root.style.setProperty('--theme-border', t.border)
  root.style.setProperty('--theme-primary', t.primary)
  root.style.setProperty('--theme-primary-soft', t.primarySoft)
  root.style.setProperty('--theme-secondary', t.secondary)
  root.style.setProperty('--theme-success', t.success)
  root.style.setProperty('--theme-warning', t.warning)
  root.style.setProperty('--theme-danger', t.danger)
  root.style.setProperty('--theme-gradient', t.gradient)

  root.style.setProperty('--theme-radius-sm', '3px')
  root.style.setProperty('--theme-radius-md', '4px')
  root.style.setProperty('--theme-radius-lg', '6px')
  root.style.setProperty('--theme-radius-xl', '8px')
  root.style.setProperty('--theme-shadow-sm', '0 1px 2px rgba(31, 35, 41, 0.04)')
  root.style.setProperty('--theme-shadow-md', '0 4px 16px rgba(31, 35, 41, 0.06)')
  root.style.setProperty('--theme-shadow-lg', '0 8px 28px rgba(31, 35, 41, 0.1)')

  root.style.setProperty('--el-color-primary', t.primary)
  root.style.setProperty('--el-color-success', t.success)
  root.style.setProperty('--el-color-warning', t.warning)
  root.style.setProperty('--el-color-danger', t.danger)
  root.style.setProperty('--el-bg-color', t.surface)
  root.style.setProperty('--el-bg-color-page', t.page)
  root.style.setProperty('--el-bg-color-overlay', t.surface)
  root.style.setProperty('--el-text-color-primary', t.text)
  root.style.setProperty('--el-text-color-regular', t.text)
  root.style.setProperty('--el-text-color-secondary', t.textMuted)
  root.style.setProperty('--el-border-color', t.border)
  root.style.setProperty('--el-border-color-light', t.border)
  root.style.setProperty('--el-fill-color-blank', t.surface)
  root.style.setProperty('--el-fill-color-light', t.surfaceSoft)
  root.style.setProperty('--el-border-radius-base', '4px')
}

export const useAppStore = defineStore('app', () => {
  const sidebarOpen = ref(false)
  const sidebarCollapsed = ref(localStorage.getItem('sidebar_collapsed') === 'true')
  const currentTheme = ref<Theme>(normalizeTheme(localStorage.getItem(THEME_KEY)))

  const themes = themeTokens

  const isDark = computed(() => currentTheme.value === 'dark')

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  function openSidebar() {
    sidebarOpen.value = true
  }

  function toggleSidebarCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('sidebar_collapsed', String(sidebarCollapsed.value))
  }

  function toggleNavigation() {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      toggleSidebarCollapsed()
      return
    }
    toggleSidebar()
  }

  async function fetchTheme() {
    try {
      await api.get('/api/settings')
    }
    catch {
      // Settings may be unavailable before login; local theme remains authoritative.
    }
  }

  function applyTheme(theme: Theme) {
    currentTheme.value = normalizeTheme(theme)
    localStorage.setItem(THEME_KEY, currentTheme.value)
    applyCssTokens(currentTheme.value)
  }

  function toggleDark() {
    applyTheme(isDark.value ? 'light' : 'dark')
  }

  function toggleThemePanel() {
    toggleDark()
  }

  watch(currentTheme, applyCssTokens, { immediate: true })

  return {
    sidebarOpen,
    sidebarCollapsed,
    isDark,
    currentTheme,
    themes,
    applyTheme,
    toggleThemePanel,
    toggleDark,
    toggleSidebar,
    toggleSidebarCollapsed,
    toggleNavigation,
    closeSidebar,
    openSidebar,
    fetchTheme,
  }
})
