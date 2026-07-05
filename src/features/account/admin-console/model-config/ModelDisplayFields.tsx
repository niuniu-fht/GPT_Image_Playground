import { ModelIconPicker } from './ModelIconPicker'
import type { ModelConfigDraftProps } from './modelConfigTypes'

interface ModelDisplayFieldsProps extends ModelConfigDraftProps {
  onError: (message: string) => void
}

export function ModelDisplayFields({ draft, setDraft, onError }: ModelDisplayFieldsProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-400/15 dark:bg-blue-400/10">
      <div>
        <div className="text-sm font-semibold text-gray-950 dark:text-gray-50">展示信息</div>
        <div className="mt-1 text-xs text-gray-500">控制前台模型选择器里看到的名称、简介和图标。</div>
      </div>
      <ModelIconPicker
        value={draft.icon}
        onChange={(icon) => setDraft((prev) => ({ ...prev, icon }))}
        onError={onError}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-500">
          内部标识
          <input
            value={draft.name}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="例如：gpt-image-standard"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
            required
          />
        </label>
        <label className="block text-xs font-semibold text-gray-500">
          展示名称
          <input
            value={draft.displayName}
            onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
            placeholder="例如：标准图片生成"
            className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-normal text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
            required
          />
        </label>
      </div>
      <label className="block text-xs font-semibold text-gray-500">
        模型说明
        <textarea
          value={draft.description}
          onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
          rows={3}
          placeholder="说明模型适合的场景、速度、质量或限制"
          className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-normal leading-6 text-gray-900 outline-none focus:border-blue-400 dark:border-white/[0.08] dark:bg-gray-950 dark:text-gray-100"
          required
        />
      </label>
    </div>
  )
}
