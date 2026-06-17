<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
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
const plantList = ref<any[]>([])
const plantListLoading = ref(false)

const form = reactive({
  plantId: '',
  name: '',
  price: '',
  priceId: '0',
  fruitCount: '200',
  assetName: '',
  desc: '',
  effectDesc: '',
  rarity: '0',
  maxCount: '9999',
})

// 货币类型选项
const priceIdOptions = [
  { value: '0', label: '金币' },
  { value: '1005', label: '金豆豆' },
  { value: '1004', label: '钻石' },
]

// 稀有度选项
const rarityOptions = [
  { value: '0', label: '普通' },
  { value: '1', label: '优秀' },
  { value: '2', label: '精良' },
  { value: '3', label: '稀有' },
  { value: '4', label: '史诗' },
  { value: '5', label: '传说' },
]

// 植物选择下拉选项
const plantOptions = computed(() => {
  return plantList.value.map((p: any) => ({
    value: String(p.plantId),
    label: `${p.name} (种子${p.seedId} / 植物${p.plantId})`,
  }))
})

// 选中的植物
const selectedPlant = computed(() => {
  if (!form.plantId)
    return null
  return plantList.value.find((p: any) => String(p.plantId) === form.plantId) || null
})

// 加载植物列表
async function loadPlantList() {
  plantListLoading.value = true
  try {
    const { data } = await api.get('/api/config/plants')
    if (data?.ok)
      plantList.value = data.data || []
  }
  catch { /* ignore */ }
  finally { plantListLoading.value = false }
}

// 选择植物后自动填充
function handlePlantChange() {
  const plant = selectedPlant.value
  if (plant) {
    form.name = plant.name
    form.assetName = '生产'
    form.fruitCount = String(plant.harvestCount || 200)
    form.desc = `${plant.name}的果实，可以出售换取金币。`
    form.effectDesc = plant.name
  }
}

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

  if (!isEdit && !form.plantId) {
    errorMessage.value = '请选择关联的植物'
    return
  }
  if (!form.name.trim()) {
    errorMessage.value = '果实名称不能为空'
    return
  }
  if (form.price === '' || Number(form.price) < 0) {
    errorMessage.value = '请输入有效的售价'
    return
  }

  loading.value = true
  try {
    let res
    if (isEdit) {
      if (imageFile.value) {
        const editFormData = new FormData()
        editFormData.append('name', form.name.trim())
        editFormData.append('price', form.price)
        editFormData.append('priceId', form.priceId)
        editFormData.append('desc', form.desc)
        editFormData.append('effectDesc', form.effectDesc)
        editFormData.append('rarity', form.rarity)
        editFormData.append('image', imageFile.value)
        res = await api.put(`/api/config/fruit/${props.editData.id}`, editFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          skipErrorToast: true,
        } as any)
      }
      else {
        res = await api.put(`/api/config/fruit/${props.editData.id}`, {
          name: form.name.trim(),
          price: Number(form.price),
          priceId: Number(form.priceId),
          desc: form.desc,
          effectDesc: form.effectDesc,
          rarity: Number(form.rarity),
        }, { skipErrorToast: true } as any)
      }
    }
    else {
      const formData = new FormData()
      formData.append('plantId', form.plantId)
      formData.append('name', form.name.trim())
      formData.append('price', form.price)
      formData.append('priceId', form.priceId)
      formData.append('fruitCount', form.fruitCount)
      if (form.assetName)
        formData.append('assetName', form.assetName)
      if (form.desc)
        formData.append('desc', form.desc)
      if (form.effectDesc)
        formData.append('effectDesc', form.effectDesc)
      if (form.rarity)
        formData.append('rarity', form.rarity)
      if (form.maxCount)
        formData.append('maxCount', form.maxCount)
      if (imageFile.value)
        formData.append('image', imageFile.value)
      res = await api.post('/api/config/fruit', formData, {
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
      form.plantId = String(d.plantId || '')
      form.name = d.name || ''
      form.price = String(d.price || '')
      form.priceId = String(d.priceId || '0')
      form.fruitCount = String(d.fruitCount || '200')
      form.assetName = d.assetName || ''
      form.desc = d.desc || ''
      form.effectDesc = d.effectDesc || ''
      form.rarity = String(d.rarity || '0')
      form.maxCount = String(d.maxCount || '9999')

      if (d.image) {
        imagePreview.value = d.image
      }
    }
    else {
      form.plantId = ''
      form.name = ''
      form.price = ''
      form.priceId = '0'
      form.fruitCount = '200'
      form.assetName = ''
      form.desc = ''
      form.effectDesc = ''
      form.rarity = '0'
      form.maxCount = '9999'
    }
    loadPlantList()
  }
})
</script>

<template>
  <ElDialog
    :model-value="show"
    :title="editData ? '编辑果实' : '果实录入'"
    width="640px"
    append-to-body
    destroy-on-close
    @close="close"
  >
    <!-- Header -->
    <div class="hidden">
      <h3 class="text-lg font-semibold" style="color: var(--theme-primary, var(--theme-text))">
        🍎 {{ editData ? '编辑果实' : '果实录入' }}
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
        <!-- 关联植物 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            🌱 关联植物（必填）
          </div>
          <div v-if="plantListLoading" class="py-3 text-center text-sm text-gray-400">
            加载植物列表中...
          </div>
          <BaseSelect
            v-else
            v-model="form.plantId"
            label="选择植物"
            :options="[{ value: '', label: '请选择...' }, ...plantOptions]"
            class="farm-input"
            :disabled="!!editData"
            @update:model-value="handlePlantChange"
          />
          <div v-if="selectedPlant" class="mt-2 rounded-lg bg-green-50 p-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <div>种子ID: {{ selectedPlant.seedId }} | 植物ID: {{ selectedPlant.plantId }}</div>
            <div v-if="selectedPlant.fruitId" class="mt-1 text-orange-500">
              ⚠️ 该植物已有果实 (ID: {{ selectedPlant.fruitId }})，录入将被拒绝
            </div>
          </div>
        </section>

        <!-- 基本信息 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            📋 基本信息
          </div>
          <div class="field-grid">
            <BaseInput
              v-model="form.name"
              label="果实名称"
              placeholder="选择植物后自动填充"
              class="farm-input"
            />
            <BaseInput
              v-model="form.fruitCount"
              label="收获数量"
              placeholder="200"
              type="number"
              class="farm-input"
              :disabled="!!editData"
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
              label="售价"
              placeholder="0"
              type="number"
              class="farm-input"
            />
          </div>
        </section>

        <!-- 选填信息 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            📝 选填信息
          </div>
          <div class="field-grid">
            <BaseSelect
              v-model="form.rarity"
              label="稀有度"
              :options="rarityOptions"
              class="farm-input"
            />
          </div>
          <div class="mt-3">
            <BaseTextarea
              v-model="form.desc"
              label="描述"
              placeholder="选择植物后自动填充"
              :rows="2"
              class="farm-input"
            />
          </div>
        </section>

        <!-- 图片 -->
        <section class="modal-section">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            🖼️ 果实图片（选填）
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
            支持 png, jpg, webp 格式，最大 2MB。未上传则复用种子图片。
          </div>
        </section>

        <!-- 提交 -->
        <div class="flex justify-end gap-2 pt-2">
          <ElButton @click="close">
            取消
          </ElButton>
          <ElButton type="primary" :loading="loading" @click="submit">
            🍎 {{ editData ? '保存修改' : '录入果实' }}
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
