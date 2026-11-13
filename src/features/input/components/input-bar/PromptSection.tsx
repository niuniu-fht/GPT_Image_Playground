import type { KeyboardEventHandler, RefObject } from 'react'
import PromptAiSuggestionCard, { SparkleIcon } from './PromptAiSuggestionCard'
import type { PromptAiController } from './usePromptAi'

interface PromptSectionProps {
  prompt: string
  normalizedPrompt: string
  promptHintText: string
  isMobile: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onPromptChange: (value: string) => void
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
  promptAi?: PromptAiController
}

export default function PromptSection({
  prompt,
  normalizedPrompt,
  promptHintText,
  isMobile,
  textareaRef,
  onPromptChange,
  onKeyDown,
  promptAi,
}: PromptSectionProps) {
  const aiOptimizeAvailable = Boolean(
    promptAi && promptAi.enabled && !promptAi.streaming && !promptAi.active,
  )
  const showSuggestionCard = Boolean(promptAi?.active && promptAi.mode)
  // 后台关闭 AI 对话时完全不渲染入口（服务端同时 403 拒绝）
  const showAiButton = Boolean(promptAi && promptAi.enabled)

  return (
    <div className="flex flex-shrink-0 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">提示词</span>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{promptHintText}</p>
        </div>
        <div className="flex items-center gap-2">
          {promptAi && promptAi.enabled && (
            <span className="relative inline-flex">
              <button
                type="button"
                disabled={!aiOptimizeAvailable || !prompt.trim()}
                onClick={promptAi.runOptimize}
                title={
                  !prompt.trim()
                    ? '先输入提示词再优化'
                    : promptAi.freePromotion
                      ? 'AI 优化当前提示词（限免期间免费）'
                      : `AI 优化当前提示词（消耗 ${promptAi.costCredits} 积分）`
                }
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-1 text-[11px] font-bold text-white shadow-md shadow-blue-500/25 transition hover:from-blue-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:dark:from-white/[0.06] disabled:dark:to-white/[0.06] disabled:dark:text-gray-500"
              >
                <SparkleIcon className="h-3 w-3" />
                AI 优化
              </button>
              {promptAi.freePromotion && (
                <span className="absolute -right-2 -top-2 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-bold leading-none text-amber-950 shadow-sm">
                  限免
                </span>
              )}
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/[0.05] dark:text-gray-400">
            {normalizedPrompt ? `${normalizedPrompt.length} 字` : '未填写'}
          </span>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={isMobile ? 5 : 8}
        placeholder="描述你想生成的图片..."
        className="custom-scrollbar h-[8.5rem] min-h-[8.5rem] w-full resize-none overscroll-contain rounded-[1.35rem] border border-gray-200/70 bg-white px-4 py-3 text-[15px] leading-6 text-gray-700 shadow-sm transition-[border-color,box-shadow] duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-100 md:h-[11rem] md:min-h-[11rem] md:py-3.5 md:leading-7"
      />
      {showSuggestionCard && promptAi && (
        <PromptAiSuggestionCard
          mode={promptAi.mode!}
          text={promptAi.text}
          streaming={promptAi.streaming}
          error={promptAi.error}
          canApply={promptAi.text.trim().length > 0}
          onStop={promptAi.stop}
          onApply={promptAi.apply}
          onDismiss={promptAi.dismiss}
        />
      )}
    </div>
  )
}
