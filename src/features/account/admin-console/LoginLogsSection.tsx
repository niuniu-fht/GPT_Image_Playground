import type { AdminLoginLog } from '../../../types'
import {
  AdminTableShell,
  EmptyState,
  formatTime,
  loginReasonLabel,
  loginReasonTone,
  PaginationBar,
  SectionShell,
  StatCard,
  StatusBadge,
  userSegmentLabel,
  userSegmentTone,
} from './shared'

type LoginLogsSectionProps = {
  loginLogs: AdminLoginLog[]
  loginLogTotal: number
  loginLogPage: number
  pageSize: number
  loginLogQuery: string
  loginLogSuccess: string
  loginLogFrom: string
  loginLogTo: string
  setLoginLogQuery: (value: string) => void
  setLoginLogSuccess: (value: string) => void
  setLoginLogFrom: (value: string) => void
  setLoginLogTo: (value: string) => void
  setLoginLogPage: (value: number) => void
  setSelectedLoginLogId: (value: string | null) => void
  onExport: () => void
}

function userAgentSummary(value?: string | null) {
  if (!value) return '-'
  if (value.includes('Edg/')) return 'Edge'
  if (value.includes('Chrome/')) return 'Chrome'
  if (value.includes('Firefox/')) return 'Firefox'
  if (value.includes('Safari/')) return 'Safari'
  return value.slice(0, 28)
}

export function LoginLogsSection({
  loginLogs,
  loginLogTotal,
  loginLogPage,
  pageSize,
  loginLogQuery,
  loginLogSuccess,
  loginLogFrom,
  loginLogTo,
  setLoginLogQuery,
  setLoginLogSuccess,
  setLoginLogFrom,
  setLoginLogTo,
  setLoginLogPage,
  setSelectedLoginLogId,
  onExport,
}: LoginLogsSectionProps) {
  const successCount = loginLogs.filter((item) => item.success).length
  const failedCount = loginLogs.length - successCount
  const uniqueIps = new Set(loginLogs.map((item) => item.ip).filter(Boolean)).size
  const disabledCount = loginLogs.filter((item) => item.reason === 'account_disabled').length

  return (
    <SectionShell
      title="登录日志"
      description="按成熟后台的账号安全表格展示登录尝试，集中排查失败登录、禁用账号访问和异常 IP。"
      action={
        <div className="grid w-full gap-2 md:grid-cols-2 xl:w-auto xl:grid-cols-[260px_130px_140px_140px_auto_auto]">
          <input
            value={loginLogQuery}
            onChange={(event) => setLoginLogQuery(event.target.value)}
            placeholder="搜索邮箱、IP、原因、设备"
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
          <select
            value={loginLogSuccess}
            onChange={(event) => setLoginLogSuccess(event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          >
            <option value="all">全部结果</option>
            <option value="success">成功</option>
            <option value="failed">失败</option>
          </select>
          <input
            type="date"
            value={loginLogFrom}
            onChange={(event) => setLoginLogFrom(event.target.value)}
            aria-label="登录日志开始日期"
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
          <input
            type="date"
            value={loginLogTo}
            onChange={(event) => setLoginLogTo(event.target.value)}
            aria-label="登录日志结束日期"
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
          <button
            type="button"
            onClick={() => {
              setLoginLogQuery('')
              setLoginLogSuccess('all')
              setLoginLogFrom('')
              setLoginLogTo('')
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
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <StatCard label="当前匹配日志" value={loginLogTotal} hint="受搜索、结果和时间筛选影响" />
        <StatCard label="当前页成功" value={successCount} hint="成功登录和注册会话" />
        <StatCard label="当前页失败" value={failedCount} hint="密码错误、未知邮箱等" />
        <StatCard label="当前页 IP" value={uniqueIps} hint={disabledCount ? `含 ${disabledCount} 次禁用账号访问` : '用于发现异常集中来源'} />
      </div>

      <AdminTableShell
        mobileHint="横向滑动查看更多登录字段和操作"
        footer={<PaginationBar page={loginLogPage} pageSize={pageSize} total={loginLogTotal} onPageChange={setLoginLogPage} />}
      >
        <div className="min-w-[1180px]">
            <div className="sticky top-0 z-20 grid grid-cols-[1.35fr_110px_130px_130px_1.1fr_160px_110px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
              <span>账号</span>
              <span>结果</span>
              <span>原因</span>
              <span>IP</span>
              <span>设备</span>
              <span>时间</span>
              <span className="sticky right-0 z-10 -my-3 flex h-[42px] items-center justify-end bg-gray-50 pl-4 text-right shadow-[-12px_0_18px_-16px_rgba(15,23,42,0.45)] dark:bg-[#171a22]">操作</span>
            </div>
            {loginLogs.map((item) => (
              <div key={item.id} className="grid grid-cols-[1.35fr_110px_130px_130px_1.1fr_160px_110px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 hover:bg-gray-50/70 dark:border-white/[0.06] dark:hover:bg-white/[0.04]">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{item.user?.email ?? item.email}</div>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    {item.user ? <StatusBadge tone={userSegmentTone(item.user.segment)}>{userSegmentLabel(item.user.segment)}</StatusBadge> : <StatusBadge tone="gray">未注册</StatusBadge>}
                    <span className="truncate text-xs text-gray-400">ID {(item.userId ?? item.id).slice(0, 12)}</span>
                  </div>
                </div>
                <StatusBadge tone={item.success ? 'green' : 'red'}>{item.success ? '成功' : '失败'}</StatusBadge>
                <StatusBadge tone={loginReasonTone(item)}>{loginReasonLabel(item.reason)}</StatusBadge>
                <span className="truncate font-mono text-xs text-gray-500">{item.ip ?? '-'}</span>
                <span className="truncate text-xs text-gray-500" title={item.userAgent ?? ''}>{userAgentSummary(item.userAgent)}</span>
                <span className="text-xs text-gray-400">{formatTime(item.createdAt)}</span>
                <div className="sticky right-0 -my-3 flex min-h-[58px] items-center justify-end bg-white py-3 pl-4 shadow-[-12px_0_18px_-16px_rgba(15,23,42,0.45)] dark:bg-[#111318]">
                  <button type="button" onClick={() => setSelectedLoginLogId(item.id)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">详情</button>
                </div>
              </div>
            ))}
            {!loginLogs.length && <EmptyState text="暂无登录日志" />}
        </div>
      </AdminTableShell>
    </SectionShell>
  )
}

export function LoginLogDialog({
  loginLogs,
  selectedLoginLogId,
  setSelectedLoginLogId,
}: {
  loginLogs: AdminLoginLog[]
  selectedLoginLogId: string | null
  setSelectedLoginLogId: (value: string | null) => void
}) {
  if (!selectedLoginLogId) return null
  const selected = loginLogs.find((item) => item.id === selectedLoginLogId) ?? null
  if (!selected) return null

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-gray-950/25 px-4 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">{selected.email}</div>
            <div className="mt-1 text-xs text-gray-400">登录日志 ID {selected.id} · {formatTime(selected.createdAt)}</div>
          </div>
          <button type="button" onClick={() => setSelectedLoginLogId(null)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="登录结果" value={selected.success ? '成功' : '失败'} hint={loginReasonLabel(selected.reason)} />
            <StatCard label="用户积分" value={selected.user?.creditBalance ?? '-'} hint={selected.user ? `${selected.user.loginCount} 次累计登录` : '没有关联用户'} />
            <StatCard label="来源 IP" value={selected.ip ?? '-'} hint="可结合筛选排查集中失败" />
          </div>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm dark:divide-white/[0.06] dark:border-white/[0.06]">
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">邮箱</span><span className="truncate text-right font-medium">{selected.email}</span></div>
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">用户 ID</span><span className="truncate text-right font-medium">{selected.userId ?? '-'}</span></div>
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">用户状态</span><span className="text-right font-medium">{selected.user ? `${selected.user.role === 'admin' ? '管理员' : '用户'} / ${selected.user.status === 'active' ? '正常' : '禁用'} / ${userSegmentLabel(selected.user.segment)}` : '-'}</span></div>
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">失败/成功原因</span><span className="text-right font-medium">{loginReasonLabel(selected.reason)}</span></div>
            <div className="flex justify-between gap-3 px-3 py-2"><span className="text-gray-500">User-Agent</span><span className="max-w-[70%] truncate text-right font-medium" title={selected.userAgent ?? ''}>{selected.userAgent ?? '-'}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
