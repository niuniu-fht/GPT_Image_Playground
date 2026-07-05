import { StatusBadge } from '../shared'
import type { ModelConfigDraftProps } from './modelConfigTypes'

export function ModelBillingFields({ draft, setDraft }: ModelConfigDraftProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-400/15 dark:bg-amber-400/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">计费与状态</div>
          <div className="mt-1 text-xs text-gray-500">这些字段会直接影响用户可见性和每次生成扣费。</div>
        </div>
        <StatusBadge tone={draft.enabled ? 'green' : 'gray'}>{draft.enabled ? '已启用' : '已停用'}</StatusBadge>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-semibold text-gray-500">
          1K 消耗积分
          <input
            type="number"
            min={0}
            value={draft.costCredits}
            onChange={(event) => setDraft((prev) => ({ ...prev, costCredits: Number(event.target.value) }))}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <label className="block text-xs font-semibold text-gray-500">
          2K 消耗积分
          <input
            type="number"
            min={0}
            value={draft.costCredits2K}
            onChange={(event) => setDraft((prev) => ({ ...prev, costCredits2K: Number(event.target.value) }))}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <label className="block text-xs font-semibold text-gray-500">
          4K 消耗积分
          <input
            type="number"
            min={0}
            value={draft.costCredits4K}
            onChange={(event) => setDraft((prev) => ({ ...prev, costCredits4K: Number(event.target.value) }))}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-500">
          展示排序
          <input
            type="number"
            value={draft.sortOrder}
            onChange={(event) => setDraft((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-gray-950">
          前台可选
          <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
        </label>
        <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-gray-950">
          标记为新模型
          <input type="checkbox" checked={draft.isNew} onChange={(event) => setDraft((prev) => ({ ...prev, isNew: event.target.checked }))} />
        </label>
      </div>
    </div>
  )
}
