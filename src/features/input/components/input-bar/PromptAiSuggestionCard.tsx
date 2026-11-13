import type { PromptAiMode } from './usePromptAi'

interface PromptAiSuggestionCardProps {
  mode: PromptAiMode
  text: string
  streaming: boolean
  error: string | null
  canApply: boolean
  onStop: () => void
  onApply: (mode: 'replace' | 'append') => void
  onDismiss: () => void
}

const MODE_LABELS: Record<PromptAiMode, string> = {
  optimize: 'AI 优化建议',
  reverse: 'AI 反推提示词',
}

function SparkleIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  )
}

export default function PromptAiSuggestionCard({
  mode,
  text,
  streaming,
  error,
  canApply,
  onStop,
  onApply,
  onDismiss,
}: PromptAiSuggestionCardProps) {
  return (
    <div className="rounded-2xl border border-blue-200/80 bg-blue-50/60 p-3 dark:border-blue-400/20 dark:bg-blue-400/[0.06]">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-300">
          <SparkleIcon />
          {MODE_LABELS[mode]}
          {streaming && <span className="font-normal text-blue-400 dark:text-blue-400/70">生成中…</span>}
        </span>
        {!streaming && !error && text.trim() && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{text.trim().length} 字</span>
        )}
      </div>

      <div className="custom-scrollbar mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-200">
        {text || (error ? '' : '正在生成…')}
      </div>

      {error && <div className="mt-1.5 text-xs text-rose-500">{error}</div>}

      <div className="mt-2.5 flex items-center justify-end gap-2">
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="h-7 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-gray-300"
          >
            停止
          </button>
        ) : (
          <>
            {!error && canApply && (
              <>
                <button
                  type="button"
                  onClick={() => onApply('append')}
                  className="h-7 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]"
                >
                  追加到末尾
                </button>
                <button
                  type="button"
                  onClick={() => onApply('replace')}
                  className="h-7 rounded-lg bg-blue-500 px-2.5 text-xs font-semibold text-white transition hover:bg-blue-600"
                >
                  替换原提示词
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="h-7 rounded-lg px-2 text-xs text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              {error ? '关闭' : '放弃'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export { SparkleIcon }
