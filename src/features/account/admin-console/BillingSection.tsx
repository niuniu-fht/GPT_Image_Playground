import type { CreditOrder, CreditPackage } from '../../../types'
import { AdminTableShell, EmptyState, formatTime, PaginationBar, SectionShell, StatusBadge, type CreditPackageDraft } from './shared'

function money(cents: number, currency: string) {
  const symbol = currency === 'CNY' ? '¥' : `${currency} `
  return `${symbol}${(cents / 100).toFixed(2)}`
}

function orderStatusTone(status: CreditOrder['status']) {
  if (status === 'paid') return 'green'
  if (status === 'cancelled') return 'gray'
  return 'amber'
}

function orderStatusLabel(status: CreditOrder['status']) {
  if (status === 'paid') return '已确认'
  if (status === 'cancelled') return '已取消'
  return '待确认'
}

type BillingSectionProps = {
  creditPackages: CreditPackage[]
  creditOrders: CreditOrder[]
  orderQuery: string
  orderStatus: string
  orderPage: number
  orderTotal: number
  setOrderQuery: (value: string) => void
  setOrderStatus: (value: string) => void
  setOrderPage: (value: number) => void
  openPackageEditor: (item?: CreditPackage) => void
  patchPackage: (id: string, input: Partial<CreditPackageDraft>) => void
  deletePackage: (id: string) => void
  patchOrder: (id: string, input: { status: 'paid' | 'cancelled'; adminNote?: string }) => void
}

export function BillingSection({
  creditPackages,
  creditOrders,
  orderQuery,
  orderStatus,
  orderPage,
  orderTotal,
  setOrderQuery,
  setOrderStatus,
  setOrderPage,
  openPackageEditor,
  patchPackage,
  deletePackage,
  patchOrder,
}: BillingSectionProps) {
  const pendingCount = creditOrders.filter((item) => item.status === 'pending').length
  const paidAmount = creditOrders.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.priceCents, 0)
  return (
    <SectionShell
      title="套餐订单"
      description="管理前台积分套餐和用户充值订单。第一版采用人工确认到账，后续可替换为支付回调。"
      action={<button onClick={() => openPackageEditor()} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">新增套餐</button>}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">上架套餐</div>
          <div className="mt-2 text-2xl font-bold">{creditPackages.filter((item) => item.enabled).length}</div>
          <div className="mt-1 text-xs text-gray-500">前台充值弹窗可见</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">待确认订单</div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{pendingCount}</div>
          <div className="mt-1 text-xs text-gray-500">需要管理员确认到账</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">当前页已确认金额</div>
          <div className="mt-2 text-2xl font-bold">{money(paidAmount, 'CNY')}</div>
          <div className="mt-1 text-xs text-gray-500">按订单快照统计</div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {creditPackages.map((item) => (
          <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="truncate text-base font-semibold">{item.name}</div>
                  {item.badge && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-300/10 dark:text-amber-200">{item.badge}</span>}
                </div>
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.description || '无说明'}</div>
              </div>
              <StatusBadge tone={item.enabled ? 'green' : 'gray'}>{item.enabled ? '上架' : '下架'}</StatusBadge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-xl bg-gray-50 px-2 py-2 dark:bg-white/[0.04]"><div className="font-semibold">{item.credits}</div><div className="text-xs text-gray-400">基础</div></div>
              <div className="rounded-xl bg-gray-50 px-2 py-2 dark:bg-white/[0.04]"><div className="font-semibold">{item.bonusCredits}</div><div className="text-xs text-gray-400">赠送</div></div>
              <div className="rounded-xl bg-gray-50 px-2 py-2 dark:bg-white/[0.04]"><div className="font-semibold">{money(item.priceCents, item.currency)}</div><div className="text-xs text-gray-400">价格</div></div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => openPackageEditor(item)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">编辑</button>
              <button onClick={() => patchPackage(item.id, { enabled: !item.enabled })} className="h-8 rounded-lg border border-blue-200 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400/20 dark:hover:bg-blue-400/10">{item.enabled ? '下架' : '上架'}</button>
              <button onClick={() => deletePackage(item.id)} className="h-8 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">删除</button>
            </div>
          </div>
        ))}
        {!creditPackages.length && <div className="lg:col-span-3"><EmptyState text="暂无积分套餐" /></div>}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] lg:flex-row">
        <input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="搜索订单号、用户、套餐、备注" className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
        <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-white/[0.08] dark:bg-gray-950">
          <option value="all">全部状态</option>
          <option value="pending">待确认</option>
          <option value="paid">已确认</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      <AdminTableShell
        mobileHint="横向滑动查看更多订单字段和操作"
        footer={<PaginationBar page={orderPage} pageSize={20} total={orderTotal} onPageChange={setOrderPage} />}
      >
        <div className="min-w-[1120px]">
            <div className="sticky top-0 z-20 grid grid-cols-[1.2fr_1.2fr_1fr_0.8fr_0.9fr_1fr_1.2fr_1.1fr] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
              <span>订单</span><span>用户</span><span>套餐</span><span className="text-right">金额</span><span className="text-right">积分</span><span>状态</span><span>时间</span><span className="text-right">操作</span>
            </div>
            {creditOrders.map((item) => (
              <div key={item.id} className="grid grid-cols-[1.2fr_1.2fr_1fr_0.8fr_0.9fr_1fr_1.2fr_1.1fr] items-center gap-4 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-white/[0.06]">
                <div className="min-w-0"><div className="truncate font-mono font-semibold">{item.orderNo}</div><div className="truncate text-xs text-gray-400">{item.paymentMethod}</div></div>
                <div className="min-w-0"><div className="truncate font-medium">{item.user?.email ?? item.userId}</div><div className="truncate text-xs text-gray-400">{item.userNote || '无用户备注'}</div></div>
                <div className="min-w-0"><div className="truncate font-semibold">{item.packageName}</div><div className="text-xs text-gray-400">赠送 {item.bonusCredits}</div></div>
                <div className="text-right font-semibold">{money(item.priceCents, item.currency)}</div>
                <div className="text-right font-semibold text-amber-700">{item.totalCredits}</div>
                <StatusBadge tone={orderStatusTone(item.status)}>{orderStatusLabel(item.status)}</StatusBadge>
                <div className="text-xs text-gray-500"><div>{formatTime(item.createdAt)}</div><div>{item.paidAt ? `到账 ${formatTime(item.paidAt)}` : item.cancelledAt ? `取消 ${formatTime(item.cancelledAt)}` : '等待处理'}</div></div>
                <div className="flex justify-end gap-2">
                  {item.status === 'pending' ? (
                    <>
                      <button onClick={() => patchOrder(item.id, { status: 'paid', adminNote: '人工确认到账' })} className="h-8 rounded-lg border border-emerald-200 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10">确认</button>
                      <button onClick={() => patchOrder(item.id, { status: 'cancelled', adminNote: '管理员取消订单' })} className="h-8 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">取消</button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">{item.adminNote || '已处理'}</span>
                  )}
                </div>
              </div>
            ))}
            {!creditOrders.length && <EmptyState text="暂无充值订单" />}
        </div>
      </AdminTableShell>
    </SectionShell>
  )
}
