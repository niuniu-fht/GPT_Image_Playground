import type { ModelDraft } from '../shared'
import { StatusBadge } from '../shared'
import type { ModelConfigDraftProps } from './modelConfigTypes'

type CostField = keyof Pick<
  ModelDraft,
  | 'costCredits'
  | 'costCredits2K'
  | 'costCredits4K'
  | 'lowQualityCostCredits'
  | 'lowQualityCostCredits2K'
  | 'lowQualityCostCredits4K'
  | 'highQualityCostCredits'
  | 'highQualityCostCredits2K'
  | 'highQualityCostCredits4K'
>

type EnabledField = keyof Pick<
  ModelDraft,
  | 'lowQuality1KEnabled'
  | 'lowQuality2KEnabled'
  | 'lowQuality4KEnabled'
  | 'mediumQuality1KEnabled'
  | 'mediumQuality2KEnabled'
  | 'mediumQuality4KEnabled'
  | 'highQuality1KEnabled'
  | 'highQuality2KEnabled'
  | 'highQuality4KEnabled'
>

type BillingCell = { field: CostField; enabledField: EnabledField; label: string }

const LOW_COST_FIELDS: BillingCell[] = [
  { field: 'lowQualityCostCredits', enabledField: 'lowQuality1KEnabled', label: '1K' },
  { field: 'lowQualityCostCredits2K', enabledField: 'lowQuality2KEnabled', label: '2K' },
  { field: 'lowQualityCostCredits4K', enabledField: 'lowQuality4KEnabled', label: '4K' },
]

const MEDIUM_COST_FIELDS: BillingCell[] = [
  { field: 'costCredits', enabledField: 'mediumQuality1KEnabled', label: '1K' },
  { field: 'costCredits2K', enabledField: 'mediumQuality2KEnabled', label: '2K' },
  { field: 'costCredits4K', enabledField: 'mediumQuality4KEnabled', label: '4K' },
]

const HIGH_COST_FIELDS: BillingCell[] = [
  { field: 'highQualityCostCredits', enabledField: 'highQuality1KEnabled', label: '1K' },
  { field: 'highQualityCostCredits2K', enabledField: 'highQuality2KEnabled', label: '2K' },
  { field: 'highQualityCostCredits4K', enabledField: 'highQuality4KEnabled', label: '4K' },
]

function normalizeCost(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0
}

function isGptImage2Draft(draft: ModelDraft): boolean {
  return /^gpt-image(?:$|[-_:/.])/i.test(draft.name) || /^gpt-image(?:$|[-_:/.])/i.test(draft.upstreamModel)
}

function CostInput({
  draft,
  enabledField,
  field,
  setDraft,
}: ModelConfigDraftProps & { enabledField: EnabledField; field: CostField }) {
  const enabled = draft[enabledField]
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(event) => setDraft((prev) => ({ ...prev, [enabledField]: event.target.checked }))}
        aria-label={`${enabledField} 开关`}
      />
      <input
        type="number"
        min={0}
        value={draft[field]}
        disabled={!enabled}
        onChange={(event) => setDraft((prev) => ({ ...prev, [field]: normalizeCost(event.target.value) }))}
        className="h-9 min-w-0 w-full rounded-lg border border-gray-200 bg-white px-2 text-center text-sm font-semibold text-gray-900 outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100 dark:disabled:bg-gray-900 dark:disabled:text-gray-600"
      />
    </div>
  )
}

function CostRow({
  draft,
  fields,
  label,
  setDraft,
}: ModelConfigDraftProps & {
  fields: BillingCell[]
  label: string
}) {
  return (
    <div className="grid grid-cols-[88px_repeat(3,1fr)] items-center gap-2 border-b border-amber-100 p-2 last:border-b-0 dark:border-amber-400/15">
      <div className="px-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
        {label}
      </div>
      {fields.map((item) => (
        <CostInput key={item.field} draft={draft} enabledField={item.enabledField} field={item.field} setDraft={setDraft} />
      ))}
    </div>
  )
}

export function ModelBillingFields({ draft, setDraft }: ModelConfigDraftProps) {
  const highQualityApplicable = isGptImage2Draft(draft)

  return (
    <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-400/15 dark:bg-amber-400/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">计费与状态</div>
          <div className="mt-1 text-xs text-gray-500">
            按“分辨率 × 质量”配置单张图片积分；图片数量会按单价乘以张数扣费。
          </div>
        </div>
        <StatusBadge tone={draft.enabled ? 'green' : 'gray'}>{draft.enabled ? '已启用' : '已停用'}</StatusBadge>
      </div>

      <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white dark:border-amber-400/20 dark:bg-gray-950">
        <div className="grid grid-cols-[88px_repeat(3,1fr)] border-b border-amber-100 bg-amber-50/70 text-xs font-semibold text-amber-800 dark:border-amber-400/15 dark:bg-amber-400/10 dark:text-amber-100">
          <div className="px-3 py-2">质量</div>
          {MEDIUM_COST_FIELDS.map((item) => (
            <div key={item.label} className="px-2 py-2 text-center">{item.label}</div>
          ))}
        </div>

        {highQualityApplicable ? (
          <>
            <CostRow
              draft={draft}
              setDraft={setDraft}
              label="低"
              fields={LOW_COST_FIELDS}
            />
            <CostRow
              draft={draft}
              setDraft={setDraft}
              label="中"
              fields={MEDIUM_COST_FIELDS}
            />
            <CostRow
              draft={draft}
              setDraft={setDraft}
              label="高"
              fields={HIGH_COST_FIELDS}
            />
          </>
        ) : (
          <>
            <CostRow draft={draft} setDraft={setDraft} label="中" fields={MEDIUM_COST_FIELDS} />
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              低 / 中 / 高质量选择仅对模型标识或上游模型以 gpt-image 开头的模型开放，其它模型仅按“中”质量计费。
            </div>
          </>
        )}
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
