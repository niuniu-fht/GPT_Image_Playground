import type { Dispatch, SetStateAction } from 'react'
import type { ModelConfig, TaskParams } from '../../../../types'
import ParamsAdvancedFields from './ParamsAdvancedFields'
import ParamsCoreFields from './ParamsCoreFields'

interface ParamsSectionProps {
  isMobile: boolean
  mobileAdvancedParamsVisible: boolean
  setMobileAdvancedParamsVisible: Dispatch<SetStateAction<boolean>>
  activeModelId: string | null
  models: ModelConfig[]
  normalizedSize: string
  params: TaskParams
  outputCompressionInput: string
  nInput: string
  selectClass: string
  onActiveModelChange: (modelId: string) => void
  onOpenSizePicker: () => void
  onSetParams: (params: Partial<TaskParams>) => void
  onOutputCompressionInputChange: (value: string) => void
  onCommitOutputCompression: () => void
  onNInputChange: (value: string) => void
  onCommitN: () => void
}

export default function ParamsSection({
  isMobile,
  mobileAdvancedParamsVisible,
  setMobileAdvancedParamsVisible,
  activeModelId,
  models,
  normalizedSize,
  params,
  outputCompressionInput,
  nInput,
  selectClass,
  onActiveModelChange,
  onOpenSizePicker,
  onSetParams,
  onOutputCompressionInputChange,
  onCommitOutputCompression,
  onNInputChange,
  onCommitN,
}: ParamsSectionProps) {
  if (isMobile) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-white/[0.82] p-2.5 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">生成参数</span>
            <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">核心项常驻，更多项折叠</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
            核心项
          </span>
        </div>
        <div className="flex flex-col gap-2 text-[13px]">
          <ParamsCoreFields
            compact
            activeModelId={activeModelId}
            models={models}
            normalizedSize={normalizedSize}
            quality={params.quality}
            selectClass={selectClass}
            onActiveModelChange={onActiveModelChange}
            onOpenSizePicker={onOpenSizePicker}
            onSetQuality={(quality) => onSetParams({ quality })}
          />
          {mobileAdvancedParamsVisible && (
            <ParamsAdvancedFields
              compact
              params={params}
              outputCompressionInput={outputCompressionInput}
              nInput={nInput}
              selectClass={selectClass}
              onSetParams={onSetParams}
              onOutputCompressionInputChange={onOutputCompressionInputChange}
              onCommitOutputCompression={onCommitOutputCompression}
              onNInputChange={onNInputChange}
              onCommitN={onCommitN}
            />
          )}
          <button
            type="button"
            onClick={() => setMobileAdvancedParamsVisible((visible) => !visible)}
            className="inline-flex self-start rounded-full border border-gray-200/80 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06]"
          >
            <span className="inline-flex items-center gap-1">
              {mobileAdvancedParamsVisible ? '收起更多参数' : '更多参数'}
              <svg
                className={`h-3.5 w-3.5 transition-transform duration-200 ${mobileAdvancedParamsVisible ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <ParamsCoreFields
        compact={false}
        activeModelId={activeModelId}
        models={models}
        normalizedSize={normalizedSize}
        quality={params.quality}
        selectClass={selectClass}
        onActiveModelChange={onActiveModelChange}
        onOpenSizePicker={onOpenSizePicker}
        onSetQuality={(quality) => onSetParams({ quality })}
      />
      <ParamsAdvancedFields
        params={params}
        outputCompressionInput={outputCompressionInput}
        nInput={nInput}
        selectClass={selectClass}
        onSetParams={onSetParams}
        onOutputCompressionInputChange={onOutputCompressionInputChange}
        onCommitOutputCompression={onCommitOutputCompression}
        onNInputChange={onNInputChange}
        onCommitN={onCommitN}
      />
    </div>
  )
}
