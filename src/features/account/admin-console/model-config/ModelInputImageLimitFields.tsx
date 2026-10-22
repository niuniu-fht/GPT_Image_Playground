import { DEFAULT_MAX_INPUT_IMAGES } from '../../../../lib/modelCost'
import type { ModelDraft } from '../shared'
import type { ModelConfigDraftProps } from './modelConfigTypes'

type QualityPrefix = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

type LimitField = keyof Pick<
  ModelDraft,
  | 'lowQualityMaxInputImages' | 'lowQualityMaxInputImages2K' | 'lowQualityMaxInputImages4K'
  | 'mediumQualityMaxInputImages' | 'mediumQualityMaxInputImages2K' | 'mediumQualityMaxInputImages4K'
  | 'highQualityMaxInputImages' | 'highQualityMaxInputImages2K' | 'highQualityMaxInputImages4K'
  | 'xhighQualityMaxInputImages' | 'xhighQualityMaxInputImages2K' | 'xhighQualityMaxInputImages4K'
  | 'maxQualityMaxInputImages' | 'maxQualityMaxInputImages2K' | 'maxQualityMaxInputImages4K'
>

const TIER_SUFFIXES: Array<{ suffix: '' | '2K' | '4K'; label: string }> = [
  { suffix: '', label: '1K' },
  { suffix: '2K', label: '2K' },
  { suffix: '4K', label: '4K' },
]

function limitRow(prefix: QualityPrefix): Array<{ field: LimitField; label: string }> {
  return TIER_SUFFIXES.map(({ suffix, label }) => ({
    field: `${prefix}QualityMaxInputImages${suffix}` as LimitField,
    label,
  }))
}

function isGptImage2Draft(draft: ModelDraft): boolean {
  return /^gpt-image(?:$|[-_:/.])/i.test(draft.name) || /^gpt-image(?:$|[-_:/.])/i.test(draft.upstreamModel)
}

function LimitInput({ draft, field, setDraft }: ModelConfigDraftProps & { field: LimitField }) {
  const value = draft[field]
  return (
    <input
      type="number"
      min={0}
      max={DEFAULT_MAX_INPUT_IMAGES}
      placeholder={`默认 ${DEFAULT_MAX_INPUT_IMAGES}`}
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value
        if (raw === '') {
          setDraft((prev) => ({ ...prev, [field]: null }))
          return
        }
        const parsed = Number(raw)
        const clamped = Number.isFinite(parsed)
          ? Math.max(0, Math.min(Math.floor(parsed), DEFAULT_MAX_INPUT_IMAGES))
          : null
        setDraft((prev) => ({ ...prev, [field]: clamped }))
      }}
      className="h-9 min-w-0 w-full rounded-lg border border-gray-200 bg-white px-2 text-center text-sm font-semibold text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-300 focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-600"
    />
  )
}

function LimitQualityRow({
  draft,
  fields,
  label,
  setDraft,
}: ModelConfigDraftProps & { fields: Array<{ field: LimitField; label: string }>; label: string }) {
  return (
    <div className="grid grid-cols-[88px_repeat(3,1fr)] items-center gap-2 border-b border-sky-100 p-2 last:border-b-0 dark:border-sky-400/15">
      <div className="px-1 text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</div>
      {fields.map((item) => (
        <LimitInput key={item.field} draft={draft} field={item.field} setDraft={setDraft} />
      ))}
    </div>
  )
}

export function ModelInputImageLimitFields({ draft, setDraft }: ModelConfigDraftProps) {
  const gptImageApplicable = isGptImage2Draft(draft)

  return (
    <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-400/15 dark:bg-sky-400/10">
      <div>
        <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">参考图上传上限</div>
        <div className="mt-1 text-xs text-gray-500">
          按“质量 × 分辨率”限制单次任务可上传的参考图数量，留空表示使用默认上限 {DEFAULT_MAX_INPUT_IMAGES} 张；填 0 表示该组合禁止上传参考图。
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-sky-200/70 bg-white dark:border-sky-400/20 dark:bg-gray-950">
        <div className="grid grid-cols-[88px_repeat(3,1fr)] border-b border-sky-100 bg-sky-50/70 text-xs font-semibold text-sky-800 dark:border-sky-400/15 dark:bg-sky-400/10 dark:text-sky-100">
          <div className="px-3 py-2">质量</div>
          {TIER_SUFFIXES.map((cell) => (
            <div key={cell.label} className="px-2 py-2 text-center">{cell.label}</div>
          ))}
        </div>

        {gptImageApplicable ? (
          <>
            <LimitQualityRow draft={draft} setDraft={setDraft} label="低" fields={limitRow('low')} />
            <LimitQualityRow draft={draft} setDraft={setDraft} label="中" fields={limitRow('medium')} />
            <LimitQualityRow draft={draft} setDraft={setDraft} label="高" fields={limitRow('high')} />
            <LimitQualityRow draft={draft} setDraft={setDraft} label="极高" fields={limitRow('xhigh')} />
            <LimitQualityRow draft={draft} setDraft={setDraft} label="最高" fields={limitRow('max')} />
          </>
        ) : (
          <>
            <LimitQualityRow draft={draft} setDraft={setDraft} label="中" fields={limitRow('medium')} />
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              分质量配置仅对模型标识或上游模型以 gpt-image 开头的模型开放，其它模型仅按“中”质量生效。
            </div>
          </>
        )}
      </div>
    </div>
  )
}
