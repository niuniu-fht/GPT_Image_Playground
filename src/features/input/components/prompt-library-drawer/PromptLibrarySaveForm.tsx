interface PromptLibrarySaveFormProps {
  draftTitle: string
  draftContent: string
  hasCurrentPrompt: boolean
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onFillFromCurrent: () => void
  onSave: () => void
  onShare: () => void
}

export default function PromptLibrarySaveForm({
  draftTitle,
  draftContent,
  hasCurrentPrompt,
  onTitleChange,
  onContentChange,
  onFillFromCurrent,
  onSave,
  onShare,
}: PromptLibrarySaveFormProps) {
  return (
    <section className="rounded-2xl border border-gray-200/80 bg-white/70 p-3.5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="mb-3">
        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100">手动保存</h4>
      </div>

      <div className="space-y-2.5">
        <label className="block">
          <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">标题（可选）</span>
          <input
            value={draftTitle}
            onChange={(event) => onTitleChange(event.target.value)}
            type="text"
            placeholder="留空则自动截取提示词首行"
            className="w-full rounded-xl border border-gray-200/70 bg-white/80 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-gray-500 dark:text-gray-400">提示词内容</span>
          <textarea
            value={draftContent}
            onChange={(event) => onContentChange(event.target.value)}
            rows={4}
            placeholder="在这里粘贴或整理要保存的提示词"
            className="min-h-[6.75rem] w-full resize-y rounded-2xl border border-gray-200/70 bg-white/80 px-3.5 py-2.5 text-sm leading-6 text-gray-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/15 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onFillFromCurrent}
            disabled={!hasCurrentPrompt}
            className="inline-flex items-center rounded-full border border-gray-200/80 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06]"
          >
            带入当前输入
          </button>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center rounded-full bg-blue-500 px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-blue-600"
          >
            保存到提示词库
          </button>
          <button
            type="button"
            onClick={onShare}
            disabled={!draftContent.trim()}
            className="inline-flex items-center rounded-full border border-blue-200/80 bg-white px-3.5 py-1.5 text-[13px] font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-blue-400/20 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-blue-500/10"
          >
            分享到广场
          </button>
        </div>
      </div>
    </section>
  )
}
