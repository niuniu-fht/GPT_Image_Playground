import { resolveEffectiveModelQuality } from '../../../../lib/modelCost'
import { resolveImageSizeTier } from '../../../../lib/size'
import type { ModelConfig, TaskParams } from '../../../../types'

interface GenerationCostNoticeProps {
  activeModel: ModelConfig | null
  estimatedCost: number
  params: TaskParams
  recentlyReset: boolean
}

export default function GenerationCostNotice({
  activeModel,
  estimatedCost,
  params,
  recentlyReset,
}: GenerationCostNoticeProps) {
  if (!activeModel) return null

  const quality = resolveEffectiveModelQuality(activeModel, params.quality)
  const qualityLabel = quality === 'low' ? '低质量' : quality === 'high' ? '高质量' : '中质量'
  const tier = resolveImageSizeTier(params.size)
  const quantity = Math.max(1, Math.floor(params.n))

  return (
    <div
      className={`flex min-h-14 items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-500 ${
        recentlyReset
          ? 'border-amber-300 bg-amber-50 shadow-[0_0_0_3px_rgba(245,158,11,0.10)] dark:border-amber-400/35 dark:bg-amber-400/10'
          : 'border-amber-200/80 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-400/[0.07]'
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500 text-white shadow-sm" aria-hidden="true">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M12 2v20M17 6.5c0-1.66-2.24-3-5-3s-5 1.34-5 3 2.24 3 5 3 5 1.34 5 3-2.24 3-5 3-5-1.34-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-amber-700 dark:text-amber-300">
          {recentlyReset ? '已切换为最低消耗配置' : '本次生成将扣除'}
        </span>
        <span className="mt-0.5 block truncate text-xs text-amber-700/75 dark:text-amber-200/65">
          {qualityLabel} · {tier} · {quantity} 张
        </span>
      </span>
      <strong className="shrink-0 text-lg font-bold text-amber-800 dark:text-amber-200">
        {estimatedCost}<span className="ml-1 text-xs font-semibold">积分</span>
      </strong>
    </div>
  )
}
