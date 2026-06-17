<script setup lang="ts">
defineProps<{
  placeholder?: string
  label?: string
  disabled?: boolean
  rows?: number
}>()

const model = defineModel<string>()
</script>

<template>
  <label class="base-field">
    <span v-if="label" class="base-field__label">{{ label }}</span>
    <ElInput
      v-model="model"
      type="textarea"
      :rows="rows || 3"
      :placeholder="placeholder"
      :disabled="disabled"
      class="base-textarea"
      v-bind="$attrs"
    />
  </label>
</template>

<style scoped>
.base-field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
}

.base-field__label {
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 650;
}

.base-textarea :deep(.el-textarea__inner) {
  border-radius: var(--theme-radius-md);
}
</style>
