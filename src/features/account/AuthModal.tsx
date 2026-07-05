import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getUserFacingErrorMessage, platformApi, PlatformApiError } from '../../lib/platformApi'
import { useStore } from '../../store'

interface AuthFormErrors {
  email?: string
  password?: string
  form?: string
  action?: 'switch_to_login'
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateAuthForm(email: string, password: string): AuthFormErrors {
  const errors: AuthFormErrors = {}
  const normalizedEmail = email.trim()
  if (!normalizedEmail) {
    errors.email = '请输入邮箱'
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = '邮箱格式不正确'
  }
  if (!password) {
    errors.password = '请输入密码'
  } else if (password.length < 8) {
    errors.password = '密码至少 8 位'
  }
  return errors
}

function focusAfterRender(input: HTMLInputElement | null) {
  window.requestAnimationFrame(() => {
    input?.focus()
  })
}

export default function AuthModal() {
  const open = useStore((state) => state.authModalOpen)
  const mode = useStore((state) => state.authMode)
  const close = useStore((state) => state.closeAuthModal)
  const openAuthModal = useStore((state) => state.openAuthModal)
  const setCurrentUser = useStore((state) => state.setCurrentUser)
  const setAppView = useStore((state) => state.setAppView)
  const showToast = useStore((state) => state.showToast)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<AuthFormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const wasOpenRef = useRef(false)

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email])

  const isRegister = mode === 'register'
  const title = isRegister ? '创建账号' : '欢迎回来'
  const subtitle = isRegister
    ? '注册后立即获得初始积分，开始生成并管理你的图片作品。'
    : '登录后继续生成图片、管理作品，并同步到作品广场。'
  const submitLabel = isRegister ? '注册并领取积分' : '登录'
  const submittingLabel = isRegister ? '注册中...' : '登录中...'
  const passwordHint = isRegister ? '至少 8 位，建议包含字母和数字。' : '请输入你的账号密码。'

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const focusTimer = window.setTimeout(() => {
        emailInputRef.current?.focus()
      }, 0)
      wasOpenRef.current = true
      return () => window.clearTimeout(focusTimer)
    }

    if (!open) {
      wasOpenRef.current = false
      setCapsLockOn(false)
      setShowPassword(false)
    }
  }, [open])

  if (!open) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextErrors = validateAuthForm(email, password)
    setErrors(nextErrors)
    if (nextErrors.email) {
      focusAfterRender(emailInputRef.current)
      return
    }
    if (nextErrors.password) {
      focusAfterRender(passwordInputRef.current)
      return
    }

    setSubmitting(true)
    try {
      const result = isRegister
        ? await platformApi.register({ email: normalizedEmail, password })
        : await platformApi.login({ email: normalizedEmail, password })
      setCurrentUser(result.user)
      setAppView('home')
      showToast(isRegister ? '注册成功，已赠送初始积分' : '登录成功', 'success')
      setErrors({})
      close()
    } catch (error) {
      const message = getUserFacingErrorMessage(error, isRegister ? '注册失败，请稍后重试' : '登录失败，请稍后重试')
      const nextErrors: AuthFormErrors = { form: message }
      if (error instanceof PlatformApiError) {
        if (error.code === 'email_exists') {
          nextErrors.email = '这个邮箱已经有账号'
          nextErrors.action = 'switch_to_login'
          focusAfterRender(emailInputRef.current)
        } else if (error.code === 'invalid_credentials') {
          nextErrors.password = '请检查密码是否正确'
          focusAfterRender(passwordInputRef.current)
        } else if (error.code === 'register_closed') {
          nextErrors.email = '当前暂不支持新用户注册'
          focusAfterRender(emailInputRef.current)
        }
      }
      setErrors(nextErrors)
      showToast(message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode() {
    setErrors({})
    setPassword('')
    setCapsLockOn(false)
    setShowPassword(false)
    openAuthModal(isRegister ? 'login' : 'register')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-md">
      <div className="w-full max-w-[440px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl shadow-slate-950/20 dark:border-white/[0.08] dark:bg-gray-900">
        <div className="border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white px-6 py-5 dark:border-white/[0.08] dark:from-white/[0.06] dark:to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
                造境 Proxima
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">{title}</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!submitting) close()
              }}
              disabled={submitting}
              className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5" noValidate>
          {errors.form && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
              <div>{errors.form}</div>
              {errors.action === 'switch_to_login' && (
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="mt-2 text-sm font-semibold text-rose-700 underline underline-offset-4 dark:text-rose-100"
                >
                  使用该邮箱登录
                </button>
              )}
            </div>
          )}
          <label className="block">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">邮箱</span>
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setErrors((prev) => ({ ...prev, email: undefined, form: undefined }))
              }}
              disabled={submitting}
              className={`mt-1.5 h-12 w-full rounded-2xl border bg-gray-50 px-4 text-sm outline-none transition focus:bg-white disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white/[0.04] dark:text-gray-100 ${
                errors.email
                  ? 'border-rose-300 focus:border-rose-400 dark:border-rose-400/40'
                  : 'border-gray-200 focus:border-blue-400 dark:border-white/[0.08]'
              }`}
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'auth-email-error' : undefined}
            />
            {errors.email && <span id="auth-email-error" className="mt-1.5 block text-xs font-medium text-rose-600 dark:text-rose-300">{errors.email}</span>}
          </label>
          <label className="block">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">密码</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{passwordHint}</span>
            </div>
            <div className="relative mt-1.5">
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setErrors((prev) => ({ ...prev, password: undefined, form: undefined }))
                }}
                onKeyUp={(event) => setCapsLockOn(event.getModifierState('CapsLock'))}
                onBlur={() => setCapsLockOn(false)}
                disabled={submitting}
                className={`h-12 w-full rounded-2xl border bg-gray-50 px-4 pr-16 text-sm outline-none transition focus:bg-white disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white/[0.04] dark:text-gray-100 ${
                  errors.password
                    ? 'border-rose-300 focus:border-rose-400 dark:border-rose-400/40'
                    : 'border-gray-200 focus:border-blue-400 dark:border-white/[0.08]'
                }`}
                placeholder="至少 8 位"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password || capsLockOn ? 'auth-password-message' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={submitting}
                className="absolute right-2 top-1/2 h-8 -translate-y-1/2 rounded-xl px-2.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:bg-white/[0.08]"
              >
                {showPassword ? '隐藏' : '显示'}
              </button>
            </div>
            {(errors.password || capsLockOn) && (
              <span id="auth-password-message" className={`mt-1.5 block text-xs font-medium ${errors.password ? 'text-rose-600 dark:text-rose-300' : 'text-amber-600 dark:text-amber-300'}`}>
                {errors.password ?? '大写锁定已开启'}
              </span>
            )}
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-gray-950"
          >
            {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white dark:border-gray-950/20 dark:border-t-gray-950" />}
            {submitting ? submittingLabel : submitLabel}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={switchMode}
            className="w-full rounded-2xl py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-400/10"
          >
            {isRegister ? '已有账号，去登录' : '没有账号，立即注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
