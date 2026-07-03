import type { FormEvent } from 'react'
import type { AdminUserSummary } from '../../../types'
import {
  adminPageSize,
  cx,
  EmptyState,
  formatTime,
  PaginationBar,
  SectionShell,
  StatusBadge,
  userSegmentLabel,
  userSegmentTone,
} from './shared'

type UsersSectionProps = {
  users: AdminUserSummary[]
  usersPage: number
  usersTotal: number
  query: string
  userRoleFilter: string
  userStatusFilter: string
  userSegmentFilter: string
  selectedUserIds: string[]
  batchOperating: boolean
  batchCreditDelta: string
  batchCreditReason: string
  setQuery: (value: string) => void
  setUserRoleFilter: (value: string) => void
  setUserStatusFilter: (value: string) => void
  setUserSegmentFilter: (value: string) => void
  setUsersPage: (value: number) => void
  setBatchCreditDelta: (value: string) => void
  setBatchCreditReason: (value: string) => void
  toggleCurrentPageUsers: (checked: boolean) => void
  toggleUserSelection: (userId: string) => void
  batchUpdateUsersStatus: (status: AdminUserSummary['status']) => void
  batchAdjustUsersCredits: (event: FormEvent<HTMLFormElement>) => void
  exportUsers: () => void
  openUserDetail: (userId: string) => void
  openCreditDialog: (userId: string) => void
  openPasswordDialog: (userId: string) => void
  patchUser: (userId: string, input: Partial<Pick<AdminUserSummary, 'role' | 'status'>>) => void
}

export function UsersSection({
  users,
  usersPage,
  usersTotal,
  query,
  userRoleFilter,
  userStatusFilter,
  userSegmentFilter,
  selectedUserIds,
  batchOperating,
  batchCreditDelta,
  batchCreditReason,
  setQuery,
  setUserRoleFilter,
  setUserStatusFilter,
  setUserSegmentFilter,
  setUsersPage,
  setBatchCreditDelta,
  setBatchCreditReason,
  toggleCurrentPageUsers,
  toggleUserSelection,
  batchUpdateUsersStatus,
  batchAdjustUsersCredits,
  exportUsers,
  openUserDetail,
  openCreditDialog,
  openPasswordDialog,
  patchUser,
}: UsersSectionProps) {
  return (
    <SectionShell
      title="用户与积分"
      description="按后台管理习惯用表格集中展示用户字段，行操作处理角色、状态、积分和详情。"
      action={
        <div className="grid w-full gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-[240px_120px_120px_120px_auto]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索邮箱、分层、备注"
            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          />
          <select
            value={userRoleFilter}
            onChange={(event) => setUserRoleFilter(event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          >
            <option value="all">全部角色</option>
            <option value="user">用户</option>
            <option value="admin">管理员</option>
          </select>
          <select
            value={userStatusFilter}
            onChange={(event) => setUserStatusFilter(event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          >
            <option value="all">全部状态</option>
            <option value="active">正常</option>
            <option value="disabled">禁用</option>
          </select>
          <select
            value={userSegmentFilter}
            onChange={(event) => setUserSegmentFilter(event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]"
          >
            <option value="all">全部分层</option>
            <option value="normal">普通</option>
            <option value="vip">VIP</option>
            <option value="trial">试用</option>
            <option value="risk">风险</option>
          </select>
          <button
            type="button"
            onClick={exportUsers}
            className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950"
          >
            导出用户
          </button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.04]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500">
              <input
                type="checkbox"
                checked={users.length > 0 && selectedUserIds.length === users.length}
                onChange={(event) => toggleCurrentPageUsers(event.target.checked)}
              />
              已选 {selectedUserIds.length} / 本页 {users.length}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!selectedUserIds.length || batchOperating} onClick={() => batchUpdateUsersStatus('disabled')} className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10">批量禁用</button>
              <button type="button" disabled={!selectedUserIds.length || batchOperating} onClick={() => batchUpdateUsersStatus('active')} className="h-8 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10">批量恢复</button>
              <form onSubmit={batchAdjustUsersCredits} className="flex flex-wrap items-center gap-2">
                <input type="number" value={batchCreditDelta} onChange={(event) => setBatchCreditDelta(event.target.value)} disabled={!selectedUserIds.length || batchOperating} className="h-8 w-24 rounded-lg border border-amber-200 bg-white px-2 text-xs outline-none focus:border-amber-400 disabled:opacity-45 dark:border-amber-400/20 dark:bg-gray-950" />
                <input value={batchCreditReason} onChange={(event) => setBatchCreditReason(event.target.value)} disabled={!selectedUserIds.length || batchOperating} placeholder="调整原因" className="h-8 w-32 rounded-lg border border-amber-200 bg-white px-2 text-xs outline-none focus:border-amber-400 disabled:opacity-45 dark:border-amber-400/20 dark:bg-gray-950" />
                <button disabled={!selectedUserIds.length || batchOperating} className="h-8 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-45">批量调分</button>
              </form>
            </div>
          </div>
        </div>
        <div className="border-b border-gray-100 bg-white px-4 py-2 text-xs text-gray-400 dark:border-white/[0.06] dark:bg-transparent md:hidden">
          横向滑动查看更多字段和操作
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1550px]">
            <div className="grid grid-cols-[42px_1.45fr_130px_100px_100px_90px_110px_90px_150px_150px_320px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
              <span />
              <span>用户</span>
              <span>分层 / 备注</span>
              <span>权限</span>
              <span>状态</span>
              <span className="text-right">积分</span>
              <span>任务 / 流水</span>
              <span>登录</span>
              <span>最后登录</span>
              <span>注册时间</span>
              <span className="sticky right-0 z-10 -my-3 flex h-[42px] items-center justify-end bg-gray-50 pl-4 text-right shadow-[-12px_0_18px_-16px_rgba(15,23,42,0.45)] dark:bg-[#171a22]">操作</span>
            </div>
            {users.map((user) => {
              const checked = selectedUserIds.includes(user.id)
              return (
                <div key={user.id} className="grid grid-cols-[42px_1.45fr_130px_100px_100px_90px_110px_90px_150px_150px_320px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition hover:bg-gray-50/70 last:border-0 dark:border-white/[0.06] dark:hover:bg-white/[0.04]">
                  <input type="checkbox" checked={checked} onChange={() => toggleUserSelection(user.id)} aria-label={`选择用户 ${user.email}`} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{user.email}</div>
                    <div className="mt-0.5 truncate text-xs text-gray-400">ID {user.id.slice(0, 12)}</div>
                  </div>
                  <div className="min-w-0">
                    <StatusBadge tone={userSegmentTone(user.segment)}>{userSegmentLabel(user.segment)}</StatusBadge>
                    <div className="mt-1 truncate text-xs text-gray-400" title={user.adminNote}>{user.adminNote || '无备注'}</div>
                  </div>
                  <StatusBadge tone={user.role === 'admin' ? 'blue' : 'gray'}>{user.role === 'admin' ? '管理员' : '用户'}</StatusBadge>
                  <StatusBadge tone={user.status === 'active' ? 'green' : 'red'}>{user.status === 'active' ? '正常' : '禁用'}</StatusBadge>
                  <div className="text-right font-semibold text-amber-700">{user.creditBalance}</div>
                  <div className="text-xs text-gray-500">{user._count?.tasks ?? 0} / {user._count?.ledgers ?? 0}</div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">{user.loginCount}</div>
                  <div className="text-xs text-gray-400">{formatTime(user.lastLoginAt)}</div>
                  <div className="text-xs text-gray-400">{formatTime(user.createdAt)}</div>
                  <div className="sticky right-0 -my-3 flex min-h-[66px] flex-wrap items-center justify-end gap-1.5 bg-white py-3 pl-4 shadow-[-12px_0_18px_-16px_rgba(15,23,42,0.45)] dark:bg-[#111318]">
                    <button type="button" onClick={() => openUserDetail(user.id)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">详情</button>
                    <button type="button" onClick={() => openCreditDialog(user.id)} className="h-8 rounded-lg border border-amber-200 px-2.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-400/20 dark:hover:bg-amber-400/10">调分</button>
                    <button type="button" onClick={() => openPasswordDialog(user.id)} className="h-8 rounded-lg border border-violet-200 px-2.5 text-xs font-medium text-violet-700 hover:bg-violet-50 dark:border-violet-400/20 dark:hover:bg-violet-400/10">重置密码</button>
                    <button type="button" onClick={() => patchUser(user.id, { status: user.status === 'active' ? 'disabled' : 'active' })} className={cx('h-8 rounded-lg border px-2.5 text-xs font-medium', user.status === 'active' ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10')}>{user.status === 'active' ? '禁用' : '恢复'}</button>
                    <button type="button" onClick={() => patchUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' })} className="h-8 rounded-lg border border-blue-200 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400/20 dark:hover:bg-blue-400/10">{user.role === 'admin' ? '设用户' : '设管理员'}</button>
                  </div>
                </div>
              )
            })}
            {!users.length && <EmptyState text="暂无用户" />}
          </div>
        </div>
        <PaginationBar page={usersPage} pageSize={adminPageSize} total={usersTotal} onPageChange={setUsersPage} />
      </div>
    </SectionShell>
  )
}
