import { API_PROTOCOL_OPTIONS } from './modelConfigOptions'
import type { ModelConfigSectionProps } from './modelConfigTypes'
import { QualityUpstreamBinding } from './QualityUpstreamBinding'

export function ModelUpstreamFields({ draft, setDraft, upstreams }: ModelConfigSectionProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/10">
      <div>
        <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">质量渠道绑定</div>
        <div className="mt-1 text-xs leading-5 text-gray-500">
          每档质量可独立选择请求渠道与上游模型。低、高未设置时沿用中质量配置。
        </div>
      </div>

      <section className="rounded-xl border border-emerald-200/80 bg-white p-3 dark:border-emerald-400/20 dark:bg-gray-950">
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">API 协议</div>
        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="API 协议">
          {API_PROTOCOL_OPTIONS.map((option) => {
            const active = draft.apiProtocol === option.value
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setDraft((prev) => ({ ...prev, apiProtocol: option.value }))}
                className={active
                  ? 'min-h-10 rounded-lg border border-emerald-600 bg-emerald-600 px-2 py-2 text-xs font-semibold text-white shadow-sm'
                  : 'min-h-10 rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-600 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-white/[0.1] dark:bg-gray-900 dark:text-gray-300 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/10'}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <div className="mt-2 font-mono text-[11px] leading-5 text-emerald-700 dark:text-emerald-300">
          {API_PROTOCOL_OPTIONS.find((option) => option.value === draft.apiProtocol)?.hint}
        </div>
      </section>

      <div className="space-y-3">
        <QualityUpstreamBinding
          draft={draft}
          setDraft={setDraft}
          upstreams={upstreams}
          label="低质量"
          providerField="lowQualityUpstreamProviderId"
          modelField="lowQualityUpstreamModel"
          fallback
        />
        <QualityUpstreamBinding
          draft={draft}
          setDraft={setDraft}
          upstreams={upstreams}
          label="中质量"
          providerField="upstreamProviderId"
          modelField="upstreamModel"
          fallback={false}
        />
        <QualityUpstreamBinding
          draft={draft}
          setDraft={setDraft}
          upstreams={upstreams}
          label="高质量"
          providerField="highQualityUpstreamProviderId"
          modelField="highQualityUpstreamModel"
          fallback
        />
      </div>

    </div>
  )
}
