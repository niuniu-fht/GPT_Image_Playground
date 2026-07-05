import type { FormEvent } from 'react'
import type { CurrentUser } from '../../../types'

interface RedeemCreditsDialogProps {
  currentUser: CurrentUser
  redeemCode: string
  redeeming: boolean
  onChangeRedeemCode: (value: string) => void
  onClose: () => void
  onSubmit: (event: FormEvent) => void
}

export function RedeemCreditsDialog({
  currentUser,
  redeemCode,
  redeeming,
  onChangeRedeemCode,
  onClose,
  onSubmit,
}: RedeemCreditsDialogProps) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-gray-950/35 px-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/15 dark:border-white/[0.08] dark:bg-gray-900">
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-amber-600">积分兑换</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">输入兑换码领取积分</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">活动码和客服补偿码会立即到账，并写入积分流水。</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-100">
            当前余额 <span className="font-semibold">{currentUser.creditBalance}</span> 积分
          </div>
          <label className="block text-xs font-semibold text-gray-500">
            兑换码
            <input
              value={redeemCode}
              onChange={(event) => onChangeRedeemCode(event.target.value.toUpperCase())}
              placeholder="例如 SUMMER100"
              className="mt-1.5 h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 font-mono text-sm font-semibold tracking-wide text-gray-900 outline-none transition focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
              autoFocus
            />
          </label>
        </div>
        <div className="flex gap-2 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <button type="button" onClick={onClose} className="h-10 flex-1 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]">取消</button>
          <button disabled={redeeming || !redeemCode.trim()} className="h-10 flex-1 rounded-xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950">
            {redeeming ? '兑换中...' : '确认兑换'}
          </button>
        </div>
      </form>
    </div>
  )
}

