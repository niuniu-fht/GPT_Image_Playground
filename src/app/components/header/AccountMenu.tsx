import { useEffect, useRef, useState } from 'react'
import type { CurrentUser } from '../../../types'
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape'

interface AccountMenuProps {
  currentUser: CurrentUser
  onAdmin: () => void
  onChangePassword: () => void
  onFeedback: () => void
  onLogout: () => void
  onRedeem: () => void
}

interface MenuAction {
  label: string
  description: string
  tone?: 'default' | 'danger'
  onClick: () => void
}

function userInitial(email: string): string {
  return email.trim().slice(0, 1).toUpperCase() || 'U'
}

function shortEmail(email: string): string {
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name}@${domain}`
}

export function AccountMenu({
  currentUser,
  onAdmin,
  onChangePassword,
  onFeedback,
  onLogout,
  onRedeem,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false)
  const closeTimerRef = useRef<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const close = () => setOpen(false)
  useCloseOnEscape(open, close)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }

  function scheduleClose() {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => close(), 140)
  }

  function runAction(action: () => void) {
    close()
    action()
  }

  const primaryActions: MenuAction[] = [
    { label: '兑换码', description: '输入兑换码增加余额', onClick: onRedeem },
    { label: '反馈与工单', description: '查看处理进度，提交问题', onClick: onFeedback },
    { label: '修改密码', description: '更新当前账号登录密码', onClick: onChangePassword },
  ]
  const adminActions: MenuAction[] =
    currentUser.role === 'admin'
      ? [{ label: '运营后台', description: '用户、模型、广场配置', onClick: onAdmin }]
      : []
  const dangerActions: MenuAction[] = [
    { label: '退出登录', description: '结束当前会话', tone: 'danger', onClick: onLogout },
  ]
  const groups = [primaryActions, adminActions, dangerActions].filter((group) => group.length > 0)

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        clearCloseTimer()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 max-w-[190px] items-center gap-2 rounded-full border border-gray-200/80 bg-white/95 px-2.5 pr-3 text-xs font-medium text-gray-800 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:border-white/[0.08] dark:bg-gray-900/95 dark:text-gray-100 dark:hover:bg-white/[0.06] dark:focus:ring-white/20"
        aria-haspopup="menu"
        aria-expanded={open}
        title={currentUser.email}
      >
        <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-slate-950 text-[11px] font-bold text-white dark:bg-white dark:text-gray-950">
          {userInitial(currentUser.email)}
        </span>
        <span className="hidden min-w-0 truncate sm:block">{shortEmail(currentUser.email)}</span>
        <span className="text-gray-400" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-50 w-[262px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_14px_42px_rgba(15,23,42,0.16)] ring-1 ring-black/[0.03] dark:border-white/[0.08] dark:bg-gray-950 dark:shadow-[0_18px_52px_rgba(0,0,0,0.42)]"
        >
          <div className="border-b border-gray-100 bg-gray-50/70 px-3 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-slate-950 text-xs font-bold text-white dark:bg-white dark:text-gray-950">
                {userInitial(currentUser.email)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-gray-950 dark:text-gray-50">
                  {currentUser.email}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{currentUser.role === 'admin' ? '管理员' : '普通用户'}</span>
                  <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span>{currentUser.creditBalance} 积分</span>
                </div>
              </div>
            </div>
          </div>

          <div className="py-2">
            {groups.map((group, groupIndex) => (
              <div
                key={group.map((item) => item.label).join('-')}
                className={groupIndex > 0 ? 'border-t border-gray-100 py-1.5 dark:border-white/[0.08]' : 'pb-1.5'}
              >
                {group.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => runAction(item.onClick)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition ${
                      item.tone === 'danger'
                        ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-400/10'
                        : 'text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-5">{item.label}</span>
                      <span className="mt-0.5 block truncate text-[11px] leading-4 text-gray-400 dark:text-gray-500">
                        {item.description}
                      </span>
                    </span>
                    <span className="text-sm text-gray-300 dark:text-gray-600" aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
