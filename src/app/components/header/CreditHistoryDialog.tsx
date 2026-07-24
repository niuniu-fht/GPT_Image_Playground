import type { FormEvent } from 'react'
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape'
import type { CreditLedgerEntry, CreditLedgerFilter, CreditLedgerSummary } from '../../../types'

interface CreditHistoryDialogProps {
  items: CreditLedgerEntry[]
  summary: CreditLedgerSummary | null
  filter: CreditLedgerFilter
  query: string
  page: number
  pageSize: number
  total: number
  loading: boolean
  error: string
  onChangeFilter: (filter: CreditLedgerFilter) => void
  onChangeQuery: (query: string) => void
  onSearch: (query: string) => void
  onChangePage: (page: number) => void
  onClose: () => void
  onRedeem: () => void
  onRefresh: () => void
}

const filters: Array<{ value: CreditLedgerFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'redeem', label: '兑换' },
  { value: 'consume', label: '使用消耗' },
  { value: 'refund', label: '失败返还' },
]

function formatTime(value: string): string {
  return new Date(value).toLocaleString()
}

function formatCredits(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`
}

function ledgerKind(item: CreditLedgerEntry): { label: string; className: string } {
  if (item.reason.startsWith('兑换码：')) {
    return { label: '兑换', className: 'bg-amber-50 text-amber-700 dark:bg-amber-300/10 dark:text-amber-200' }
  }
  if (item.delta < 0) {
    return { label: '消耗', className: 'bg-rose-50 text-rose-700 dark:bg-rose-300/10 dark:text-rose-200' }
  }
  if (item.reason.includes('退回') || item.reason.includes('退款') || item.reason.includes('返还')) {
    return { label: '返还', className: 'bg-blue-50 text-blue-700 dark:bg-blue-300/10 dark:text-blue-200' }
  }
  return { label: '收入', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200' }
}

export function CreditHistoryDialog({
  items,
  summary,
  filter,
  query,
  page,
  pageSize,
  total,
  loading,
  error,
  onChangeFilter,
  onChangeQuery,
  onSearch,
  onChangePage,
  onClose,
  onRedeem,
  onRefresh,
}: CreditHistoryDialogProps) {
  useCloseOnEscape(true, onClose)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch(query)
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-gray-950/35 px-3 py-4 backdrop-blur-sm sm:px-6">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-950/15 dark:border-white/[0.08] dark:bg-gray-900">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08] sm:px-6">
          <div>
            <div className="text-sm font-semibold text-amber-600 dark:text-amber-300">积分账户</div>
            <h2 className="mt-1 text-xl font-semibold text-gray-950 dark:text-gray-50">积分使用记录</h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onRedeem} className="h-9 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">兑换积分</button>
            <button type="button" onClick={onRefresh} disabled={loading} aria-label="刷新积分记录" title="刷新积分记录" className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 text-lg text-gray-500 transition hover:bg-gray-50 disabled:opacity-45 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">↻</button>
            <button type="button" onClick={onClose} aria-label="关闭积分记录" className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
          </div>
        </header>

        <div className="grid grid-cols-2 border-b border-gray-100 bg-gray-50/80 dark:border-white/[0.08] dark:bg-white/[0.03] sm:grid-cols-5">
          {[
            ['当前余额', summary?.currentBalance ?? 0],
            ['累计收入', summary?.totalIncome ?? 0],
            ['累计消耗', summary?.totalSpent ?? 0],
            ['兑换到账', summary?.totalRedeemed ?? 0],
            ['失败返还', summary?.totalRefunded ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-r border-gray-100 px-4 py-3 last:border-r-0 dark:border-white/[0.06] sm:border-b-0">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="mt-1 text-lg font-semibold text-gray-950 dark:text-gray-50">{Number(value).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-white/[0.08] sm:px-6">
          <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-white/[0.06]" aria-label="积分记录分类">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onChangeFilter(item.value)}
                className={`h-8 rounded-md px-3 text-xs font-semibold transition ${filter === item.value ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <form onSubmit={submitSearch} className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:min-w-[280px]">
            <input
              value={query}
              onChange={(event) => onChangeQuery(event.target.value)}
              placeholder="检索生成提示词"
              className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-amber-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
            />
            {query && (
              <button type="button" onClick={() => { onChangeQuery(''); onSearch('') }} className="h-9 px-2 text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">清除</button>
            )}
            <button type="submit" disabled={loading} className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-200 dark:hover:bg-white/[0.06]">检索</button>
          </form>
          <span className="text-xs text-gray-400">共 {total} 条，累计 {summary?.recordCount ?? 0} 条记录</span>
        </div>

        <div className="min-h-[260px] flex-1 overflow-auto">
          {error && <div className="m-4 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{error}</div>}
          {loading && !items.length ? (
            <div className="grid min-h-[260px] place-items-center text-sm text-gray-500">正在加载积分记录...</div>
          ) : (
            <>
              <div className="sticky top-0 z-10 hidden grid-cols-[90px_minmax(220px,1fr)_100px_110px_160px] gap-3 border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22] md:grid">
                <span>类型</span><span>说明</span><span className="text-right">变动</span><span className="text-right">余额</span><span>时间</span>
              </div>
              {items.map((item) => {
                const kind = ledgerKind(item)
                return (
                  <div key={item.id} className="grid gap-2 border-b border-gray-100 px-5 py-3 text-sm last:border-0 dark:border-white/[0.06] md:grid-cols-[90px_minmax(220px,1fr)_100px_110px_160px] md:items-center md:gap-3">
                    <div><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${kind.className}`}>{kind.label}</span></div>
                    <div className="min-w-0">
                      <div className="break-words font-medium text-gray-800 dark:text-gray-100">{item.reason}</div>
                      {item.reason.startsWith('生成消耗：') && item.promptPreview && (
                        <div className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">提示词：{item.promptPreview}</div>
                      )}
                      {item.taskId && <div className="mt-1 truncate font-mono text-xs text-gray-400" title={item.taskId}>任务 {item.taskId}</div>}
                    </div>
                    <div className={`font-semibold md:text-right ${item.delta >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{formatCredits(item.delta)}</div>
                    <div className="text-xs text-gray-500 md:text-right"><span className="md:hidden">余额 </span>{item.balanceAfter.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">{formatTime(item.createdAt)}</div>
                  </div>
                )
              })}
              {!items.length && !error && <div className="grid min-h-[260px] place-items-center text-sm text-gray-500">当前分类暂无积分记录</div>}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs text-gray-500 dark:border-white/[0.08] dark:bg-white/[0.03] sm:px-6">
          <span>第 {page} / {totalPages} 页</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onChangePage(page - 1)} disabled={page <= 1 || loading} aria-label="上一页" className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-base disabled:opacity-40 dark:border-white/[0.08]">‹</button>
            <button type="button" onClick={() => onChangePage(page + 1)} disabled={page >= totalPages || loading} aria-label="下一页" className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-base disabled:opacity-40 dark:border-white/[0.08]">›</button>
          </div>
        </footer>
      </div>
    </div>
  )
}
