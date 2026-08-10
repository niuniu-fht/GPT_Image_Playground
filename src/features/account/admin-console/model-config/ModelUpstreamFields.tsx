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

      <label className="block text-xs font-semibold text-gray-500">
        API 协议
        <select
          value={draft.apiProtocol}
          onChange={(event) => setDraft((prev) => ({ ...prev, apiProtocol: event.target.value as typeof draft.apiProtocol }))}
          className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-emerald-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
        >
          {API_PROTOCOL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label} - {option.hint}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
