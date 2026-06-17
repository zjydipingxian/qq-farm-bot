<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const appVersion = __APP_VERSION__
const gameVersion = ref('')

const isLogin = ref(true)
const username = ref('')
const password = ref('')
const cardCode = ref('')
const error = ref('')
const success = ref('')
const loading = ref(false)
const showPasswordStrength = ref(false)
const lockoutRemaining = ref(0)
const rateLimitRemaining = ref(0)

const cardClaimEnabled = ref(false)
const cardClaimLoading = ref(false)
const showClaimModal = ref(false)
const claimModalContent = ref({
  success: true,
  title: '',
  message: '',
  cardCode: '',
  days: 0,
})

const passwordStrength = computed(() => {
  const pwd = password.value
  if (!pwd)
    return { score: 0, level: '', valid: false, color: 'var(--theme-text-muted)' }

  let score = 0
  if (pwd.length >= 6)
    score++
  if (pwd.length >= 10)
    score++

  let typeCount = 0
  if (/[a-z]/.test(pwd))
    typeCount++
  if (/[A-Z]/.test(pwd))
    typeCount++
  if (/\d/.test(pwd))
    typeCount++
  if (/[!@#$%^&*(),.?":{}|<>_\-+=[\]\\;'/`~]/.test(pwd))
    typeCount++

  if (typeCount >= 2)
    score += 2
  if (typeCount >= 3)
    score++
  if (typeCount >= 4)
    score++

  const commonPasswords = ['password', '123456', 'qwerty', 'abc123', '111111']
  if (commonPasswords.some(p => pwd.toLowerCase().includes(p)))
    score = Math.max(0, score - 2)

  const level = score <= 2 ? '弱' : score <= 4 ? '中' : score <= 6 ? '强' : '非常强'
  const color = score <= 2 ? 'var(--theme-danger)' : score <= 4 ? 'var(--theme-warning)' : 'var(--theme-success)'
  const valid = pwd.length >= 6 && typeCount >= 2

  return { score, level, color, valid }
})

const strengthPercent = computed(() => `${Math.min(passwordStrength.value.score * 12.5, 100)}%`)

const usernameValid = computed(() => {
  const name = username.value
  if (!name)
    return { valid: false, message: '' }
  if (name.length < 3)
    return { valid: false, message: '用户名至少 3 位' }
  if (name.length > 32)
    return { valid: false, message: '用户名最多 32 位' }
  if (!/^\w+$/.test(name))
    return { valid: false, message: '只能包含字母、数字、下划线' }
  return { valid: true, message: '' }
})

watch(password, () => {
  if (!isLogin.value && password.value)
    showPasswordStrength.value = true
})

function validateForm(): boolean {
  if (!username.value) {
    error.value = '请输入用户名'
    return false
  }

  if (!usernameValid.value.valid) {
    error.value = usernameValid.value.message
    return false
  }

  if (!password.value) {
    error.value = '请输入密码'
    return false
  }

  if (!isLogin.value) {
    if (password.value.length < 6) {
      error.value = '密码长度至少 6 位'
      return false
    }

    if (!passwordStrength.value.valid) {
      error.value = '密码强度不足：至少包含字母、数字、符号中的两类'
      return false
    }

    if (!cardCode.value) {
      error.value = '请输入卡密'
      return false
    }
  }

  return true
}

async function handleSubmit() {
  if (!validateForm())
    return

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    if (isLogin.value) {
      const result = await userStore.login(username.value, password.value)
      if (result.ok) {
        if (result.data?.mustChangePassword)
          success.value = '登录成功，请尽快修改默认密码以确保账号安全'
        setTimeout(() => {
          window.location.href = '/'
        }, 500)
      }
      else if (result.errorType === 'rate_limit') {
        error.value = result.error || '请求过于频繁，请稍后重试'
        if (result.remainingMs)
          rateLimitRemaining.value = Math.ceil(result.remainingMs / 1000)
      }
      else if (result.errorType === 'locked') {
        error.value = result.error || '账号已被锁定'
        if (result.remainingMs)
          lockoutRemaining.value = Math.ceil(result.remainingMs / 1000 / 60)
      }
      else {
        error.value = result.error || '登录失败'
      }
    }
    else {
      const result = await userStore.register(username.value, password.value, cardCode.value)
      if (result.ok) {
        success.value = '注册成功，请登录'
        isLogin.value = true
        cardCode.value = ''
        password.value = ''
      }
      else {
        error.value = result.error || '注册失败'
      }
    }
  }
  catch (e: any) {
    const data = e.response?.data
    if (data?.errorType === 'rate_limit') {
      error.value = data.error || '请求过于频繁'
      if (data.remainingMs)
        rateLimitRemaining.value = Math.ceil(data.remainingMs / 1000)
    }
    else if (data?.errorType === 'locked') {
      error.value = data.error || '账号已被锁定'
      if (data.remainingMs)
        lockoutRemaining.value = Math.ceil(data.remainingMs / 1000 / 60)
    }
    else {
      error.value = data?.error || e.message || '操作异常'
    }
  }
  finally {
    loading.value = false
  }
}

function toggleMode() {
  isLogin.value = !isLogin.value
  error.value = ''
  success.value = ''
  showPasswordStrength.value = false
  lockoutRemaining.value = 0
  rateLimitRemaining.value = 0
}

async function checkCardClaimStatus() {
  try {
    const res = await api.get('/api/card-claim/status')
    if (res.data.ok)
      cardClaimEnabled.value = res.data.enabled === true
  }
  catch (e) {
    console.error('检查卡密领取状态失败', e)
  }
}

async function claimFreeCard() {
  if (cardClaimLoading.value)
    return

  cardClaimLoading.value = true
  error.value = ''

  try {
    const res = await api.post('/api/card-claim/claim')

    if (res.data.ok) {
      cardCode.value = res.data.cardCode
      claimModalContent.value = {
        success: true,
        title: '领取成功',
        message: `成功领取 ${res.data.days} 天卡密，已自动填入注册表单。`,
        cardCode: res.data.cardCode,
        days: res.data.days,
      }
    }
    else {
      claimModalContent.value = {
        success: false,
        title: '领取失败',
        message: res.data.error || '领取失败，请稍后重试',
        cardCode: '',
        days: 0,
      }
    }
    showClaimModal.value = true
  }
  catch (e: any) {
    const data = e.response?.data
    claimModalContent.value = {
      success: false,
      title: '领取失败',
      message: data?.error || e.message || '领取失败',
      cardCode: '',
      days: 0,
    }
    showClaimModal.value = true
  }
  finally {
    cardClaimLoading.value = false
  }
}

function closeClaimModal() {
  showClaimModal.value = false
}

async function fetchGameVersion() {
  try {
    const res = await api.get('/api/game-version')
    if (res.data.ok)
      gameVersion.value = res.data.clientVersion
  }
  catch (e) {
    console.error('获取游戏版本失败', e)
  }
}

onMounted(() => {
  checkCardClaimStatus()
  fetchGameVersion()
})
</script>

<template>
  <main class="login-screen">
    <section class="login-intro">
      <div class="brand-mark">
        <span class="i-carbon-crop-growth" />
      </div>
      <h1>QQ 农场自动化控制台</h1>
      <p>集中管理账号、任务、日志和策略，面向长期运行的农场自动化后台。</p>

      <div class="intro-grid">
        <div class="intro-card">
          <span class="i-carbon-dashboard" />
          <strong>运行总览</strong>
          <small>状态、日志和资源指标集中展示</small>
        </div>
        <div class="intro-card">
          <span class="i-carbon-security" />
          <strong>账号安全</strong>
          <small>登录限流、锁定和卡密注册保留</small>
        </div>
        <div class="intro-card">
          <span class="i-carbon-data-table" />
          <strong>策略配置</strong>
          <small>后台风格，更适合高频操作</small>
        </div>
      </div>
    </section>

    <section class="auth-panel">
      <div class="auth-header">
        <div>
          <p class="eyebrow">
            {{ isLogin ? 'Sign in' : 'Create account' }}
          </p>
          <h2>{{ isLogin ? '登录控制台' : '创建新账号' }}</h2>
        </div>
        <ElTag effect="plain">
          v{{ appVersion }}
        </ElTag>
      </div>

      <form class="auth-form" @submit.prevent="handleSubmit">
        <BaseInput
          id="username"
          v-model="username"
          label="用户名"
          placeholder="3-32 位字母、数字或下划线"
          required
          clearable
        />
        <p v-if="username && !usernameValid.valid" class="field-error">
          {{ usernameValid.message }}
        </p>

        <BaseInput
          id="password"
          v-model="password"
          label="密码"
          type="password"
          placeholder="请输入密码"
          required
        />

        <div v-if="showPasswordStrength && password" class="strength-row">
          <div class="strength-track">
            <div
              class="strength-fill"
              :style="{ width: strengthPercent, background: passwordStrength.color }"
            />
          </div>
          <span :style="{ color: passwordStrength.color }">{{ passwordStrength.level }}</span>
        </div>

        <div v-if="!isLogin" class="card-code-group">
          <div class="card-code-toolbar">
            <span>卡密</span>
            <ElButton
              v-if="cardClaimEnabled"
              text
              type="primary"
              :loading="cardClaimLoading"
              @click="claimFreeCard"
            >
              免费领取
            </ElButton>
          </div>
          <BaseInput
            id="cardCode"
            v-model="cardCode"
            placeholder="请输入卡密"
            :required="!isLogin"
            clearable
          />
        </div>

        <ElAlert
          v-if="error"
          type="error"
          show-icon
          :closable="false"
        >
          <template #title>
            {{ error }}
            <span v-if="lockoutRemaining > 0">（{{ lockoutRemaining }} 分钟后解锁）</span>
            <span v-if="rateLimitRemaining > 0">（{{ rateLimitRemaining }} 秒后可重试）</span>
          </template>
        </ElAlert>

        <ElAlert
          v-if="success"
          :title="success"
          type="success"
          show-icon
          :closable="false"
        />

        <BaseButton
          type="submit"
          variant="primary"
          block
          :loading="loading"
          class="submit-btn"
        >
          {{ isLogin ? '登录' : '注册' }}
        </BaseButton>
      </form>

      <div class="auth-footer">
        <button type="button" @click="toggleMode">
          {{ isLogin ? '没有账号？立即注册' : '已有账号？返回登录' }}
        </button>
        <div class="version-line">
          <a
            href="https://github.com/XyhTender/qq-farm-automation-bot"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <span v-if="gameVersion">游戏版本 {{ gameVersion }}</span>
        </div>
      </div>
    </section>

    <ElDialog
      v-model="showClaimModal"
      :title="claimModalContent.title"
      width="420px"
      append-to-body
      @closed="closeClaimModal"
    >
      <div class="claim-result">
        <ElResult
          :icon="claimModalContent.success ? 'success' : 'error'"
          :title="claimModalContent.message"
        />
        <ElInput
          v-if="claimModalContent.success && claimModalContent.cardCode"
          :model-value="claimModalContent.cardCode"
          readonly
        />
      </div>
      <template #footer>
        <ElButton type="primary" @click="closeClaimModal">
          知道了
        </ElButton>
      </template>
    </ElDialog>
  </main>
</template>

<style scoped>
.login-screen {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 440px;
  gap: 40px;
  align-items: center;
  padding: clamp(24px, 5vw, 64px);
  background: var(--theme-page);
}

.login-intro {
  max-width: 680px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--theme-primary);
  color: white;
  font-size: 24px;
}

.login-intro h1 {
  margin: 24px 0 12px;
  color: var(--theme-text);
  font-size: clamp(34px, 4vw, 52px);
  line-height: 1.12;
  letter-spacing: 0;
}

.login-intro p {
  max-width: 560px;
  color: var(--theme-text-muted);
  font-size: 16px;
  line-height: 1.7;
}

.intro-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 36px;
}

.intro-card {
  min-height: 112px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  padding: 16px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: color-mix(in srgb, var(--theme-surface) 82%, transparent);
  box-shadow: none;
}

.intro-card > span {
  color: var(--theme-primary);
  font-size: 22px;
}

.intro-card strong {
  color: var(--theme-text);
}

.intro-card small {
  color: var(--theme-text-muted);
  line-height: 1.6;
}

.auth-panel {
  width: 100%;
  padding: 26px;
  border: 1px solid var(--theme-border);
  border-radius: var(--theme-radius-lg);
  background: var(--theme-surface);
  box-shadow: var(--theme-shadow-md);
}

.auth-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 26px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--theme-primary);
  font-size: 12px;
  font-weight: 750;
  text-transform: uppercase;
}

.auth-header h2 {
  margin: 0;
  color: var(--theme-text);
  font-size: 24px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-error {
  margin: -6px 0 0;
  color: var(--theme-danger);
  font-size: 12px;
}

.strength-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--theme-text-muted);
  font-size: 12px;
}

.strength-track {
  flex: 1;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--theme-surface-soft);
}

.strength-fill {
  height: 100%;
  transition:
    width var(--theme-duration),
    background var(--theme-duration);
}

.card-code-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-code-toolbar {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--theme-text);
  font-size: 13px;
  font-weight: 650;
}

.submit-btn {
  margin-top: 4px;
}

.auth-footer {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  margin-top: 22px;
}

.auth-footer button {
  border: 0;
  background: transparent;
  color: var(--theme-primary);
  font-weight: 650;
  cursor: pointer;
}

.version-line {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  color: var(--theme-text-subtle);
  font-size: 12px;
}

.version-line a {
  color: var(--theme-text-muted);
  text-decoration: none;
}

.claim-result :deep(.el-result) {
  padding: 0 0 16px;
}

@media (max-width: 900px) {
  .login-screen {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .intro-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .login-screen {
    padding: 18px;
  }

  .auth-panel {
    padding: 20px;
  }

  .login-intro h1 {
    font-size: 34px;
  }
}
</style>
