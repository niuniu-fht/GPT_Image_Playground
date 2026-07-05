import type { CreditOrder, CreditPackage, CurrentUser } from '../../../types'

interface TopupCreditsDialogProps {
  currentUser: CurrentUser
  creatingOrderId: string | null
  loading: boolean
  orders: CreditOrder[]
  packages: CreditPackage[]
  onClose: () => void
  onCreateOrder: (packageId: string) => void
}

function formatMoney(cents: number, currency: string) {
  const symbol = currency === 'CNY' ? '¥' : `${currency} `
  return `${symbol}${(cents / 100).toFixed(2)}`
}

function orderStatusLabel(status: CreditOrder['status']) {
  if (status === 'paid') return '已到账'
  if (status === 'cancelled') return '已取消'
  return '待确认'
}

function orderStatusClass(status: CreditOrder['status']) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200'
  if (status === 'cancelled') return 'bg-gray-100 text-gray-500 dark:bg-white/[0.06]'
  return 'bg-amber-50 text-amber-700 dark:bg-amber-300/10 dark:text-amber-200'
}

export function TopupCreditsDialog({
  currentUser,
  creatingOrderId,
  loading,
  orders,
  packages: creditPackages,
  onClose,
  onCreateOrder,
}: TopupCreditsDialogProps) {
  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-gray-950/35 px-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/15 dark:border-white/[0.08] dark:bg-gray-900">
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-blue-600">积分充值</div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 dark:text-gray-50">选择套餐提交订单</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">第一版采用人工确认到账；管理员确认后积分自动加入余额。</p>
            </div>
            <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-100">
            当前余额 <span className="font-semibold">{currentUser.creditBalance}</span> 积分
          </div>
          {loading ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/[0.08]">正在加载套餐...</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {creditPackages.map((item) => (
                <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <div className="flex min-h-[54px] items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-gray-950 dark:text-gray-50">{item.name}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.description}</div>
                    </div>
                    {item.badge && <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-300/10 dark:text-blue-200">{item.badge}</span>}
                  </div>
                  <div className="mt-5 text-3xl font-bold tracking-tight">{item.credits + item.bonusCredits}</div>
                  <div className="mt-1 text-xs text-gray-500">{item.credits} 基础积分 + {item.bonusCredits} 赠送</div>
                  <div className="mt-5 flex items-center justify-between">
                    <div className="text-lg font-semibold text-gray-950 dark:text-gray-50">{formatMoney(item.priceCents, item.currency)}</div>
                    <button
                      type="button"
                      disabled={creatingOrderId === item.id}
                      onClick={() => onCreateOrder(item.id)}
                      className="h-9 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-950"
                    >
                      {creatingOrderId === item.id ? '提交中' : '提交订单'}
                    </button>
                  </div>
                </div>
              ))}
              {!creditPackages.length && <div className="md:col-span-3 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/[0.08]">暂无上架套餐</div>}
            </div>
          )}
          <div className="mt-6">
            <div className="mb-3 text-sm font-semibold text-gray-950 dark:text-gray-50">最近订单</div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.08]">
              {orders.slice(0, 5).map((order) => (
                <div key={order.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-white/[0.06]">
                  <div className="min-w-0">
                    <div className="truncate font-mono font-semibold">{order.orderNo}</div>
                    <div className="mt-0.5 truncate text-xs text-gray-500">{order.packageName} · {order.totalCredits} 积分 · {new Date(order.createdAt).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${orderStatusClass(order.status)}`}>
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
              ))}
              {!orders.length && <div className="px-4 py-8 text-center text-sm text-gray-500">暂无订单</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

