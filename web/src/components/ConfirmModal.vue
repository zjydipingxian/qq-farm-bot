<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue'

defineProps<{
  show: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'primary'
  isAlert?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity" @click="emit('cancel')">
    <div class="max-w-sm w-full transform rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-[var(--theme-shadow-lg)] transition-all" @click.stop>
      <h3 class="mb-3 text-lg text-[var(--theme-text)] font-semibold font-display">
        {{ title || '确认操作' }}
      </h3>
      <p class="mb-8 whitespace-pre-line text-sm text-[var(--theme-text-muted)] leading-relaxed">
        {{ message || '确定要执行此操作吗？' }}
      </p>
      <div class="flex justify-end gap-3">
        <BaseButton
          v-if="!isAlert"
          variant="secondary"
          class="cartoon-btn"
          :disabled="loading"
          @click="emit('cancel')"
        >
          {{ cancelText || '取消' }}
        </BaseButton>
        <BaseButton
          :variant="type === 'danger' ? 'danger' : 'primary'"
          class="cartoon-btn"
          :loading="loading"
          @click="emit('confirm')"
        >
          {{ confirmText || '确定' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
