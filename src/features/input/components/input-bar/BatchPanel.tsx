import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../../../store'
import {
  BATCH_CONCURRENCY,
  BATCH_MAX_ITEMS,
  cancelBatchQueue,
  clearBatchQueue,
  getBatchQueueSnapshot,
  startBatchQueue,
  subscribeBatchQueue,
  type BatchQueueEntry,
  type BatchQueueState,
} from '../../../../store/batchQueue'
import {
  resolveAvailableQualities,
  resolveEffectiveModelQuality,
  resolveModelCostForSize,
} from '../../../../lib/modelCost'
import { calculateImageSize, resolveImageSizeTier, resolveKnownAspectRatio, type SizeTier } from '../../../../lib/size'
import ModelSelector from './ModelSelector'
import type { ModelConfig, TaskParams } from '../../../../types'

const RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'] as const
const TIERS: SizeTier[] = ['1K', '2K', '4K']
const QUALITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'xhigh', label: '极高' },
  { value: 'max', label: '最高' },
] as const
const MAX_IMPORT_BYTES = 10 * 1024 * 1024

const QUALITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '极高',
  max: '最高',
}

const ENTRY_STATUS_META: Record<string, { label: string; className: string }> = {
  queued: { label: '排队中', className: 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400' },
  generating: { label: '生成中', className: 'bg-blue-50 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300' },
  done: { label: '完成', className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300' },
  failed: { label: '失败', className: 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300' },
  cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-gray-500' },
}

const BATCH_STATUS_META: Record<string, { label: string; tone: string }> = {
  running: { label: '进行中', tone: 'text-blue-600 dark:text-blue-300' },
  done: { label: '全部完成', tone: 'text-emerald-600 dark:text-emerald-300' },
  partial_failed: { label: '部分失败', tone: 'text-amber-600 dark:text-amber-300' },
  cancelled: { label: '已取消', tone: 'text-gray-500 dark:text-gray-400' },
}

function parsePromptLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function pillClass(active: boolean) {
  return active
    ? 'border-slate-950 bg-white text-slate-950 shadow-sm dark:border-white dark:bg-slate-900 dark:text-white'
    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/[0.1] dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-white/[0.06]'
}

interface BatchPanelProps {
  prompts: string
  onPromptsChange: (value: string) => void
  activeModel: ModelConfig | null
  models: ModelConfig[]
  params: TaskParams
  activeModelId: string | null
  onActiveModelChange: (modelId: string) => void
  onSetParams: (params: Partial<TaskParams>) => void
  creditBalance: number
}

export default function BatchPanel({
  prompts,
  onPromptsChange,
  activeModel,
  models,
  params,
  activeModelId,
  onActiveModelChange,
  onSetParams,
  creditBalance,
}: BatchPanelProps) {
  const showToast = useStore((state) => state.showToast)
  const tasks = useStore((state) => state.tasks)
  const [queue, setQueue] = useState<BatchQueueState | null>(() => getBatchQueueSnapshot())
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => subscribeBatchQueue(() => setQueue(getBatchQueueSnapshot())), [])

  const lines = parsePromptLines(prompts)
  const lineCount = lines.length
  const overLimit = lineCount > BATCH_MAX_ITEMS
  const activeTier = resolveImageSizeTier(params.size)
  const activeRatio = resolveKnownAspectRatio(params.size)
  const availableQualities = resolveAvailableQualities(activeModel, activeTier)
  const effectiveQuality = resolveEffectiveModelQuality(activeModel, params.quality, params.size)
  const perLineCost = resolveModelCostForSize(activeModel, params.size, effectiveQuality)
  const canSubmit = lineCount > 0 && !overLimit && Boolean(activeModel) && !submitting && !queue

  const handleImportFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      showToast('文件过大（最大 10MB）', 'error')
      return
    }
    const text = await file.text()
    const imported = parsePromptLines(text)
    if (!imported.length) {
      showToast('文件中没有有效提示词', 'error')
      return
    }
    if (imported.length > BATCH_MAX_ITEMS) {
      onPromptsChange(imported.slice(0, BATCH_MAX_ITEMS).join('\n'))
      showToast(`文件共 ${imported.length} 条提示词，已取前 ${BATCH_MAX_ITEMS} 条`, 'info')
      return
    }
    onPromptsChange(imported.join('\n'))
    showToast(`已导入 ${imported.length} 条提示词`, 'success')
  }

  const handleSubmit = () => {
    if (!activeModelId) {
      showToast('请先选择模型', 'error')
      return
    }
    if (!lines.length) {
      showToast('请先输入提示词', 'error')
      return
    }
    const quality = resolveEffectiveModelQuality(activeModel, params.quality, params.size)
    const batchId = startBatchQueue(lines, { size: params.size, quality })
    if (!batchId) {
      showToast('已有批次在进行中，请等待完成', 'error')
      return
    }
    showToast(`批次已创建：${lines.length} 条进入队列，预估 ${perLineCost * lines.length} 积分`, 'success')
  }

  const handleCancel = () => {
    cancelBatchQueue()
  }

  // ============ 进度视图（队列运行中/已完成未清理） ============
  if (queue) {
    const statusMeta = BATCH_STATUS_META[queue.status]
    const taskById = new Map(tasks.map((task) => [task.id, task]))
    const doneCount = queue.entries.filter((entry) => {
      if (entry.status === 'done') return true
      const task = entry.taskId ? taskById.get(entry.taskId) : undefined
      return task?.status === 'done'
    }).length
    const failedCount = queue.entries.filter((entry) => entry.status === 'failed').length
    const totalCount = queue.entries.length
    const canCancel = queue.status === 'running'

    const statusOf = (entry: BatchQueueEntry) => {
      const task = entry.taskId ? taskById.get(entry.taskId) : undefined
      if (entry.status === 'generating' && task?.status === 'done') return 'done'
      if (entry.status === 'generating' && task?.status === 'error') return 'failed'
      return entry.status
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{queue.name}</div>
            {statusMeta && <span className={`text-sm font-semibold ${statusMeta.tone}`}>{statusMeta.label}</span>}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
            <span>完成 {doneCount} / {totalCount} 张{failedCount ? ` · 失败 ${failedCount}` : ''} · 已自动加入画廊</span>
            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="font-medium text-rose-500 transition hover:text-rose-600"
              >
                取消剩余任务
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {queue.entries.map((entry) => {
            const status = statusOf(entry)
            const meta = ENTRY_STATUS_META[status] ?? ENTRY_STATUS_META.queued
            const task = entry.taskId ? taskById.get(entry.taskId) : undefined
            const firstImage =
              task?.status === 'done' && Array.isArray(task.outputImages) && task.outputImages.length > 0
                ? task.outputImages[0]
                : null
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gray-100 text-xs text-gray-400 dark:bg-white/[0.06] dark:text-gray-500">
                  #{entry.seq}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-800 dark:text-gray-100">{entry.prompt}</span>
                  {(entry.error || (status === 'failed' && task?.error)) && (
                    <span className="mt-0.5 block truncate text-xs text-rose-400">
                      {entry.error || task?.error}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${meta.className}`}>
                  {meta.label}
                </span>
                {firstImage && (
                  <button
                    type="button"
                    onClick={() => useStore.getState().setLightboxImageId(firstImage)}
                    className="shrink-0 rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-500 transition hover:text-gray-800 dark:border-white/[0.08] dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    查看
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {!['running', 'paused'].includes(queue.status) && (
          <button
            type="button"
            onClick={() => {
              onPromptsChange('')
              clearBatchQueue()
            }}
            className="w-full rounded-2xl bg-slate-950 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100"
          >
            发起新批次
          </button>
        )}
      </div>
    )
  }

  // ============ 输入视图 ============
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">批量提示词</div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.1] dark:text-gray-300 dark:hover:bg-white/[0.06]"
          >
            导入 txt
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) await handleImportFile(file)
            }}
          />
        </div>
        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          一行一个提示词，每行生成一张图；最多 50 条/批，支持粘贴多行或导入 txt 文件（超出自动取前 50 行）。
        </div>
        <textarea
          value={prompts}
          onChange={(event) => onPromptsChange(event.target.value)}
          rows={10}
          spellCheck={false}
          placeholder={'一只橘猫在窗台晒太阳\n赛博朋克风格的城市夜景\n水彩风格的樱花树…'}
          className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-mono text-sm leading-6 text-gray-900 outline-none placeholder:font-sans placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-600"
        />
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className={`truncate ${overLimit ? 'font-medium text-rose-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {overLimit
              ? `超出单批上限（最多 ${BATCH_MAX_ITEMS} 条），请删减到 ${BATCH_MAX_ITEMS} 条以内`
              : '每行一个提示词，空行自动忽略'}
          </span>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 font-semibold tabular-nums ${
              overLimit
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300'
                : lineCount >= BATCH_MAX_ITEMS * 0.8
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300'
            }`}
            title={`已识别提示词 ${lineCount} 条，单批上限 ${BATCH_MAX_ITEMS} 条`}
          >
            已识别 <span className={`text-sm font-bold ${overLimit ? 'text-rose-500' : 'text-gray-900 dark:text-gray-100'}`}>{lineCount}</span>
            <span className="opacity-60"> / {BATCH_MAX_ITEMS}</span>
          </span>
        </div>
        {lineCount > 0 && (
          <button
            type="button"
            onClick={() => onPromptsChange('')}
            className="mt-2 text-xs font-medium text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            清空全部
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">模型与参数</div>
        <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">批次内所有提示词共用以下模型与参数设置</div>
        <div className="mt-3">
          <ModelSelector
            models={models}
            activeModelId={activeModelId}
            compact={false}
            params={params}
            onChange={onActiveModelChange}
          />
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">分辨率档位</div>
            <div className="grid grid-cols-3 gap-2">
              {TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => {
                    const ratio = activeRatio ?? '1:1'
                    const size = calculateImageSize(tier, ratio)
                    if (size) onSetParams({ size })
                  }}
                  className={`h-8 rounded-lg border text-[13px] font-semibold transition ${pillClass(activeTier === tier)}`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">宽高比</div>
            <div className="grid grid-cols-5 gap-2">
              {RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => {
                    const size = calculateImageSize(activeTier, ratio)
                    if (size) onSetParams({ size })
                  }}
                  className={`h-8 rounded-lg border text-[13px] font-semibold transition ${pillClass(activeRatio === ratio)}`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">质量</div>
            <div className="grid grid-cols-5 gap-2">
              {QUALITY_OPTIONS.map((option) => {
                const supported = availableQualities.includes(option.value)
                const active = effectiveQuality === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!supported}
                    onClick={() => onSetParams({ quality: option.value })}
                    title={supported ? undefined : '该模型不支持此质量档位'}
                    className={`h-8 rounded-lg border text-[13px] font-semibold transition ${pillClass(active)} ${
                      supported ? '' : 'cursor-not-allowed opacity-40'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 dark:bg-white/[0.06]">
            {activeModel ? `${params.size}（${QUALITY_LABELS[effectiveQuality] ?? '中'}·${activeTier}）` : '未选择模型'}
          </span>
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 dark:bg-white/[0.06]">每行 {perLineCost} 积分</span>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 dark:border-amber-400/20 dark:bg-amber-400/[0.07]">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-amber-700 dark:text-amber-200">共 {lineCount} 张</span>
          <strong className="text-lg font-bold tabular-nums text-amber-800 dark:text-amber-100">
            {perLineCost * lineCount}<span className="ml-1 text-xs font-semibold">积分</span>
          </strong>
        </div>
        <div className="mt-1 text-xs text-amber-700/75 dark:text-amber-200/70">
          余额 {creditBalance} 积分 · 每批最多 {BATCH_MAX_ITEMS} 张 · 并发生成 {BATCH_CONCURRENCY} 张 · 按行扣费，失败的行自动退还积分
        </div>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`w-full rounded-2xl py-3.5 text-sm font-medium shadow-sm transition ${
          canSubmit
            ? 'bg-blue-500 text-white hover:bg-blue-600'
            : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-white/[0.06] dark:text-gray-500'
        }`}
      >
        {submitting
          ? '创建批次中…'
          : overLimit
            ? `超出单批上限（${BATCH_MAX_ITEMS} 条）`
            : lineCount === 0
              ? '请先输入提示词'
              : `生成 ${lineCount} 张`}
      </button>
    </div>
  )
}
