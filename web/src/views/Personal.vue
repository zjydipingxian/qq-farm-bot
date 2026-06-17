<script setup lang="ts">
import { ref } from 'vue'
import BagPanel from '@/components/BagPanel.vue'
import FarmPanel from '@/components/FarmPanel.vue'
import TaskPanel from '@/components/TaskPanel.vue'

const currentTab = ref<'farm' | 'bag' | 'task'>('farm')

const tabOptions = [
  { value: 'farm', label: '我的农场', icon: 'i-carbon-sprout' },
  { value: 'bag', label: '我的背包', icon: 'i-carbon-box' },
  { value: 'task', label: '我的任务', icon: 'i-carbon-task' },
] as const
</script>

<template>
  <div class="personal-workspace">
    <div class="personal-tabs">
      <ElSegmented v-model="currentTab" :options="tabOptions" size="large">
        <template #default="{ item }">
          <div class="personal-tab-item">
            <span :class="item.icon" />
            <span>{{ item.label }}</span>
          </div>
        </template>
      </ElSegmented>
    </div>

    <div class="personal-content">
      <Transition
        mode="out-in"
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <component :is="currentTab === 'farm' ? FarmPanel : (currentTab === 'bag' ? BagPanel : TaskPanel)" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.personal-workspace {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.personal-tabs {
  display: flex;
  align-items: center;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-surface);
  padding: 8px;
}

.personal-tab-item {
  min-width: 108px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
}

.personal-content {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

@media (max-width: 640px) {
  .personal-tabs {
    overflow-x: auto;
  }

  .personal-tab-item {
    min-width: 96px;
  }
}
</style>
