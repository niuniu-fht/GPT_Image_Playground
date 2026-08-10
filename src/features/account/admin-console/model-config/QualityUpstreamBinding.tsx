import { useMemo, useState } from 'react'
import type { AdminUpstreamProvider } from '../../../../types'
import { useUpstreamModels } from '../upstream-config/useUpstreamModels'
import { cx, StatusBadge, upstreamHealthLabel, upstreamHealthTone } from '../shared'
import type { ModelConfigDraftProps } from './modelConfigTypes'

type ProviderField = 'upstreamProviderId' | 'lowQualityUpstreamProviderId' | 'highQualityUpstreamProviderId'
type ModelField = 'upstreamModel' | 'lowQualityUpstreamModel' | 'highQualityUpstreamModel'

interface QualityUpstreamBindingProps extends ModelConfigDraftProps {
  fallback: boolean
  label: string
  modelField: ModelField
  providerField: ProviderField
  upstreams: AdminUpstreamProvider[]
}

export function QualityUpstreamBinding({
  draft,
  fallback,
  label,
  modelField,
  providerField,
  setDraft,
  upstreams,
}: QualityUpstreamBindingProps) {
  const [query, setQuery] = useState('')
  const providerId = draft[providerField]
  const selectedProvider = upstreams.find((provider) => provider.id === providerId) ?? null
  const upstreamModels = useUpstreamModels(providerId)
  const filteredModelIds = useMemo(() => {
    const text = query.trim().toLowerCase()
    return upstreamModels.modelIds.filter((id) => !text || id.toLowerCase().includes(text))
  }, [query, upstreamModels.modelIds])
  const datalistId = `admin-${providerField}-model-options`

  return (
    <section className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-emerald-400/15 dark:bg-gray-950">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</div>
        {selectedProvider && (
          <StatusBadge tone={upstreamHealthTone(selectedProvider.lastHealthStatus)}>
            {upstreamHealthLabel(selectedProvider.lastHealthStatus)}
          </StatusBadge>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_96px]">
        <label className="block text-xs font-semibold text-gray-500">
          渠道
          <select
            value={providerId ?? ''}
            onChange={(event) => setDraft((prev) => ({ ...prev, [providerField]: event.target.value || null }))}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-emerald-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">{fallback ? '沿用中质量渠道' : '服务端默认渠道'}</option>
            {upstreams.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold text-gray-500">
          上游模型
          <input
            value={draft[modelField] ?? ''}
            onChange={(event) => setDraft((prev) => ({ ...prev, [modelField]: event.target.value || (fallback ? null : '') }))}
            list={datalistId}
            placeholder={fallback ? `沿用中质量模型（${draft.upstreamModel || '未设置'}）` : '选择或输入模型 ID'}
            required={!fallback || Boolean(providerId)}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 font-mono text-sm font-normal text-gray-900 outline-none focus:border-emerald-400 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-100"
          />
          <datalist id={datalistId}>
            {filteredModelIds.map((modelId) => <option key={modelId} value={modelId} />)}
          </datalist>
        </label>

        <button
          type="button"
          onClick={() => void upstreamModels.loadModels()}
          disabled={!providerId || upstreamModels.loading}
          className="mt-5 h-10 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {upstreamModels.loading ? '拉取中' : '拉取模型'}
        </button>
      </div>

      {selectedProvider && (
        <div className="mt-2 truncate text-xs text-gray-400">
          {selectedProvider.baseUrl} · 超时 {selectedProvider.timeoutSeconds} 秒
        </div>
      )}

      {upstreamModels.modelIds.length > 0 && (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`搜索已拉取的 ${upstreamModels.modelIds.length} 个模型`}
            className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs outline-none focus:border-emerald-400 dark:border-white/[0.08] dark:bg-gray-900"
          />
          <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
            {filteredModelIds.slice(0, 80).map((modelId) => (
              <button
                key={modelId}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, [modelField]: modelId }))}
                className={cx(
                  'rounded-lg border px-2 py-1 font-mono text-xs transition',
                  draft[modelField] === modelId
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-white/[0.06]',
                )}
              >
                {modelId}
              </button>
            ))}
          </div>
        </div>
      )}

      {upstreamModels.error && (
        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          {upstreamModels.error}
        </div>
      )}
    </section>
  )
}
