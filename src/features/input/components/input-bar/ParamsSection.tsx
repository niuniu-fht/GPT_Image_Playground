import { useEffect, useRef, useState } from 'react'
import type { ModelConfig, TaskParams } from '../../../../types'
import AspectQuantityPanel from './AspectQuantityPanel'
import GenerationCostNotice from './GenerationCostNotice'
import ModelSelector from './ModelSelector'

interface ParamsSectionProps {
  activeModelId: string | null
  activeModel: ModelConfig | null
  estimatedCost: number
  models: ModelConfig[]
  normalizedSize: string
  params: TaskParams
  onActiveModelChange: (modelId: string) => void
  onSetParams: (params: Partial<TaskParams>) => void
}

export default function ParamsSection({
  activeModelId,
  activeModel,
  estimatedCost,
  models,
  normalizedSize,
  params,
  onActiveModelChange,
  onSetParams,
}: ParamsSectionProps) {
  const [recentlyReset, setRecentlyReset] = useState(false)
  const resetTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current != null) window.clearTimeout(resetTimerRef.current)
  }, [])

  const handleModelChange = (modelId: string) => {
    const changed = modelId !== activeModelId
    onActiveModelChange(modelId)
    if (!changed) return

    setRecentlyReset(true)
    if (resetTimerRef.current != null) window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = window.setTimeout(() => setRecentlyReset(false), 2400)
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium text-gray-500 dark:text-gray-400">模型</span>
        <ModelSelector
          models={models}
          activeModelId={activeModelId}
          compact={false}
          params={params}
          onChange={handleModelChange}
        />
      </label>
      <GenerationCostNotice
        activeModel={activeModel}
        estimatedCost={estimatedCost}
        params={params}
        recentlyReset={recentlyReset}
      />
      <AspectQuantityPanel
        activeModel={activeModel}
        estimatedCost={estimatedCost}
        normalizedSize={normalizedSize}
        params={params}
        onSetParams={onSetParams}
      />
    </div>
  )
}
