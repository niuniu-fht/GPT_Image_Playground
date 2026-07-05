import type { UpstreamConfigDraftProps } from './upstreamConfigTypes'

interface UpstreamSecurityFieldsProps extends UpstreamConfigDraftProps {
  editingUpstreamId: string | null
}

export function UpstreamSecurityFields({ draft, setDraft, editingUpstreamId }: UpstreamSecurityFieldsProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-400/15 dark:bg-amber-400/10">
      <div>
        <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">密钥与调度</div>
        <div className="mt-1 text-xs text-gray-500">密钥只保存在服务端。编辑已有渠道时，留空表示不修改密钥。</div>
      </div>
      <label className="block text-xs font-semibold text-gray-500">
        API Key{editingUpstreamId ? '（留空不修改）' : ''}
        <input
          value={draft.apiKey}
          onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
          type="password"
          autoComplete="off"
          className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 font-mono text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          required={!editingUpstreamId}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-500">
          优先级
          <input
            type="number"
            value={draft.priority}
            onChange={(event) => setDraft((prev) => ({ ...prev, priority: Number(event.target.value) }))}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          />
        </label>
        <label className="block text-xs font-semibold text-gray-500">
          超时秒数
          <select
            value={draft.timeoutSeconds}
            onChange={(event) => setDraft((prev) => ({ ...prev, timeoutSeconds: Number(event.target.value) }))}
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-amber-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          >
            <option value={60}>60 秒</option>
            <option value={180}>180 秒</option>
            <option value={300}>300 秒</option>
            <option value={900}>900 秒</option>
            <option value={1800}>1800 秒</option>
            <option value={3600}>3600 秒</option>
          </select>
        </label>
      </div>
      <label className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-gray-950">
        启用渠道
        <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
      </label>
    </div>
  )
}
