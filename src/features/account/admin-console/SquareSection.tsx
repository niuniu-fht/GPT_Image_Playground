import type { AdminSquareShare, AdminSquareUsage } from '../../../types'
import { cx, EmptyState, SectionShell, StatCard, StatusBadge } from './shared'

type SquareSectionProps = {
  squareUsage: AdminSquareUsage | null
  squareShares: AdminSquareShare[]
  squareQuery: string
  squareStatus: string
  squareKind: string
  selectedSquareShareIds: string[]
  squareBatchOperating: boolean
  setSquareQuery: (value: string) => void
  setSquareStatus: (value: string) => void
  setSquareKind: (value: string) => void
  setSelectedSquareShareIds: (value: string[]) => void
  setSelectedSquareShareId: (value: string | null) => void
  toggleCurrentPageSquareShares: (checked: boolean) => void
  toggleSquareShareSelection: (shareId: string) => void
  batchUpdateSquareSharesStatus: (status: AdminSquareShare['status']) => void
  updateSquareShareStatus: (shareId: string, status: AdminSquareShare['status'], successMessage: string) => void
  cleanupSquareDryRun: () => void
}

function squareStatusTone(status: AdminSquareShare['status']) {
  if (status === 'published') return 'green'
  if (status === 'pending_review') return 'amber'
  if (status === 'hidden' || status === 'rejected') return 'red'
  return 'gray'
}

export function SquareSection({
  squareUsage,
  squareShares,
  squareQuery,
  squareStatus,
  squareKind,
  selectedSquareShareIds,
  squareBatchOperating,
  setSquareQuery,
  setSquareStatus,
  setSquareKind,
  setSelectedSquareShareIds,
  setSelectedSquareShareId,
  toggleCurrentPageSquareShares,
  toggleSquareShareSelection,
  batchUpdateSquareSharesStatus,
  updateSquareShareStatus,
  cleanupSquareDryRun,
}: SquareSectionProps) {
  return (
    <SectionShell
      title="广场内容"
      description="统一处理公开分享、举报内容和存储清理。数据来自现有 Cloudflare Worker 广场服务。"
      action={
        <button
          onClick={cleanupSquareDryRun}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04]"
        >
          清理预检
        </button>
      }
    >
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <StatCard label="广场分享" value={squareUsage?.shares.total ?? '-'} hint={`${squareUsage?.shares.published ?? 0} 个公开`} />
        <StatCard label="待处理/举报" value={`${squareUsage?.shares.pendingReview ?? 0}/${squareShares.reduce((sum, item) => sum + item.reportCount, 0)}`} hint="待审核 / 举报次数" />
        <StatCard label="隐藏/拒绝" value={`${squareUsage?.shares.hidden ?? 0}/${squareUsage?.shares.rejected ?? 0}`} hint="运营处置结果" />
        <StatCard label="存储占用" value={squareUsage ? `${squareUsage.storage.percentOfMax}%` : '-'} hint={`${squareUsage?.storage.assetCount ?? 0} 个资源`} />
      </div>

      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/[0.08] dark:bg-white/[0.03] md:flex-row md:items-center">
        <input
          value={squareQuery}
          onChange={(event) => setSquareQuery(event.target.value)}
          placeholder="搜索标题、提示词、标签"
          className="h-10 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950"
        />
        <select value={squareStatus} onChange={(event) => setSquareStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-white/[0.08] dark:bg-gray-950">
          <option value="all">全部状态</option>
          <option value="published">公开</option>
          <option value="pending_review">待审核</option>
          <option value="hidden">隐藏</option>
          <option value="rejected">拒绝</option>
          <option value="deleted">删除</option>
        </select>
        <select value={squareKind} onChange={(event) => setSquareKind(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-white/[0.08] dark:bg-gray-950">
          <option value="all">全部类型</option>
          <option value="task">任务</option>
          <option value="image">图片</option>
          <option value="prompt">提示词</option>
        </select>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-2 text-gray-500">
          <span>已选 <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedSquareShareIds.length}</span> / 本页 {squareShares.length}</span>
          <span className="hidden h-3 w-px bg-gray-200 dark:bg-white/[0.08] sm:block" />
          <span>适合批量处理待审核、举报和下架内容。</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!selectedSquareShareIds.length || squareBatchOperating} onClick={() => batchUpdateSquareSharesStatus('published')} className="h-8 rounded-lg border border-emerald-200 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10">批量公开</button>
          <button type="button" disabled={!selectedSquareShareIds.length || squareBatchOperating} onClick={() => batchUpdateSquareSharesStatus('hidden')} className="h-8 rounded-lg border border-amber-200 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-400/20 dark:hover:bg-amber-400/10">批量隐藏</button>
          <button type="button" disabled={!selectedSquareShareIds.length || squareBatchOperating} onClick={() => batchUpdateSquareSharesStatus('rejected')} className="h-8 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10">批量拒绝</button>
          <button type="button" disabled={!selectedSquareShareIds.length || squareBatchOperating} onClick={() => batchUpdateSquareSharesStatus('deleted')} className="h-8 rounded-lg border border-gray-300 px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.12] dark:text-gray-200 dark:hover:bg-white/[0.08]">批量删除</button>
          <button type="button" disabled={!selectedSquareShareIds.length || squareBatchOperating} onClick={() => setSelectedSquareShareIds([])} className="h-8 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">取消选择</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 bg-white px-4 py-2 text-xs text-gray-400 dark:border-white/[0.06] dark:bg-transparent md:hidden">
          横向滑动查看更多广场字段和审核操作
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1260px]">
            <div className="grid grid-cols-[34px_92px_1.7fr_90px_110px_90px_120px_150px_260px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-white/[0.04]">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={squareShares.length > 0 && selectedSquareShareIds.length === squareShares.length}
                  onChange={(event) => toggleCurrentPageSquareShares(event.target.checked)}
                  aria-label="选择当前页全部广场内容"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
              <span>封面</span>
              <span>内容</span>
              <span>类型</span>
              <span>状态</span>
              <span>数据</span>
              <span>发布者</span>
              <span>更新时间</span>
              <span className="text-right">操作</span>
            </div>
            {squareShares.map((item) => {
              const checked = selectedSquareShareIds.includes(item.id)
              return (
                <div key={item.id} className={cx('grid grid-cols-[34px_92px_1.7fr_90px_110px_90px_120px_150px_260px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 dark:border-white/[0.06]', checked ? 'bg-blue-50/70 dark:bg-blue-400/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]')}>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSquareShareSelection(item.id)}
                      aria-label={`选择广场内容 ${item.id}`}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                  <div className="h-16 overflow-hidden rounded-xl bg-gray-100 dark:bg-white/[0.06]">
                    {item.coverAsset?.thumbUrl ? (
                      <img src={item.coverAsset.thumbUrl} alt={item.title || '广场内容封面'} className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-xs text-gray-400">{item.kind}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-gray-950 dark:text-gray-50">{item.title || '未命名分享'}</span>
                      {item.reportCount > 0 && <StatusBadge tone="red">举报 {item.reportCount}</StatusBadge>}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.prompt || '-'}</div>
                    {item.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-white/[0.06]">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <StatusBadge tone="gray">{item.kind}</StatusBadge>
                  <StatusBadge tone={squareStatusTone(item.status)}>{item.status}</StatusBadge>
                  <div className="text-xs leading-5 text-gray-500">
                    <div>浏览 {item.viewCount}</div>
                    <div>举报 {item.reportCount}</div>
                  </div>
                  <span className="truncate text-xs text-gray-500" title={item.publisherId}>{item.publisherId.slice(0, 12)}</span>
                  <span className="text-xs text-gray-400">{new Date(item.updatedAt).toLocaleString()}</span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button type="button" onClick={() => setSelectedSquareShareId(item.id)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">详情</button>
                    <button type="button" onClick={() => updateSquareShareStatus(item.id, item.status === 'published' ? 'hidden' : 'published', '广场内容状态已更新')} className={cx('h-8 rounded-lg border px-2.5 text-xs font-medium', item.status === 'published' ? 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-400/20 dark:hover:bg-amber-400/10' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:hover:bg-emerald-400/10')}>{item.status === 'published' ? '隐藏' : '公开'}</button>
                    <button type="button" onClick={() => updateSquareShareStatus(item.id, 'rejected', '已拒绝该广场内容')} className="h-8 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">拒绝</button>
                    <select
                      value={item.status}
                      onChange={(event) => updateSquareShareStatus(item.id, event.target.value as AdminSquareShare['status'], '审核状态已更新')}
                      className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 outline-none hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-300"
                      aria-label="修改广场内容状态"
                    >
                      <option value="published">公开</option>
                      <option value="pending_review">待审核</option>
                      <option value="hidden">隐藏</option>
                      <option value="rejected">拒绝</option>
                      <option value="deleted">删除</option>
                    </select>
                  </div>
                </div>
              )
            })}
            {!squareShares.length && <EmptyState text={squareUsage ? '暂无匹配的广场内容' : '广场后台未配置或暂无数据'} />}
          </div>
        </div>
      </div>
    </SectionShell>
  )
}

export function SquareDialog({
  squareShares,
  selectedSquareShareId,
  setSelectedSquareShareId,
  updateSquareShareStatus,
}: {
  squareShares: AdminSquareShare[]
  selectedSquareShareId: string | null
  setSelectedSquareShareId: (value: string | null) => void
  updateSquareShareStatus: (shareId: string, status: AdminSquareShare['status'], successMessage: string, closeAfter?: boolean) => void
}) {
  if (!selectedSquareShareId) return null
  const selected = squareShares.find((item) => item.id === selectedSquareShareId) ?? null
  if (!selected) return null

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-gray-950/25 px-4 backdrop-blur-sm">
      <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/[0.08] dark:bg-gray-900">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.08]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">{selected.title || '未命名分享'}</div>
              <StatusBadge tone={squareStatusTone(selected.status)}>{selected.status}</StatusBadge>
              {selected.reportCount > 0 && <StatusBadge tone="red">举报 {selected.reportCount}</StatusBadge>}
            </div>
            <div className="mt-1 text-xs text-gray-400">ID {selected.id} · {selected.kind}</div>
          </div>
          <button type="button" onClick={() => setSelectedSquareShareId(null)} className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06]">×</button>
        </div>

        <div className="grid max-h-[74vh] overflow-y-auto md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="border-b border-gray-100 bg-gray-50 p-5 dark:border-white/[0.06] dark:bg-white/[0.03] md:border-b-0 md:border-r">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100 dark:bg-white/[0.06]">
              {selected.coverAsset?.thumbUrl ? (
                <img src={selected.coverAsset.thumbUrl} alt={selected.title || '广场内容封面'} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-sm text-gray-400">暂无封面</div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-white/[0.08] dark:bg-gray-950">
                <div className="font-semibold text-gray-950 dark:text-gray-50">{selected.viewCount}</div>
                <div className="mt-0.5 text-xs text-gray-400">浏览</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-white/[0.08] dark:bg-gray-950">
                <div className="font-semibold text-gray-950 dark:text-gray-50">{selected.reportCount}</div>
                <div className="mt-0.5 text-xs text-gray-400">举报</div>
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                <div className="text-xs text-gray-400">发布者</div>
                <div className="mt-1 break-all font-medium text-gray-900 dark:text-gray-100">{selected.publisherId}</div>
              </div>
              <div className="rounded-xl border border-gray-100 px-3 py-2 text-sm dark:border-white/[0.06]">
                <div className="text-xs text-gray-400">更新时间</div>
                <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">{new Date(selected.updatedAt).toLocaleString()}</div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">提示词</div>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-gray-200">{selected.prompt || '-'}</div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">标签</div>
              <div className="flex flex-wrap gap-2">
                {selected.tags.length > 0 ? selected.tags.map((tag) => (
                  <span key={tag} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">{tag}</span>
                )) : <span className="text-sm text-gray-400">暂无标签</span>}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.08]">
              <button type="button" onClick={() => setSelectedSquareShareId(null)} className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium hover:bg-gray-50 dark:border-white/[0.08] dark:hover:bg-white/[0.06]">关闭</button>
              <button type="button" onClick={() => updateSquareShareStatus(selected.id, 'hidden', '广场内容已隐藏', true)} className="h-10 rounded-xl border border-amber-200 px-4 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-400/20 dark:hover:bg-amber-400/10">隐藏</button>
              <button type="button" onClick={() => updateSquareShareStatus(selected.id, 'rejected', '已拒绝该广场内容', true)} className="h-10 rounded-xl border border-rose-200 px-4 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-400/20 dark:hover:bg-rose-400/10">拒绝</button>
              <button type="button" onClick={() => updateSquareShareStatus(selected.id, 'published', '广场内容已公开', true)} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-gray-950">公开</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
