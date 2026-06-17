<script setup lang="ts">
defineProps<{
  label?: string
  options?: { label: string, value: string | number, disabled?: boolean }[]
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  change: [value: string | number]
}>()

const model = defineModel<string | number>()
</script>

<template>
  <label class="base-field">
    <span v-if="label" class="base-field__label">{{ label }}</span>
    <ElSelect
      v-model="model"
      :placeholder="placeholder || '请选择'"
      :disabled="disabled"
      class="base-select"
      fit-input-width
      v-bind="$attrs"
      @change="emit('change', $event)"
    >
      <ElOption
        v-for="opt in options || []"
        :key="opt.value"
        :label="opt.label"
        :value="opt.value"
        :disabled="opt.disabled"
      >
        <slot name="option" :option="opt" :selected="model === opt.value">
          {{ opt.label }}
        </slot>
      </ElOption>
    </ElSelect>
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

.base-select {
  width: 100%;
}

.base-select :deep(.el-select__wrapper) {
  min-height: 38px;
  border-radius: var(--theme-radius-md);
}
</style>
