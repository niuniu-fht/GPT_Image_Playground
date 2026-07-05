import { formatTime, StatusBadge, upstreamHealthLabel, upstreamHealthSnapshot, upstreamHealthTone } from '../shared'
import type { UpstreamDiagnosticsProps } from './upstreamConfigTypes'

export function UpstreamDiagnosticsPanel({
  editingUpstreamId,
  upstreams,
  upstreamTests,
  testingUpstreamId,
  onTest,
}: UpstreamDiagnosticsProps) {
  if (!editingUpstreamId) return null

  const provider = upstreams.find((item) => item.id === editingUpstreamId)
  if (!provider) return null

  const health = upstreamHealthSnapshot(provider, upstreamTests[editingUpstreamId])

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-400/15 dark:bg-emerald-400/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">渠道诊断</div>
          <div className="mt-1 text-xs leading-5 text-gray-500">检测会调用该渠道的模型列表接口，并更新最近健康状态。</div>
        </div>
        <button
          type="button"
          onClick={() => onTest(editingUpstreamId)}
          disabled={testingUpstreamId === editingUpstreamId}
          className="h-9 shrink-0 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {testingUpstreamId === editingUpstreamId ? '测试中' : '测试连接'}
        </button>
      </div>
      <div className="mt-3 rounded-xl border border-white/70 bg-white p-3 text-sm shadow-sm dark:border-white/[0.08] dark:bg-gray-950">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge tone={upstreamHealthTone(health.status)}>{upstreamHealthLabel(health.status)}</StatusBadge>
          <span className="text-xs text-gray-400">{formatTime(health.checkedAt)}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-white/[0.04]">
            <div className="font-semibold">{health.latencyMs == null ? '-' : `${health.latencyMs}ms`}</div>
            <div className="text-[11px] text-gray-400">延迟</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-white/[0.04]">
            <div className="font-semibold">{health.httpStatus || '-'}</div>
            <div className="text-[11px] text-gray-400">HTTP</div>
          </div>
          <div className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-white/[0.04]">
            <div className="font-semibold">{health.modelCount ?? provider._count?.models ?? '-'}</div>
            <div className="text-[11px] text-gray-400">模型数</div>
          </div>
        </div>
        {health.message && <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500 dark:bg-white/[0.04]">{health.message}</div>}
      </div>
    </div>
  )
}
