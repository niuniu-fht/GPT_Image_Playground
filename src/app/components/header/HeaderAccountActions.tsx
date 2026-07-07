import type { CurrentUser } from '../../../types'
import { AccountMenu } from './AccountMenu'

interface HeaderAccountActionsProps {
  currentUser: CurrentUser | null
  onAdmin: () => void
  onChangePassword: () => void
  onFeedback: () => void
  onLogin: () => void
  onLogout: () => void
  onRedeem: () => void
}

export function HeaderAccountActions({
  currentUser,
  onAdmin,
  onChangePassword,
  onFeedback,
  onLogin,
  onLogout,
  onRedeem,
}: HeaderAccountActionsProps) {
  if (!currentUser) {
    return (
      <button
        type="button"
        onClick={onLogin}
        className="ml-1 inline-flex h-8 items-center rounded-full bg-slate-950 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950"
      >
        登录
      </button>
    )
  }

  return (
    <div className="ml-1 flex items-center gap-1.5">
      <button
        type="button"
        onClick={onRedeem}
        className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 transition hover:-translate-y-px hover:border-amber-300 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300/50 sm:inline-flex dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-200 dark:hover:bg-amber-300/15 dark:focus:ring-amber-200/20"
        title="点击输入兑换码"
      >
        积分 {currentUser.creditBalance}
      </button>
      <AccountMenu
        currentUser={currentUser}
        onAdmin={onAdmin}
        onChangePassword={onChangePassword}
        onFeedback={onFeedback}
        onLogout={onLogout}
        onRedeem={onRedeem}
      />
    </div>
  )
}
