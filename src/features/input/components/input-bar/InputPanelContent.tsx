import { useState } from 'react'
import BatchPanel from './BatchPanel'
import { usePromptAi } from './usePromptAi'
import ParamsSection from './ParamsSection'
import PromptSection from './PromptSection'
import ReferenceImagesSection from './ReferenceImagesSection'
import SubmitSection from './SubmitSection'
import type { InputBarContentViewModel } from './useInputBarState'

interface InputPanelContentProps {
  content: InputBarContentViewModel
}

type InputMode = 'single' | 'batch'

const MODE_TABS: Array<{ value: InputMode; label: string }> = [
  { value: 'single', label: '单图创作' },
  { value: 'batch', label: '批量生成' },
]

function InputModeTabs({ mode, onChange }: { mode: InputMode; onChange: (mode: InputMode) => void }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-white/[0.06]" role="tablist">
      {MODE_TABS.map((tab) => {
        const active = mode === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`h-8 rounded-lg text-sm font-medium transition ${
              active
                ? 'bg-white text-gray-900 shadow-sm dark:bg-white/[0.12] dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export default function InputPanelContent({ content }: InputPanelContentProps) {
  const [mode, setMode] = useState<InputMode>('single')
  const [batchPrompts, setBatchPrompts] = useState('')
  const {
    isMobile,
    panelBindings,
    promptSectionProps,
    referenceImagesSectionProps,
    paramsSectionProps,
    submitSectionProps,
  } =
    content
  // 提示词内嵌 AI：优化当前提示词 / 反推参考图提示词（后台未开启时不渲染入口）
  const promptAi = usePromptAi({
    prompt: promptSectionProps.prompt,
    setPrompt: promptSectionProps.onPromptChange,
  })

  if (mode === 'batch') {
    return (
      <div
        data-input-panel
        className={`flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain ${
          isMobile
            ? 'custom-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)] pl-4 pr-3 pt-4'
            : 'p-4 pb-5'
        }`}
      >
        <InputModeTabs mode={mode} onChange={setMode} />
        <BatchPanel
          prompts={batchPrompts}
          onPromptsChange={setBatchPrompts}
          activeModel={paramsSectionProps.activeModel}
          models={paramsSectionProps.models}
          params={paramsSectionProps.params}
          activeModelId={paramsSectionProps.activeModelId}
          onActiveModelChange={paramsSectionProps.onActiveModelChange}
          onSetParams={paramsSectionProps.onSetParams}
          creditBalance={submitSectionProps.creditBalance}
        />
      </div>
    )
  }

  return (
    <div
      data-input-panel
      {...panelBindings}
      className={`flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain ${
        isMobile
          ? 'custom-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)] pl-4 pr-3 pt-4'
          : 'p-4 pb-5'
      }`}
    >
      <InputModeTabs mode={mode} onChange={setMode} />
      <PromptSection {...promptSectionProps} promptAi={promptAi} />
      <ReferenceImagesSection
        {...referenceImagesSectionProps}
        aiReverse={
          promptAi.enabled
            ? {
                enabled: !promptAi.streaming,
                onReverse: (image) => {
                  promptAi.runReverse({ id: image.id, dataUrl: image.dataUrl })
                },
              }
            : undefined
        }
      />

      {isMobile ? (
        <ParamsSection {...paramsSectionProps} />
      ) : (
        <>
          <div className="my-2 h-px bg-gray-200 dark:bg-white/[0.08]" />
          <ParamsSection {...paramsSectionProps} />
        </>
      )}

      <SubmitSection {...submitSectionProps} />
    </div>
  )
}
