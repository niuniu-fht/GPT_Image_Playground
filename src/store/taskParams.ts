import { normalizeImageSize } from '../lib/size'
import type { TaskParams } from '../types'

export const DEFAULT_PARAMS: TaskParams = {
  size: '1024x1024',
  quality: 'medium',
  output_format: 'png',
  output_compression: null,
  moderation: 'auto',
  n: 1,
}

export function resolveTaskParamSizeOrDefault(size: string): string {
  return normalizeImageSize(size) || DEFAULT_PARAMS.size
}
