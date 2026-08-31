import { normalizeImageSize } from '../lib/size'
import { resolveFirstAvailableCombination } from '../lib/modelCost'
import { resolveEnabledModelAspectRatios } from '../lib/modelAspectRatio'
import { calculateImageSize } from '../lib/size'
import type { ModelConfig, TaskParams } from '../types'

export const DEFAULT_PARAMS: TaskParams = {
  size: '1024x1024',
  quality: 'low',
  output_format: 'png',
  output_compression: null,
  moderation: 'auto',
  n: 1,
}

export function resolveTaskParamSizeOrDefault(size: string): string {
  return normalizeImageSize(size) || DEFAULT_PARAMS.size
}

export function resolveModelSwitchParams(
  model: ModelConfig | null,
): Pick<TaskParams, 'size' | 'quality' | 'n'> {
  const selection = resolveFirstAvailableCombination(model)
  const ratio = resolveEnabledModelAspectRatios(model)[0] ?? '1:1'
  return {
    size: calculateImageSize(selection.tier, ratio) || DEFAULT_PARAMS.size,
    quality: selection.quality,
    n: DEFAULT_PARAMS.n,
  }
}
