import { KNOWN_ASPECT_RATIOS } from '../../../../lib/size'
import type { ModelConfigDraftProps } from './modelConfigTypes'

export function ModelAspectRatioFields({ draft, setDraft }: ModelConfigDraftProps) {
  const unsupported = new Set(draft.unsupportedAspectRatios)

  const toggleRatio = (ratio: string) => {
    setDraft((prev) => {
      const next = new Set(prev.unsupportedAspectRatios)
      if (next.has(ratio)) next.delete(ratio)
      else next.add(ratio)
      return { ...prev, unsupportedAspectRatios: KNOWN_ASPECT_RATIOS.filter((item) => next.has(item)) }
    })
  }

  return (
    <section className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-400/15 dark:bg-sky-400/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">宽高比限制</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">默认全部可用。勾选后，该模型在创作台不显示该比例，服务端也会拒绝该比例请求。</div>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-semibold text-sky-700 shadow-sm dark:bg-gray-950 dark:text-sky-300">
          已限制 {unsupported.size}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {KNOWN_ASPECT_RATIOS.map((ratio) => {
          const checked = unsupported.has(ratio)
          return (
            <label
              key={ratio}
              className={checked
                ? 'flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2 py-2 text-xs font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200'
                : 'flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-2 text-xs font-semibold text-gray-700 hover:border-sky-400 dark:border-white/[0.1] dark:bg-gray-950 dark:text-gray-200'}
            >
              <input type="checkbox" checked={checked} onChange={() => toggleRatio(ratio)} />
              {ratio}
            </label>
          )
        })}
      </div>
    </section>
  )
}
