<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline' | 'text'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  block?: boolean
  to?: string
  href?: string
  type?: 'button' | 'submit' | 'reset'
}>()

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const elType = computed(() => {
  if (props.variant === 'danger')
    return 'danger'
  if (props.variant === 'success')
    return 'success'
  if (props.variant === 'secondary')
    return 'info'
  if (props.variant === 'outline')
    return 'primary'
  if (props.variant === 'text' || props.variant === 'ghost')
    return 'primary'
  return 'primary'
})

const elSize = computed(() => {
  if (props.size === 'sm')
    return 'small'
  if (props.size === 'lg')
    return 'large'
  return 'default'
})

const linkTarget = computed(() => props.to || props.href || '')

const buttonClass = computed(() => [
  'base-button',
  {
    'base-button--block': props.block,
    'base-button--ghost': props.variant === 'ghost',
    'base-button--text': props.variant === 'text',
  },
])

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading)
    emit('click', event)
}
</script>

<template>
  <RouterLink
    v-if="to"
    :to="linkTarget"
    class="base-button-link"
  >
    <ElButton
      :class="buttonClass"
      :type="elType"
      :size="elSize"
      :loading="loading"
      :disabled="disabled"
      :plain="variant === 'outline'"
      :text="variant === 'text' || variant === 'ghost'"
      v-bind="$attrs"
      @click="handleClick"
    >
      <slot />
    </ElButton>
  </RouterLink>
  <a
    v-else-if="href"
    :href="href"
    class="base-button-link"
  >
    <ElButton
      :class="buttonClass"
      :type="elType"
      :size="elSize"
      :loading="loading"
      :disabled="disabled"
      :plain="variant === 'outline'"
      :text="variant === 'text' || variant === 'ghost'"
      v-bind="$attrs"
      @click="handleClick"
    >
      <slot />
    </ElButton>
  </a>
  <ElButton
    v-else
    :class="buttonClass"
    :type="elType"
    :size="elSize"
    :loading="loading"
    :disabled="disabled"
    :native-type="type || 'button'"
    :plain="variant === 'outline'"
    :text="variant === 'text' || variant === 'ghost'"
    v-bind="$attrs"
    @click="handleClick"
  >
    <slot />
  </ElButton>
</template>

<style scoped>
.base-button {
  min-height: 38px;
  border-radius: var(--theme-radius-md);
  font-weight: 600;
  letter-spacing: 0;
}

.base-button--block {
  width: 100%;
}

.base-button--ghost {
  color: var(--theme-text-muted);
}

.base-button--text {
  min-height: auto;
  padding: 0;
}

.base-button-link {
  display: inline-flex;
  text-decoration: none;
}
</style>
