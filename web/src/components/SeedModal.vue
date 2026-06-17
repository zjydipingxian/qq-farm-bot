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
  seed_id: '',
  name: '',
  grow_phases: '',
  land_level_need: '',
  seasons: '1',
  fruit_count: '200',
  price: '',
  exp: '',
  size: '0',
})

const phaseTemplates = [
  { label: '4 小时（6 阶段）', value: '种子:2400;发芽:2400;小叶子:2400;大叶子:2400;开花:2400;成熟:0;' },
  { label: '8 小时（6 阶段）', value: '种子:4800;发芽:4800;小叶子:4800;大叶子:4800;开花:4800;成熟:0;' },
  { label: '12 小时（6 阶段）', value: '种子:7200;发芽:7200;小叶子:7200;大叶子:7200;开花:7200;成熟:0;' },
  { label: '24 小时（6 阶段）', value: '种子:14400;发芽:14400;小叶子:14400;大叶子:14400;开花:14400;成熟:0;' },
  { label: '自定义', value: 'custom' },
]

const selectedTemplate = ref('')

const seasonOptions = [
  { value: '1', label: '单季' },
  { value: '2', label: '双季' },
]

const sizeOptions = [
  { value: '0', label: '1x1（普通作物）' },
  { value: '2', label: '2x2（占 4 格）' },
  { value: '3', label: '3x3（占 9 格）' },
]

function handleTemplateChange() {
  if (selectedTemplate.value && selectedTemplate.value !== 'custom')
    form.grow_phases = selectedTemplate.value
}

function handleImageSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  const allowed = ['image/png', 'image/jpeg', 'image/webp']
  if (!allowed.includes(file.type)) {
    errorMessage.value = '仅支持 png、jpg、webp 格式图片'
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

function parseGrowTime(phases: string): number {
  if (!phases)
    return 0
  let total = 0
  const parts = phases.split(';').filter(Boolean)
  for (const part of parts) {
    const match = part.match(/:(\d+)$/)
    if (match?.[1])
      total += Number.parseInt(match[1])
  }
  return total
}

function formatTime(seconds: number): string {
  if (seconds < 60)
    return `${seconds}秒`
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return mins > 0 ? `${hours}时${mins}分` : `${hours}时`
}

async function submit() {
  errorMessage.value = ''
  const isEdit = !!props.editData

  if (!isEdit && (!form.seed_id || Number(form.seed_id) <= 0)) {
    errorMessage.value = '请输入有效的种子 ID'
    return
  }
  if (!form.name.trim()) {
    errorMessage.value = '请输入作物名称'
    return
  }
  if (!isEdit && !form.grow_phases.trim()) {
    errorMessage.value = '请填写生长阶段'
    return
  }
  if (!isEdit && (!form.land_level_need || Number(form.land_level_need) <= 0)) {
    errorMessage.value = '请输入有效的等级要求'
    return
  }
  if (!isEdit && (!form.fruit_count || Number(form.fruit_count) <= 0)) {
    errorMessage.value = '请输入有效的收获数量'
    return
  }
  if (!isEdit && (form.price === '' || form.price === undefined || form.price === null)) {
    errorMessage.value = '请输入种子价格'
    return
  }
  if (!isEdit && !imageFile.value) {
    errorMessage.value = '请上传种子图片'
    return
  }

  loading.value = true
  try {
    const formData = new FormData()
    formData.append('seed_id', form.seed_id)
    formData.append('name', form.name.trim())
    formData.append('grow_phases', form.grow_phases.trim())
    formData.append('land_level_need', form.land_level_need)
    formData.append('seasons', form.seasons)
    formData.append('fruit_count', form.fruit_count)
    formData.append('price', form.price)
    if (form.exp)
      formData.append('exp', form.exp)
    if (form.size)
      formData.append('size', form.size)
    if (imageFile.value)
      formData.append('image', imageFile.value)

    let res
    if (isEdit) {
      if (imageFile.value) {
        const editFormData = new FormData()
        editFormData.append('name', form.name.trim())
        editFormData.append('grow_phases', form.grow_phases.trim())
        editFormData.append('land_level_need', form.land_level_need)
        editFormData.append('seasons', form.seasons)
        editFormData.append('fruit_count', form.fruit_count)
        editFormData.append('price', form.price)
        if (form.exp)
          editFormData.append('exp', form.exp)
        if (form.size)
          editFormData.append('size', form.size)
        editFormData.append('image', imageFile.value)
        res = await api.put(`/api/config/seed/${form.seed_id}`, editFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          skipErrorToast: true,
        } as any)
      }
      else {
        res = await api.put(`/api/config/seed/${form.seed_id}`, {
          name: form.name.trim(),
          grow_phases: form.grow_phases.trim(),
          land_level_need: Number(form.land_level_need),
          seasons: Number(form.seasons),
          fruit_count: Number(form.fruit_count),
          price: Number(form.price),
          exp: Number(form.exp) || 0,
          size: Number(form.size) || 0,
        }, { skipErrorToast: true } as any)
      }
    }
    else {
      res = await api.post('/api/seed', formData, {
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
  if (!newVal)
    return

  errorMessage.value = ''
  imagePreview.value = ''
  imageFile.value = null
  selectedTemplate.value = ''
  if (props.editData) {
    const d = props.editData
    form.seed_id = String(d.seedId || '')
    form.name = d.name || ''
    form.grow_phases = d.growPhases || ''
    form.land_level_need = String(d.requiredLevel || '')
    form.seasons = String(d.seasons || '1')
    form.fruit_count = String(d.harvestCount || '200')
    form.price = String(d.price || '')
    form.exp = d.exp != null && d.exp !== 0 ? String(d.exp) : ''
    form.size = String(d.size || '0')

    const matched = phaseTemplates.find(t => t.value !== 'custom' && t.value === form.grow_phases)
    selectedTemplate.value = matched ? matched.value : 'custom'

    if (d.image)
      imagePreview.value = d.image
  }
  else {
    form.seed_id = ''
    form.name = ''
    form.grow_phases = ''
    form.land_level_need = ''
    form.seasons = '1'
    form.fruit_count = '200'
    form.price = ''
    form.exp = ''
    form.size = '0'
  }
})
</script>

<template>
  <ElDialog
    :model-value="show"
    :title="editData ? '编辑种子' : '种子录入'"
    width="560px"
    append-to-body
    destroy-on-close
    @close="close"
  >
    <div class="seed-modal">
      <ElAlert
        v-if="errorMessage"
        :title="errorMessage"
        type="error"
        show-icon
        :closable="false"
      />

      <section class="modal-section">
        <div class="section-title">
          基本信息
        </div>
        <div class="field-grid">
          <BaseInput v-model="form.seed_id" label="种子 ID" placeholder="如：20069" type="number" :disabled="!!editData" />
          <BaseInput v-model="form.name" label="作物名称" placeholder="如：草莓" />
          <BaseInput v-model="form.land_level_need" label="等级要求" placeholder="如：38" type="number" />
          <BaseSelect v-model="form.seasons" label="季节数" :options="seasonOptions" />
        </div>
      </section>

      <section class="modal-section">
        <div class="section-title">
          收益信息
        </div>
        <div class="field-grid">
          <BaseInput v-model="form.fruit_count" label="单次收获数量" placeholder="如：200" type="number" />
          <BaseInput v-model="form.price" label="种子价格（金币）" placeholder="0 表示免费" type="number" />
          <BaseInput v-model="form.exp" label="收获经验" placeholder="默认 0" type="number" />
          <BaseSelect v-model="form.size" label="作物大小" :options="sizeOptions" />
        </div>
      </section>

      <section class="modal-section">
        <div class="section-title">
          生长阶段
        </div>
        <BaseSelect
          v-model="selectedTemplate"
          label="快速模板"
          :options="phaseTemplates"
          @change="handleTemplateChange"
        />
        <BaseTextarea
          v-model="form.grow_phases"
          label="生长阶段配置"
          placeholder="格式：阶段名:秒数;阶段名:秒数; 如：种子:7200;发芽:7200;成熟:0;"
          :rows="3"
        />
        <p v-if="form.grow_phases" class="helper-line">
          总生长时间：{{ formatTime(parseGrowTime(form.grow_phases)) }}
        </p>
      </section>

      <section class="modal-section">
        <div class="section-title">
          种子图片
        </div>
        <div class="upload-row">
          <div v-if="imagePreview" class="image-preview">
            <img :src="imagePreview" alt="种子图片预览">
            <button type="button" aria-label="移除图片" @click="removeImage">
              <span class="i-carbon-close" />
            </button>
          </div>
          <label class="upload-trigger">
            <span class="i-carbon-upload" />
            <span>{{ imagePreview ? '更换图片' : '选择图片' }}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleImageSelect">
          </label>
          <span class="helper-line">支持 png、jpg、webp，最大 2MB</span>
        </div>
      </section>
    </div>

    <template #footer>
      <ElButton @click="close">
        取消
      </ElButton>
      <ElButton type="primary" :loading="loading" @click="submit">
        {{ editData ? '保存修改' : '录入种子' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<style scoped>
.seed-modal {
  max-height: min(68vh, 680px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding-right: 6px;
}

.modal-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-surface);
  padding: 14px;
}

.section-title {
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 700;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.helper-line {
  margin: 0;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.upload-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.image-preview {
  position: relative;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-surface-soft);
}

.image-preview img {
  max-width: 44px;
  max-height: 44px;
  object-fit: contain;
}

.image-preview button {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: 1px solid var(--theme-border);
  border-radius: 50%;
  background: var(--theme-surface);
  color: var(--theme-text-muted);
  cursor: pointer;
}

.upload-trigger {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px dashed var(--theme-border);
  border-radius: var(--theme-radius-md);
  color: var(--theme-primary);
  cursor: pointer;
  padding: 0 14px;
}

.upload-trigger:hover {
  border-color: var(--theme-primary);
  background: var(--theme-primary-soft);
}

.upload-trigger input {
  display: none;
}

@media (max-width: 560px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
