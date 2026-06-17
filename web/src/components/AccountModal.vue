<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import api from '@/api'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'

const props = defineProps<{
  show: boolean
  editData?: any
}>()

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const errorMessage = ref('')

const form = reactive({
  name: '',
  code: '',
  platform: 'qq' as 'qq' | 'wx',
})

async function addAccount(data: any) {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await api.post('/api/accounts', data)
    if (res.data.ok) {
      emit('saved')
      close()
    }
    else {
      errorMessage.value = `保存失败: ${res.data.error}`
    }
  }
  catch (e: any) {
    errorMessage.value = `保存失败: ${e.response?.data?.error || e.message}`
  }
  finally {
    loading.value = false
  }
}

async function submitManual() {
  errorMessage.value = ''
  if (!form.code) {
    errorMessage.value = '请输入 Code'
    return
  }

  let code = form.code.trim()
  const match = code.match(/[?&]code=([^&]+)/i)
  if (match && match[1]) {
    code = decodeURIComponent(match[1])
    form.code = code
  }

  let payload: any = {}
  if (props.editData) {
    const onlyNameChanged = form.name !== props.editData.name
      && form.code === (props.editData.code || '')
      && form.platform === (props.editData.platform || 'qq')

    if (onlyNameChanged) {
      payload = { id: props.editData.id, name: form.name }
    }
    else {
      payload = {
        id: props.editData.id,
        name: form.name,
        code,
        platform: form.platform,
        loginType: 'manual',
      }
    }
  }
  else {
    payload = {
      name: form.name,
      code,
      platform: form.platform,
      loginType: 'manual',
    }
  }

  await addAccount(payload)
}

function close() {
  emit('close')
}

watch(() => props.show, (newVal) => {
  if (!newVal)
    return

  errorMessage.value = ''
  if (props.editData) {
    form.name = props.editData.name || ''
    form.code = props.editData.code || ''
    form.platform = props.editData.platform || 'qq'
  }
  else {
    form.name = ''
    form.code = ''
    form.platform = 'qq'
  }
})
</script>

<template>
  <ElDialog
    :model-value="show"
    :title="editData ? '编辑账号' : '添加账号'"
    width="448px"
    append-to-body
    destroy-on-close
    @close="close"
  >
    <div class="modal-form">
      <ElAlert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />

      <BaseInput
        v-model="form.name"
        label="账号备注（可选）"
        placeholder="留空默认账号"
        clearable
      />

      <BaseTextarea
        v-model="form.code"
        label="Code"
        placeholder="请输入登录 Code"
        :rows="4"
      />

      <ElRadioGroup v-if="!editData" v-model="form.platform">
        <ElRadio value="qq">
          QQ 小程序
        </ElRadio>
        <ElRadio value="wx">
          微信小程序
        </ElRadio>
      </ElRadioGroup>
    </div>

    <template #footer>
      <ElButton @click="close">
        取消
      </ElButton>
      <ElButton type="primary" :loading="loading" @click="submitManual">
        {{ editData ? '保存' : '添加' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
