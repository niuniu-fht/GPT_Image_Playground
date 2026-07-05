import type { KeyboardEventHandler, RefObject } from 'react'

interface PromptSectionProps {
  prompt: string
  normalizedPrompt: string
  promptHintText: string
  isMobile: boolean
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onPromptChange: (value: string) => void
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>
}

export default function PromptSection({
  prompt,
  normalizedPrompt,
  promptHintText,
  isMobile,
  textareaRef,
  onPromptChange,
  onKeyDown,
}: PromptSectionProps) {
  return (
    <div className="flex flex-shrink-0 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">提示词</span>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{promptHintText}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/[0.05] dark:text-gray-400">
          {normalizedPrompt ? `${normalizedPrompt.length} 字` : '未填写'}
        </span>
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
    </div>
  )
}
