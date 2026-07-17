import type { ModerationRule } from '../../../types'
import { AdminTableShell, EmptyState, formatTime, PaginationBar, SectionShell, StatusBadge, type ModerationRuleDraft } from './shared'

type ModerationSectionProps = {
  rules: ModerationRule[]
  total: number
  page: number
  pageSize: number
  query: string
  enabledFilter: string
  setQuery: (value: string) => void
  setEnabledFilter: (value: string) => void
  setPage: (page: number) => void
  openEditor: (rule?: ModerationRule) => void
  patchRule: (id: string, input: Partial<ModerationRuleDraft>) => void
  deleteRule: (id: string) => void
}

export function ModerationSection({
  rules,
  total,
  page,
  pageSize,
  query,
  enabledFilter,
  setQuery,
  setEnabledFilter,
  setPage,
  openEditor,
  patchRule,
  deleteRule,
}: ModerationSectionProps) {
  const enabledCount = rules.filter((item) => item.enabled).length
  const hitCount = rules.reduce((sum, item) => sum + item.hitCount, 0)
  return (
    <SectionShell
      title="风控规则"
      description="生成前按规则拦截提示词，命中后不扣积分、不创建任务。适合配置敏感词、运营限制和临时风控。"
      action={<button onClick={() => openEditor()} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-gray-950">新增规则</button>}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">启用规则</div>
          <div className="mt-2 text-2xl font-bold">{enabledCount}</div>
          <div className="mt-1 text-xs text-gray-500">会参与生成前校验</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">累计命中</div>
          <div className="mt-2 text-2xl font-bold text-rose-600">{hitCount}</div>
          <div className="mt-1 text-xs text-gray-500">用于观察风控效果</div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
          <div className="text-xs font-medium text-gray-400">当前规则</div>
          <div className="mt-2 text-2xl font-bold">{rules.length}</div>
          <div className="mt-1 text-xs text-gray-500">按优先级从小到大匹配</div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03] lg:flex-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索规则名、匹配内容、备注" className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950" />
        <select value={enabledFilter} onChange={(event) => setEnabledFilter(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none dark:border-white/[0.08] dark:bg-gray-950">
          <option value="all">全部状态</option>
          <option value="true">启用</option>
          <option value="false">停用</option>
        </select>
      </div>

      <AdminTableShell
        mobileHint="横向滑动查看更多风控字段和操作"
        footer={<PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} />}
      >
        <div className="min-w-[1040px]">
            <div className="sticky top-0 z-20 grid grid-cols-[1.2fr_0.8fr_1.5fr_1fr_0.8fr_0.9fr_1fr_1.1fr] gap-4 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
              <span>规则</span><span>类型</span><span>匹配内容</span><span>提示</span><span>优先级</span><span>命中</span><span>状态</span><span className="text-right">操作</span>
            </div>
            {rules.map((item) => (
              <div key={item.id} className="grid grid-cols-[1.2fr_0.8fr_1.5fr_1fr_0.8fr_0.9fr_1fr_1.1fr] items-center gap-4 border-b border-gray-100 px-4 py-3 text-sm last:border-0 dark:border-white/[0.06]">
                <div className="min-w-0"><div className="truncate font-semibold">{item.name}</div><div className="truncate text-xs text-gray-400">{item.note || '无备注'}</div></div>
                <StatusBadge tone={item.type === 'regex' ? 'blue' : 'gray'}>{item.type === 'regex' ? '正则' : '关键词'}</StatusBadge>
                <div className="truncate font-mono text-xs text-gray-600 dark:text-gray-300">{item.pattern}</div>
                <div className="line-clamp-2 text-xs text-gray-500">{item.message}</div>
                <div className="font-semibold">{item.priority}</div>
                <div className="text-xs text-gray-500"><div className="font-semibold text-rose-600">{item.hitCount}</div><div>{formatTime(item.lastHitAt)}</div></div>
                <StatusBadge tone={item.enabled ? 'green' : 'gray'}>{item.enabled ? '启用' : '停用'}</StatusBadge>
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEditor(item)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">编辑</button>
                  <button onClick={() => patchRule(item.id, { enabled: !item.enabled })} className="h-8 rounded-lg border border-blue-200 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-400/20 dark:hover:bg-blue-400/10">{item.enabled ? '停用' : '启用'}</button>
                  <button onClick={() => deleteRule(item.id)} className="h-8 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">删除</button>
                </div>
              </div>
            ))}
            {!rules.length && <EmptyState text="暂无风控规则" />}
        </div>
      </AdminTableShell>
    </SectionShell>
  )
}
