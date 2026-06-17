<script setup lang="ts">
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { RouterView } from 'vue-router'
import ToastContainer from '@/components/ToastContainer.vue'
</script>

<template>
  <ElConfigProvider :locale="zhCn" size="default" :z-index="3000">
    <div class="app-root">
      <RouterView />
      <ToastContainer />
    </div>
  </ElConfigProvider>
</template>
