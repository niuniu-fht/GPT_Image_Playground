import { useRef, useState, type FormEvent } from 'react'
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape'

export interface ChangePasswordDraft {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface ChangePasswordErrors {
  currentPassword?: string
  newPassword?: string
  confirmPassword?: string
  form?: string
}

interface ChangePasswordDialogProps {
  draft: ChangePasswordDraft
  errors: ChangePasswordErrors
  submitting: boolean
  onChange: (draft: ChangePasswordDraft) => void
  onClearError: (field: keyof ChangePasswordErrors) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}

function PasswordInput({
  autoFocus,
  disabled,
  error,
  label,
  value,
  onChange,
}: {
  autoFocus?: boolean
  disabled: boolean
  error?: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</span>
      <div className="relative mt-1.5">
        <input
          autoFocus={autoFocus}
          type={visible ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={`h-11 w-full rounded-2xl border bg-gray-50 px-4 pr-16 text-sm outline-none transition focus:bg-white disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white/[0.04] dark:text-gray-100 ${
            error
              ? 'border-rose-300 focus:border-rose-400 dark:border-rose-400/40'
              : 'border-gray-200 focus:border-blue-400 dark:border-white/[0.08]'
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-white/[0.08]"
        >
          {visible ? '隐藏' : '显示'}
        </button>
      </div>
      {error && <span className="mt-1.5 block text-xs font-medium text-rose-600 dark:text-rose-300">{error}</span>}
    </label>
  )
}

export function ChangePasswordDialog({
  draft,
  errors,
  submitting,
  onChange,
  onClearError,
  onClose,
  onSubmit,
}: ChangePasswordDialogProps) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useCloseOnEscape(!submitting, () => closeRef.current())

  function updateField(field: keyof ChangePasswordDraft, value: string) {
    onChange({ ...draft, [field]: value })
    onClearError(field)
    onClearError('form')
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-gray-950/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[440px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/15 dark:border-white/[0.08] dark:bg-gray-900">
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-blue-600">账号安全</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">
                修改登录密码
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                修改后请使用新密码登录，当前会话会继续保持。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 dark:hover:bg-white/[0.06]"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5" noValidate>
          {errors.form && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
              {errors.form}
            </div>
          )}
          <PasswordInput
            autoFocus
            disabled={submitting}
            error={errors.currentPassword}
            label="当前密码"
            value={draft.currentPassword}
            onChange={(value) => updateField('currentPassword', value)}
          />
          <PasswordInput
            disabled={submitting}
            error={errors.newPassword}
            label="新密码"
            value={draft.newPassword}
            onChange={(value) => updateField('newPassword', value)}
          />
          <PasswordInput
            disabled={submitting}
            error={errors.confirmPassword}
            label="确认新密码"
            value={draft.confirmPassword}
            onChange={(value) => updateField('confirmPassword', value)}
          />
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
            新密码至少 8 位。建议不要与其他网站共用密码。
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="h-11 flex-1 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-11 flex-1 rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-gray-950"
            >
              {submitting ? '保存中...' : '保存新密码'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
