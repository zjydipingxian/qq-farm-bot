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
  borderSubtle: string
  primary: string
  primaryRgb: string
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
    bg: '#f8fafc',
    page: '#eef3f8',
    surface: '#ffffff',
    surfaceSoft: '#f5f7fb',
    text: '#172033',
    textMuted: '#667085',
    border: '#d8e0ec',
    borderSubtle: '#e7edf5',
    primary: '#2563eb',
    primaryRgb: '37, 99, 235',
    primarySoft: '#dbeafe',
    secondary: '#475569',
    success: '#0f766e',
    warning: '#c2410c',
    danger: '#dc2626',
    gradient: 'linear-gradient(135deg, #1e40af 0%, #0f172a 100%)',
  },
  dark: {
    isDark: true,
    bg: '#0b1120',
    page: '#111827',
    surface: '#172033',
    surfaceSoft: '#1f2a44',
    text: '#f8fafc',
    textMuted: '#a7b1c2',
    border: '#334155',
    borderSubtle: '#273449',
    primary: '#60a5fa',
    primaryRgb: '96, 165, 250',
    primarySoft: '#1e3a5f',
    secondary: '#94a3b8',
    success: '#2dd4bf',
    warning: '#fb923c',
    danger: '#f87171',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #0f172a 100%)',
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
  root.style.setProperty('--theme-border-subtle', t.borderSubtle)
  root.style.setProperty('--theme-primary', t.primary)
  root.style.setProperty('--theme-primary-rgb', t.primaryRgb)
  root.style.setProperty('--theme-primary-soft', t.primarySoft)
  root.style.setProperty('--theme-secondary', t.secondary)
  root.style.setProperty('--theme-success', t.success)
  root.style.setProperty('--theme-warning', t.warning)
  root.style.setProperty('--theme-danger', t.danger)
  root.style.setProperty('--theme-gradient', t.gradient)

  root.style.setProperty('--theme-radius-sm', '4px')
  root.style.setProperty('--theme-radius-md', '6px')
  root.style.setProperty('--theme-radius-lg', '8px')
  root.style.setProperty('--theme-radius-xl', '10px')
  root.style.setProperty('--theme-shadow-sm', '0 1px 2px rgba(15, 23, 42, 0.04)')
  root.style.setProperty('--theme-shadow-md', '0 8px 24px rgba(15, 23, 42, 0.07)')
  root.style.setProperty('--theme-shadow-lg', '0 18px 42px rgba(15, 23, 42, 0.12)')

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
  root.style.setProperty('--el-border-radius-base', '6px')
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
