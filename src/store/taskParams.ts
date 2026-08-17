import { normalizeImageSize } from '../lib/size'
import { resolveFallbackQuality } from '../lib/modelCost'
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
  return {
    size: DEFAULT_PARAMS.size,
    quality: resolveFallbackQuality(model),
    n: DEFAULT_PARAMS.n,
  }
}
