import type { ModelConfig, TaskParams } from '../../../../types'
import AspectQuantityPanel from './AspectQuantityPanel'
import ModelSelector from './ModelSelector'

interface ParamsSectionProps {
  activeModelId: string | null
  estimatedCost: number
  models: ModelConfig[]
  normalizedSize: string
  params: TaskParams
  onActiveModelChange: (modelId: string) => void
  onSetParams: (params: Partial<TaskParams>) => void
}

export default function ParamsSection({
  activeModelId,
  estimatedCost,
  models,
  normalizedSize,
  params,
  onActiveModelChange,
  onSetParams,
}: ParamsSectionProps) {
  return (
    <div className="space-y-3 text-sm">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium text-gray-500 dark:text-gray-400">模型</span>
        <ModelSelector
          models={models}
          activeModelId={activeModelId}
          compact={false}
          onChange={onActiveModelChange}
        />
      </label>
      <AspectQuantityPanel
        estimatedCost={estimatedCost}
        normalizedSize={normalizedSize}
        params={params}
        onSetParams={onSetParams}
      />
    </div>
  )
}
