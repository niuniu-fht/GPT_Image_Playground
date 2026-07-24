import { useEffect, useState } from 'react'
import type { AdminGenerationTask, ModelConfig } from '../../../types'
import {
  AdminTableShell,
  cx,
  EmptyState,
  formatTime,
  PaginationBar,
  SectionShell,
  StatusBadge,
  taskParamsSummary,
  taskTone,
} from './shared'

interface GenerationLogsSectionProps {
  tasks: AdminGenerationTask[]
  total: number
  page: number
  pageSize: number
  models: ModelConfig[]
  query: string
  status: string
  modelFilter: string
  from: string
  to: string
  selectedIds: string[]
  batchOperating: boolean
  clearAllOperating: boolean
  setQuery: (value: string) => void
  setStatus: (value: string) => void
  setModelFilter: (value: string) => void
  setFrom: (value: string) => void
  setTo: (value: string) => void
  setPage: (page: number) => void
  onToggleTask: (taskId: string) => void
  onTogglePage: (checked: boolean) => void
  onClearSelection: () => void
  onBatchDelete: () => void
  onClearAll: () => void
  onOpenDetail: (taskId: string) => void
  onDelete: (taskId: string) => void
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 1) return `${totalSeconds} 秒`
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  if (hours < 1) return `${minutes} 分 ${seconds} 秒`
  return `${hours} 时 ${minutes} 分 ${seconds} 秒`
}

function taskDuration(task: AdminGenerationTask, now: number): string {
  const startedAt = new Date(task.createdAt).getTime()
  const finishedAt = task.finishedAt ? new Date(task.finishedAt).getTime() : now
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt)) return '-'
  return formatDuration(finishedAt - startedAt)
}

function readTaskAdminMeta(task: AdminGenerationTask): Record<string, unknown> {
  const params = task.params && typeof task.params === 'object' && !Array.isArray(task.params)
    ? task.params as Record<string, unknown>
    : {}
  const meta = params._admin
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta as Record<string, unknown> : {}
}

function readImages(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : []
}

function ImageStrip({ taskId, images, kind }: { taskId: string; images: Array<Record<string, unknown>>; kind: 'output' | 'reference' }) {
  if (!images.length) return <span className="text-xs text-gray-400">无预览</span>

  return (
    <div className="flex min-h-9 items-center gap-1.5">
      {images.slice(0, 4).map((image, index) => {
        const previewDataUrl = typeof image.previewDataUrl === 'string' ? image.previewDataUrl : ''
        const imageIndex = typeof image.index === 'number' ? image.index : index
        const title = [
          typeof image.id === 'string' ? `ID ${image.id}` : '',
          typeof image.mimeType === 'string' ? image.mimeType : '',
          typeof image.byteSize === 'number' ? `${Math.round(image.byteSize / 1024)}KB` : '',
        ].filter(Boolean).join(' · ')
        return previewDataUrl ? (
          <img
            key={`${taskId}-${kind}-${imageIndex}`}
            src={previewDataUrl}
            loading="lazy"
            title={title || `${kind === 'output' ? '输出' : '参考'}图 ${imageIndex + 1}`}
            className="h-8 w-8 rounded-lg border border-gray-200 object-cover shadow-sm dark:border-white/[0.08]"
            alt={`${kind === 'output' ? '输出' : '参考'}图 ${imageIndex + 1}`}
          />
        ) : (
          <span key={`${taskId}-${kind}-${imageIndex}`} className="grid h-8 w-8 place-items-center rounded-lg border border-dashed border-gray-200 text-[10px] text-gray-400 dark:border-white/[0.08]">
            {image.status === 'error' ? '失败' : '图'}
          </span>
        )
      })}
      {images.length > 4 && <span className="text-xs text-gray-400">+{images.length - 4}</span>}
    </div>
  )
}

export function GenerationLogsSection(props: GenerationLogsSectionProps) {
  const {
    tasks, total, page, pageSize, models, query, status, modelFilter, from, to,
    selectedIds, batchOperating, clearAllOperating, setQuery, setStatus, setModelFilter, setFrom, setTo,
    setPage, onToggleTask, onTogglePage, onClearSelection, onBatchDelete, onClearAll, onOpenDetail, onDelete,
  } = props
  const hasFilters = Boolean(query || status !== 'all' || modelFilter !== 'all' || from || to)
  const hasRunningTask = tasks.some((task) => task.status === 'running')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!hasRunningTask) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [hasRunningTask])

  function resetFilters() {
    setQuery('')
    setStatus('all')
    setModelFilter('all')
    setFrom('')
    setTo('')
  }

  return (
    <SectionShell
      title="生成日志"
      description="运营和排障入口。列表只加载压缩预览，完整图像不会进入管理端响应。"
      action={
        <div className="grid w-full gap-2 md:grid-cols-[minmax(220px,1.2fr)_150px_minmax(180px,1fr)_140px_140px_auto] xl:w-auto">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、提示词、用户、模型" className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <option value="all">全部状态</option><option value="done">成功</option><option value="error">失败</option><option value="running">运行中</option>
          </select>
          <select value={modelFilter} onChange={(event) => setModelFilter(event.target.value)} className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <option value="all">全部模型</option>
            {models.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}
          </select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="开始日期" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="结束日期" className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-white/[0.04]" />
          <button type="button" onClick={resetFilters} className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-gray-200 dark:hover:bg-white/[0.08]">重置</button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>当前显示 <span className="font-semibold text-gray-900 dark:text-gray-100">{tasks.length}</span> / {total} 条日志</span>
        {hasFilters && <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">已应用筛选</span>}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <span className="text-gray-500">已选 <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedIds.length}</span> / 本页 {tasks.length}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={batchOperating || clearAllOperating} onClick={onClearAll} className="h-8 rounded-lg border border-rose-200 px-3 font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10">清空已结束日志</button>
          <button type="button" disabled={!selectedIds.length || batchOperating} onClick={onBatchDelete} className="h-8 rounded-lg border border-rose-200 px-3 font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10">批量清理</button>
          <button type="button" disabled={!selectedIds.length || batchOperating} onClick={onClearSelection} className="h-8 rounded-lg border border-gray-200 px-3 font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">取消选择</button>
        </div>
      </div>
      <AdminTableShell mobileHint="横向滑动查看更多任务字段和操作" footer={<PaginationBar page={page} pageSize={pageSize} total={total} onPageChange={setPage} />}>
        <div className="min-w-[1600px]">
          <div className="sticky top-0 z-20 grid grid-cols-[34px_1.45fr_170px_1.05fr_1fr_180px_110px_90px_110px_150px_170px] gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 dark:border-white/[0.06] dark:bg-[#171a22]">
            <label className="flex items-center"><input type="checkbox" checked={tasks.length > 0 && selectedIds.length === tasks.length} onChange={(event) => onTogglePage(event.target.checked)} aria-label="选择当前页全部生成日志" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></label>
            <span>请求 / 输出</span><span>类型 / 参考图</span><span>用户</span><span>模型</span><span>参数</span><span>状态</span><span>消耗</span><span>耗时</span><span>创建时间</span><span className="text-right">操作</span>
          </div>
          {tasks.map((task) => {
            const checked = selectedIds.includes(task.id)
            const meta = readTaskAdminMeta(task)
            const isEdit = meta.operation === 'edit'
            const referenceImages = readImages(meta.referenceImages)
            const outputImages = readImages(task.outputImages)
            return (
              <div key={task.id} className={cx('grid grid-cols-[34px_1.45fr_170px_1.05fr_1fr_180px_110px_90px_110px_150px_170px] items-center gap-3 border-b border-gray-100 px-4 py-3 text-sm transition last:border-0 dark:border-white/[0.06]', checked ? 'bg-blue-50/70 dark:bg-blue-400/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]')}>
                <label className="flex items-center"><input type="checkbox" checked={checked} onChange={() => onToggleTask(task.id)} aria-label={`选择生成日志 ${task.id}`} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></label>
                <div className="min-w-0"><div className="truncate font-medium text-gray-900 dark:text-gray-100">{task.prompt}</div><div className="mt-1 truncate text-xs text-gray-400">ID {task.id.slice(0, 12)} · 云端资产 {task.generatedAssets?.length ?? 0}</div><div className="mt-2"><ImageStrip taskId={task.id} images={outputImages} kind="output" /></div></div>
                <div className="min-w-0"><div className="flex items-center gap-2"><StatusBadge tone={isEdit ? 'purple' : 'blue'}>{isEdit ? '编辑' : '生成'}</StatusBadge>{isEdit && <span className="text-xs text-gray-400">{referenceImages.length} 张参考图</span>}</div>{isEdit && <div className="mt-1.5"><ImageStrip taskId={task.id} images={referenceImages} kind="reference" /></div>}</div>
                <span className="truncate text-xs text-gray-500">{task.user?.email ?? '-'}</span><span className="truncate text-xs text-gray-500">{task.modelConfig?.displayName ?? '-'}</span><span className="truncate text-xs text-gray-500">{taskParamsSummary(task.params)}</span>
                <StatusBadge tone={taskTone(task.status)}>{task.status}</StatusBadge><div className="font-semibold text-amber-700">{task.costCredits}</div><span className={cx('text-xs font-medium', task.status === 'running' ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500')}>{taskDuration(task, now)}</span><span className="text-xs text-gray-400">{formatTime(task.createdAt)}</span>
                <div className="flex justify-end gap-1.5"><button type="button" onClick={() => onOpenDetail(task.id)} className="h-8 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.06]">详情</button><button type="button" disabled={task.status === 'running'} onClick={() => onDelete(task.id)} className="h-8 rounded-lg border border-rose-200 px-2.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-rose-400/20 dark:hover:bg-rose-400/10">清理</button></div>
              </div>
            )
          })}
          {!tasks.length && <EmptyState text="暂无生成日志" />}
        </div>
      </AdminTableShell>
    </SectionShell>
  )
}
