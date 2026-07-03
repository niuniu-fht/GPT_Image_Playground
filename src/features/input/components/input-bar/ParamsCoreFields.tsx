import type { ModelConfig, TaskParams } from '../../../../types'
import Select from '../../../../shared/components/Select'
import { QUALITY_OPTIONS } from './paramsSectionShared'
import ModelSelector from './ModelSelector'

interface ParamsCoreFieldsProps {
  compact: boolean
  activeModelId: string | null
  models: ModelConfig[]
  normalizedSize: string
  quality: TaskParams['quality']
  selectClass: string
  onActiveModelChange: (modelId: string) => void
  onOpenSizePicker: () => void
  onSetQuality: (quality: TaskParams['quality']) => void
}

export default function ParamsCoreFields({
  compact,
  activeModelId,
  models,
  normalizedSize,
  quality,
  selectClass,
  onActiveModelChange,
  onOpenSizePicker,
  onSetQuality,
}: ParamsCoreFieldsProps) {
  const labelGapClass = compact ? 'gap-1' : 'gap-1.5'
  const buttonClass = compact
    ? 'rounded-xl border border-gray-200/60 bg-white/50 px-3 py-2 text-left font-mono text-[13px] shadow-sm transition-all duration-200 hover:bg-white focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
    : 'rounded-xl border border-gray-200/60 bg-white/50 px-3 py-2 text-left font-mono text-sm shadow-sm transition-all duration-200 hover:bg-white focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'

  return (
    <>
      <label className={`flex flex-col ${labelGapClass}`}>
        <span className="font-medium text-gray-500 dark:text-gray-400">模型</span>
        <ModelSelector
          models={models}
          activeModelId={activeModelId}
          compact={compact}
          onChange={onActiveModelChange}
        />
      </label>

      <div className={`grid grid-cols-2 ${compact ? 'gap-2.5' : 'gap-3'}`}>
        <label className={`flex flex-col ${labelGapClass}`}>
          <span className="font-medium text-gray-500 dark:text-gray-400">尺寸</span>
          <button
            type="button"
            onClick={onOpenSizePicker}
            className={buttonClass}
            title="选择尺寸"
          >
            {normalizedSize}
          </button>
        </label>

        <label className={`flex flex-col ${labelGapClass}`}>
          <span className="font-medium text-gray-500 dark:text-gray-400">质量</span>
          <Select
            value={quality}
            onChange={(value) => onSetQuality(value as TaskParams['quality'])}
            options={QUALITY_OPTIONS as unknown as Array<{ label: string; value: string }>}
            className={selectClass}
          />
        </label>
      </div>
    </>
  )
}
