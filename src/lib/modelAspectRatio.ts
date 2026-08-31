import type { ModelConfig } from '../types'
import { resolveKnownAspectRatio, type KnownAspectRatio } from './size'

export function isModelAspectRatioEnabled(
  model: ModelConfig | null,
  ratio: KnownAspectRatio,
): boolean {
  return !model?.unsupportedAspectRatios?.includes(ratio)
}

export function resolveEnabledModelAspectRatios(model: ModelConfig | null): KnownAspectRatio[] {
  return (['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'] as const)
    .filter((ratio) => isModelAspectRatioEnabled(model, ratio))
}

export function isModelSizeAspectRatioEnabled(model: ModelConfig | null, size: string): boolean {
  const ratio = resolveKnownAspectRatio(size)
  return !ratio || isModelAspectRatioEnabled(model, ratio)
}
