<script setup lang="ts">
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
</script>

<template>
  <ElTooltip :content="appStore.isDark ? '切换到浅色模式' : '切换到深色模式'">
    <ElButton circle @click="appStore.toggleDark">
      <span v-if="appStore.isDark" class="i-carbon-sun" />
      <span v-else class="i-carbon-moon" />
    </ElButton>
  </ElTooltip>
</template>
