import type { AdminAuditLog } from '../../../types'
import {
  AdminTableShell,
  EmptyState,
  formatJson,
  formatTime,
  PaginationBar,
  SectionShell,
  StatCard,
} from './shared'

type AuditSectionProps = {
  auditLogs: AdminAuditLog[]
  auditTotal: number
  auditPage: number
  pageSize: number
  auditQuery: string
  auditAction: string
  auditFrom: string
  auditTo: string
  setAuditQuery: (value: string) => void
  setAuditAction: (value: string) => void
  setAuditFrom: (value: string) => void
  setAuditTo: (value: string) => void
  setAuditPage: (value: number) => void
  setSelectedAuditLogId: (value: string | null) => void
  onExport: () => void
}

function actorMeta(item: AdminAuditLog) {
  if (!item.actor) return item.actorId ?? '-'
  return `${item.actor.role === 'admin' ? '管理员' : '用户'} · ${item.actor.status === 'active' ? '正常' : '禁用'}`
}

export function AuditSection({
  auditLogs,
  auditTotal,
  auditPage,
  pageSize,
  auditQuery,
  auditAction,
  auditFrom,
  auditTo,
  setAuditQuery,
  setAuditAction,
  setAuditFrom,
  setAuditTo,
  setAuditPage,
  setSelectedAuditLogId,
  onExport,
}: AuditSectionProps) {
  const userActionCount = auditLogs.filter((item) => item.action.startsWith('user.')).length
  const modelActionCount = auditLogs.filter((item) => item.action.startsWith('model.')).length
  const upstreamActionCount = auditLogs.filter((item) => item.action.startsWith('upstream.')).length
  const squareActionCount = auditLogs.filter((item) => item.action.startsWith('square.')).length

  return (
    <SectionShell
      title="审计日志"
      description="记录管理员关键动作，支持按动作、目标、操作者和 IP 排查运营变更。"
      action={
        <div className="grid w-full gap-2 md:grid-cols-2 xl:w-auto xl:grid-cols-[260px_130px_140px_140px_auto_auto]">
          <input
            value={auditQuery}
            onChange={(event) => setAuditQuery(event.target.value)}
            placeholder="搜索动作、目标、操作者、IP"
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
          <select
            value={auditAction}
            onChange={(event) => setAuditAction(event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          >
            <option value="all">全部动作</option>
            <option value="user.">用户</option>
            <option value="task.">生成日志</option>
            <option value="model.">模型</option>
            <option value="upstream.">上游</option>
            <option value="square.">广场内容</option>
            <option value="announcement.">公告</option>
            <option value="platform.">平台设置</option>
          </select>
          <input
            type="date"
            value={auditFrom}
            onChange={(event) => setAuditFrom(event.target.value)}
            aria-label="审计开始日期"
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
          <input
            type="date"
            value={auditTo}
            onChange={(event) => setAuditTo(event.target.value)}
            aria-label="审计结束日期"
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
          <button
            type="button"
            onClick={() => {
              setAuditQuery('')
              setAuditAction('all')
              setAuditFrom('')
              setAuditTo('')
            }}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]"
          >
            重置
          </button>
          <button
            type="button"
            onClick={onExport}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950"
          >
            导出 CSV
          </button>
        </div>
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <StatCard label="当前匹配日志" value={auditTotal} hint="受搜索和动作筛选影响" />
        <StatCard label="用户操作" value={userActionCount} hint="当前页用户相关动作" />
        <StatCard label="模型操作" value={modelActionCount} hint="当前页模型配置动作" />
        <StatCard label="上游操作" value={upstreamActionCount} hint="当前页渠道配置动作" />
        <StatCard label="广场操作" value={squareActionCount} hint="当前页内容审核动作" />
      </div>

      <AdminTableShell
        mobileHint="横向滑动查看更多审计字段和操作"
        footer={<PaginationBar page={auditPage} pageSize={pageSize} total={auditTotal} onPageChange={setAuditPage} />}
      >
        <div className="min-w-[920px]">
            <div className="sticky top-0 z-20 grid grid-cols-[1.1fr_1.2fr_1fr_120px_150px_100px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
              <span>动作</span>
              <span>目标</span>
              <span>操作者</span>
              <span>IP</span>
              <span>时间</span>
              <span className="text-right">操作</span>
            </div>
            {auditLogs.map((item) => (
              <div key={item.id} className="grid grid-cols-[1.1fr_1.2fr_1fr_120px_150px_100px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 hover:bg-gray-50 dark:border-white/[0.06] dark:hover:bg-white/[0.04]">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{item.action}</div>
                  <div className="mt-1 truncate text-xs text-gray-400">ID {item.id.slice(0, 12)}</div>
                </div>
                <span className="truncate text-gray-500">{item.target}</span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{item.actor?.email ?? '系统/未知'}</div>
                  <div className="mt-1 truncate text-[11px] text-gray-400">{actorMeta(item)}</div>
                </div>
                <span className="truncate text-xs text-gray-500">{item.ip ?? '-'}</span>
                <span className="text-xs text-gray-400">{formatTime(item.createdAt)}</span>
                <div className="flex justify-end">
                  <button type="button" onClick={() => setSelectedAuditLogId(item.id)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">详情</button>
                </div>
              </div>
            ))}
            {!auditLogs.length && <EmptyState text="暂无审计日志" />}
        </div>
      </AdminTableShell>
    </SectionShell>
  )
}

export function AuditDialog({
  auditLogs,
  selectedAuditLogId,
  setSelectedAuditLogId,
}: {
  auditLogs: AdminAuditLog[]
  selectedAuditLogId: string | null
  setSelectedAuditLogId: (value: string | null) => void
}) {
  if (!selectedAuditLogId) return null
  const selected = auditLogs.find((item) => item.id === selectedAuditLogId) ?? null
  if (!selected) return null

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-gray-950/25 px-4 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">{selected.action}</div>
            <div className="mt-1 text-xs text-gray-400">审计 ID {selected.id} · {formatTime(selected.createdAt)}</div>
          </div>
          <button type="button" onClick={() => setSelectedAuditLogId(null)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm dark:divide-white/[0.06] dark:border-white/[0.06]">
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">目标</span><span className="text-right font-medium">{selected.target}</span></div>
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">操作者</span><span className="truncate text-right font-medium">{selected.actor?.email ?? selected.actorId ?? '-'}</span></div>
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">操作者状态</span><span className="text-right font-medium">{selected.actor ? actorMeta(selected) : '-'}</span></div>
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">IP</span><span className="text-right font-medium">{selected.ip ?? '-'}</span></div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">变更详情</div>
            <pre className="max-h-80 overflow-auto rounded-xl border border-gray-100 bg-gray-950 p-3 text-xs leading-5 text-gray-100 dark:border-white/[0.08]">{formatJson(selected.detail)}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
