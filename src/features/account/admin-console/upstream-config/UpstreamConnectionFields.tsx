import type { UpstreamConfigDraftProps } from './upstreamConfigTypes'

export function UpstreamConnectionFields({ draft, setDraft }: UpstreamConfigDraftProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-400/15 dark:bg-blue-400/10">
      <div>
        <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">连接信息</div>
        <div className="mt-1 text-xs text-gray-500">配置兼容 OpenAI 协议的服务地址，系统会通过 `/v1/models` 进行检测。</div>
      </div>
      <label className="block text-xs font-semibold text-gray-500">
        渠道名称
        <input
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="例如：官方 OpenAI / 国内中转"
          className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          required
        />
      </label>
      <label className="block text-xs font-semibold text-gray-500">
        基础地址
        <input
          value={draft.baseUrl}
          onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
          placeholder="https://api.openai.com"
          className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 font-mono text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          required
        />
      </label>
      <label className="block text-xs font-semibold text-gray-500">
        备注
        <textarea
          value={draft.notes}
          onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
          rows={3}
          placeholder="记录用途、额度、联系人或特殊限制"
          className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
        />
      </label>
    </div>
  )
}
