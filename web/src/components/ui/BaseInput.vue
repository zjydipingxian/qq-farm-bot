<script setup lang="ts">
defineProps<{
  type?: string
  placeholder?: string
  label?: string
  disabled?: boolean
  clearable?: boolean
}>()

const emit = defineEmits<{
  clear: []
  keyup: [event: KeyboardEvent]
}>()

const model = defineModel<string | number>()
</script>

<template>
  <label class="base-field">
    <span v-if="label" class="base-field__label">{{ label }}</span>
    <ElInput
      v-model="model"
      :type="type || 'text'"
      :placeholder="placeholder"
      :disabled="disabled"
      :clearable="clearable"
      :show-password="type === 'password'"
      class="base-input"
      v-bind="$attrs"
      @clear="emit('clear')"
      @keyup="emit('keyup', $event)"
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
  font-weight: 600;
}

.base-input :deep(.el-input__wrapper) {
  min-height: 40px;
  border-radius: var(--theme-radius-md);
  box-shadow: 0 0 0 1px var(--theme-border) inset;
}

.base-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--theme-primary) inset, 0 0 0 3px color-mix(in srgb, var(--theme-primary) 14%, transparent);
}
</style>
