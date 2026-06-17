<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import api from '@/api'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'

const props = defineProps<{
  show: boolean
  editData?: any
}>()

const emit = defineEmits(['close', 'saved'])

const loading = ref(false)
const errorMessage = ref('')
const imagePreview = ref('')
const imageFile = ref<File | null>(null)

const form = reactive({
  id: '',
  type: '',
  name: '',
  priceId: '0',
  price: '0',
  interactionType: '',
  canUse: '0',
  desc: '',
  effectDesc: '',
  rarity: '0',
  maxCount: '9999',
  level: '0',
  assetName: '',
})

// 物品类型选项
const typeOptions = [
  { value: '', label: '请选择类型...' },
  { value: '1', label: '1 - 特殊道具' },
  { value: '2', label: '2 - 货币' },
  { value: '3', label: '3 - 经验' },
  { value: '4', label: '4 - 农场工具' },
  { value: '7', label: '7 - 化肥' },
  { value: '8', label: '8 - 宠物' },
  { value: '9', label: '9 - 宠物食品' },
  { value: '10', label: '10 - 头像框' },
  { value: '11', label: '11 - 礼品盒' },
  { value: '12', label: '12 - 收藏点' },
  { value: '13', label: '13 - 活跃点' },
  { value: '14', label: '14 - 解锁卡' },
  { value: '15', label: '15 - 高级货币' },
  { value: '16', label: '16 - 自选礼包' },
  { value: '17', label: '17 - 变异果实' },
  { value: '18', label: '18 - 皮肤/装饰' },
  { value: '23', label: '23 - 虫虫道具' },
]

// 货币类型选项
const priceIdOptions = [
  { value: '0', label: '金币' },
  { value: '1005', label: '金豆豆' },
  { value: '1004', label: '钻石' },
]

// 稀有度选项
const rarityOptions = [
  { value: '0', label: '0 - 普通' },
  { value: '1', label: '1 - 优秀' },
  { value: '2', label: '2 - 精良' },
  { value: '3', label: '3 - 稀有' },
  { value: '4', label: '4 - 史诗' },
  { value: '5', label: '5 - 传说' },
]

// 是否可使用
const canUseOptions = [
  { value: '0', label: '否' },
  { value: '1', label: '是' },
]

// 交互类型选项
const interactionTypeOptions = [
  { value: '', label: '无' },
  { value: 'plant', label: '种植 (plant)' },
  { value: 'harvest', label: '收获 (harvest)' },
  { value: 'erase', label: '铲除 (erase)' },
  { value: 'grass', label: '放草 (grass)' },
  { value: 'bug', label: '放虫 (bug)' },
  { value: 'fertilizer', label: '化肥 (fertilizer)' },
  { value: 'fertilizerbucket', label: '化肥容器 (fertilizerbucket)' },
  { value: 'box_new1', label: '宝箱 (box_new1)' },
]

function handleImageSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const allowed = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowed.includes(file.type)) {
    errorMessage.value = '仅支持 png, jpg, webp 格式图片'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    errorMessage.value = '图片大小不能超过 2MB'
    return
  }

  imageFile.value = file
  errorMessage.value = ''

  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

function removeImage() {
  imageFile.value = null
  imagePreview.value = ''
}

async function submit() {
  errorMessage.value = ''
  const isEdit = !!props.editData

  if (!isEdit && (!form.id || Number(form.id) <= 0)) {
    errorMessage.value = '请输入有效的物品ID'
    return
  }
  if (!isEdit && !form.type) {
    errorMessage.value = '请选择物品类型'
    return
  }
  if (!form.name.trim()) {
    errorMessage.value = '物品名称不能为空'
    return
  }

  loading.value = true
  try {
    let res
    if (isEdit) {
      if (imageFile.value) {
        const formData = new FormData()
        formData.append('name', form.name.trim())
        formData.append('price', form.price)
        formData.append('priceId', form.priceId)
        formData.append('interactionType', form.interactionType)
        formData.append('canUse', form.canUse)
        formData.append('desc', form.desc)
        formData.append('effectDesc', form.effectDesc)
        formData.append('rarity', form.rarity)
        formData.append('maxCount', form.maxCount)
        formData.append('level', form.level)
        formData.append('image', imageFile.value)
        res = await api.put(`/api/config/item/${form.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          skipErrorToast: true,
        } as any)
      }
      else {
        res = await api.put(`/api/config/item/${form.id}`, {
          name: form.name.trim(),
          price: Number(form.price),
          priceId: Number(form.priceId),
          interactionType: form.interactionType,
          canUse: Number(form.canUse),
          desc: form.desc,
          effectDesc: form.effectDesc,
          rarity: Number(form.rarity),
          maxCount: Number(form.maxCount),
          level: Number(form.level),
        }, { skipErrorToast: true } as any)
      }
    }
    else {
      const formData = new FormData()
      formData.append('id', form.id)
      formData.append('type', form.type)
      formData.append('name', form.name.trim())
      formData.append('priceId', form.priceId)
      formData.append('price', form.price)
      if (form.interactionType)
        formData.append('interactionType', form.interactionType)
      formData.append('canUse', form.canUse)
      if (form.desc)
        formData.append('desc', form.desc)
      if (form.effectDesc)
        formData.append('effectDesc', form.effectDesc)
      formData.append('rarity', form.rarity)
      formData.append('maxCount', form.maxCount)
      formData.append('level', form.level)
      if (form.assetName)
        formData.append('assetName', form.assetName)
      if (imageFile.value)
        formData.append('image', imageFile.value)
      res = await api.post('/api/config/item', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipErrorToast: true,
      } as any)
    }

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

function close() {
  emit('close')
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    errorMessage.value = ''
    imagePreview.value = ''
    imageFile.value = null
    if (props.editData) {
      const d = props.editData
      form.id = String(d.id || '')
      form.type = String(d.type || '')
      form.name = d.name || ''
      form.priceId = String(d.priceId || '0')
      form.price = String(d.price || '0')
      form.interactionType = d.interactionType || ''
      form.canUse = String(d.canUse || '0')
      form.desc = d.desc || ''
      form.effectDesc = d.effectDesc || ''
      form.rarity = String(d.rarity || '0')
      form.maxCount = String(d.maxCount || '9999')
      form.level = String(d.level || '0')
      form.assetName = d.assetName || ''

      if (d.image) {
        imagePreview.value = d.image
      }
    }
    else {
      form.id = ''
      form.type = ''
      form.name = ''
      form.priceId = '0'
      form.price = '0'
      form.interactionType = ''
      form.canUse = '0'
      form.desc = ''
      form.effectDesc = ''
      form.rarity = '0'
      form.maxCount = '9999'
      form.level = '0'
      form.assetName = ''
    }
  }
})
</script>

<template>
  <ElDialog
    :model-value="show"
    :title="editData ? '编辑道具' : '道具录入'"
    width="640px"
    append-to-body
    destroy-on-close
    @close="close"
  >
    <!-- Header -->
    <div class="hidden">
      <h3 class="text-lg font-semibold" style="color: var(--theme-primary, var(--theme-text))">
        🎒 {{ editData ? '编辑道具' : '道具录入' }}
      </h3>
      <ElButton text circle @click="close">
        <div class="i-carbon-close text-xl" :style="{ color: 'var(--theme-text)' }" />
      </ElButton>
    </div>

    <div class="config-entry-modal">
      <!-- 错误信息 -->
      <div v-if="errorMessage" class="mb-4 rounded-xl p-3 text-sm" style="background: rgba(239, 68, 68, 0.1); color: #ef4444">
        {{ errorMessage }}
      </div>

      <div class="space-y-4">
        <!-- 基本信息 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            📋 基本信息（必填）
          </div>
          <div class="field-grid">
            <BaseInput
              v-model="form.id"
              label="物品ID"
              placeholder="如: 80009"
              type="number"
              class="farm-input"
              :disabled="!!editData"
            />
            <BaseSelect
              v-model="form.type"
              label="物品类型"
              :options="typeOptions"
              class="farm-input"
              :disabled="!!editData"
            />
            <BaseInput
              v-model="form.name"
              label="物品名称"
              placeholder="如: 超级化肥"
              class="col-span-2 farm-input"
            />
          </div>
        </section>

        <!-- 价格信息 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            💰 价格信息
          </div>
          <div class="field-grid">
            <BaseSelect
              v-model="form.priceId"
              label="货币类型"
              :options="priceIdOptions"
              class="farm-input"
            />
            <BaseInput
              v-model="form.price"
              label="价格"
              placeholder="0"
              type="number"
              class="farm-input"
            />
          </div>
        </section>

        <!-- 属性信息 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            ⚙️ 属性信息
          </div>
          <div class="field-grid">
            <BaseSelect
              v-model="form.canUse"
              label="是否可使用"
              :options="canUseOptions"
              class="farm-input"
            />
            <BaseSelect
              v-model="form.rarity"
              label="稀有度"
              :options="rarityOptions"
              class="farm-input"
            />
            <BaseSelect
              v-model="form.interactionType"
              label="交互类型"
              :options="interactionTypeOptions"
              class="farm-input"
            />
            <BaseInput
              v-model="form.level"
              label="等级要求"
              placeholder="0"
              type="number"
              class="farm-input"
            />
            <BaseInput
              v-model="form.maxCount"
              label="最大堆叠"
              placeholder="9999"
              type="number"
              class="farm-input"
            />
            <BaseInput
              v-model="form.assetName"
              label="资源标识"
              placeholder="选填"
              class="farm-input"
            />
          </div>
        </section>

        <!-- 描述信息 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            📝 描述信息
          </div>
          <BaseTextarea
            v-model="form.desc"
            label="物品描述"
            placeholder="物品的详细描述..."
            :rows="2"
            class="farm-input"
          />
          <div class="mt-3">
            <BaseInput
              v-model="form.effectDesc"
              label="效果描述"
              placeholder="简短的效果说明"
              class="farm-input"
            />
          </div>
        </section>

        <!-- 图片 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            🖼️ 物品图片（选填）
          </div>
          <div class="flex items-center gap-3">
            <div
              v-if="imagePreview"
              class="relative h-16 w-16 flex shrink-0 items-center justify-center overflow-hidden border border-gray-200 rounded-lg bg-white dark:border-gray-600"
            >
              <img :src="imagePreview" class="h-14 w-14 object-contain">
              <button
                class="absolute h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-xs text-white -right-1 -top-1"
                @click="removeImage"
              >
                ✕
              </button>
            </div>
            <label
              class="flex cursor-pointer items-center gap-2 border border-gray-300 rounded-lg border-dashed px-4 py-3 text-sm text-gray-500 transition dark:border-gray-600 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500"
            >
              <span class="text-lg">📷</span>
              <span>{{ imagePreview ? '更换图片' : '选择图片' }}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="hidden"
                @change="handleImageSelect"
              >
            </label>
          </div>
          <div class="mt-1 text-xs text-gray-400">
            支持 png, jpg, webp 格式，最大 2MB
          </div>
        </section>

        <!-- 提交 -->
        <div class="flex justify-end gap-2 pt-2">
          <ElButton @click="close">
            取消
          </ElButton>
          <ElButton type="primary" :loading="loading" @click="submit">
            🎒 {{ editData ? '保存修改' : '录入道具' }}
          </ElButton>
        </div>
      </div>
    </div>
  </ElDialog>
</template>

<style scoped>
.config-entry-modal {
  max-height: min(68vh, 680px);
  overflow-y: auto;
  padding-right: 6px;
}

.config-entry-modal :deep(.space-y-4) {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.modal-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-md);
  background: var(--theme-surface);
  padding: 16px;
}

.modal-section > div:first-child {
  margin-bottom: 0;
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.config-entry-modal :deep(.farm-input),
.config-entry-modal :deep(.el-input),
.config-entry-modal :deep(.el-select) {
  width: 100%;
}

.config-entry-modal :deep(.farm-input.base-field),
.config-entry-modal :deep(.farm-input.base-select),
.config-entry-modal :deep(.farm-input.base-textarea) {
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.config-entry-modal :deep(.base-field__label),
.config-entry-modal :deep(.base-select__label),
.config-entry-modal :deep(.base-textarea__label) {
  color: var(--theme-text-muted);
  font-size: 12px;
  font-weight: 650;
}

.config-entry-modal :deep(.el-input__wrapper),
.config-entry-modal :deep(.el-select__wrapper),
.config-entry-modal :deep(.el-textarea__inner) {
  min-height: 36px;
  border-radius: var(--theme-radius-sm);
  box-shadow: 0 0 0 1px var(--theme-border) inset;
}

.config-entry-modal :deep(.col-span-2) {
  grid-column: 1 / -1;
}

.config-entry-modal :deep(.el-button) {
  margin-left: 0;
}

.config-entry-modal :deep(.flex.justify-end) {
  position: sticky;
  bottom: -1px;
  z-index: 1;
  margin: 0 -6px -1px;
  border-top: 1px solid var(--theme-border);
  background: var(--theme-surface);
  padding: 12px 6px 0;
}

@media (max-width: 640px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
