import { useState, type FormEvent } from 'react'
import { platformApi } from '../../lib/platformApi'
import { useStore } from '../../store'

export default function AuthModal() {
  const open = useStore((state) => state.authModalOpen)
  const mode = useStore((state) => state.authMode)
  const close = useStore((state) => state.closeAuthModal)
  const openAuthModal = useStore((state) => state.openAuthModal)
  const setCurrentUser = useStore((state) => state.setCurrentUser)
  const showToast = useStore((state) => state.showToast)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const isRegister = mode === 'register'

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      const result = isRegister
        ? await platformApi.register({ email, password })
        : await platformApi.login({ email, password })
      setCurrentUser(result.user)
      showToast(isRegister ? '注册成功，已赠送初始积分' : '登录成功', 'success')
      close()
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl shadow-gray-950/20 dark:bg-gray-930 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-white/[0.08]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-950 dark:text-gray-50">
                {isRegister ? '创建账号' : '欢迎回来'}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {isRegister ? '注册后立即获得初始积分，用于生成图像。' : '登录后使用平台模型和积分生成。'}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100"
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-100"
              placeholder="至少 8 位"
              minLength={8}
              required
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-slate-950 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950"
          >
            {submitting ? '处理中...' : isRegister ? '注册并领取积分' : '登录'}
          </button>
          <button
            type="button"
            onClick={() => openAuthModal(isRegister ? 'login' : 'register')}
            className="w-full text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-300"
          >
            {isRegister ? '已有账号，去登录' : '没有账号，立即注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
