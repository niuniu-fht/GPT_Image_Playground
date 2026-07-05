import { useMemo, useState } from 'react'
import { useUpstreamModels } from '../upstream-config/useUpstreamModels'
import { cx, formatTime, StatusBadge, upstreamHealthLabel, upstreamHealthTone } from '../shared'
import { API_PROTOCOL_OPTIONS } from './modelConfigOptions'
import type { ModelConfigSectionProps } from './modelConfigTypes'

export function ModelUpstreamFields({ draft, setDraft, upstreams }: ModelConfigSectionProps) {
  const [query, setQuery] = useState('')
  const selectedProvider = upstreams.find((provider) => provider.id === draft.upstreamProviderId) ?? null
  const upstreamModels = useUpstreamModels(draft.upstreamProviderId)
  const filteredModelIds = useMemo(() => {
    const text = query.trim().toLowerCase()
    return upstreamModels.modelIds.filter((id) => !text || id.toLowerCase().includes(text))
  }, [query, upstreamModels.modelIds])

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/10">
      <div>
        <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">上游绑定</div>
        <div className="mt-1 text-xs text-gray-500">选择真正请求的渠道和模型。渠道模型可从对应 `/v1/models` 拉取。</div>
      </div>

      <label className="block text-xs font-semibold text-gray-500">
        上游渠道
        <select
          value={draft.upstreamProviderId ?? ''}
          onChange={(event) => setDraft((prev) => ({ ...prev, upstreamProviderId: event.target.value || null }))}
          className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-emerald-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
        >
          <option value="">使用服务端环境变量默认上游</option>
          {upstreams.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.name}</option>
          ))}
        </select>
      </label>

      {selectedProvider && (
        <div className="rounded-xl border border-white/80 bg-white p-3 text-sm shadow-sm dark:border-white/[0.08] dark:bg-gray-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold text-gray-900 dark:text-gray-100">{selectedProvider.name}</div>
              <div className="mt-1 truncate text-xs text-gray-400">{selectedProvider.baseUrl}</div>
            </div>
            <StatusBadge tone={upstreamHealthTone(selectedProvider.lastHealthStatus)}>{upstreamHealthLabel(selectedProvider.lastHealthStatus)}</StatusBadge>
          </div>
          <div className="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-3">
            <span>优先级 {selectedProvider.priority}</span>
            <span>超时 {selectedProvider.timeoutSeconds} 秒</span>
            <span>{selectedProvider.lastCheckedAt ? formatTime(selectedProvider.lastCheckedAt) : '尚未检测'}</span>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <label className="block text-xs font-semibold text-gray-500">
          上游模型
          <input
            value={draft.upstreamModel}
            onChange={(event) => setDraft((prev) => ({ ...prev, upstreamModel: event.target.value }))}
            list="admin-upstream-model-options"
            placeholder="选择或输入模型 ID"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 font-mono text-sm font-normal text-gray-900 outline-none focus:border-emerald-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
            required
          />
          <datalist id="admin-upstream-model-options">
            {filteredModelIds.map((modelId) => <option key={modelId} value={modelId} />)}
          </datalist>
        </label>
        <button
          type="button"
          onClick={() => void upstreamModels.loadModels()}
          disabled={!draft.upstreamProviderId || upstreamModels.loading}
          className="mt-5 h-10 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {upstreamModels.loading ? '拉取中' : '拉取模型'}
        </button>
      </div>

      {upstreamModels.modelIds.length > 0 && (
        <div className="rounded-xl border border-white/80 bg-white p-3 dark:border-white/[0.08] dark:bg-gray-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-gray-500">已获取 {upstreamModels.modelIds.length} 个模型</div>
            <div className="text-xs text-gray-400">
              {upstreamModels.checkedAt ? `${formatTime(upstreamModels.checkedAt)} · ${upstreamModels.latencyMs ?? '-'}ms` : ''}
            </div>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索模型 ID"
            className="mt-2 h-9 w-full rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-emerald-400 dark:border-white/[0.08] dark:bg-gray-900"
          />
          <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {filteredModelIds.slice(0, 80).map((modelId) => (
              <button
                key={modelId}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, upstreamModel: modelId }))}
                className={cx(
                  'rounded-lg border px-2 py-1 font-mono text-xs transition',
                  draft.upstreamModel === modelId
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

      {upstreamModels.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{upstreamModels.error}</div>}

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
