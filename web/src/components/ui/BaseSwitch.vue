<script setup lang="ts">
defineProps<{
  label?: string
}>()

const model = defineModel<boolean>()
</script>

<template>
  <label class="base-switch">
    <ElSwitch v-model="model" v-bind="$attrs" />
    <span v-if="label" class="base-switch__label">{{ label }}</span>
  </label>
</template>

<style scoped>
.base-switch {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 10px;
}

.base-switch__label {
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 600;
}
</style>
