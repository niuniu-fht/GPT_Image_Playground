import type { ModelConfig } from '../types'
import { resolveImageSizeTier, type SizeTier } from './size'

export function resolveModelCostByTier(model: ModelConfig, tier: SizeTier): number {
  if (tier === '4K') return model.costCredits4K || model.costCredits * 4
  if (tier === '2K') return model.costCredits2K || model.costCredits * 2
  return model.costCredits
}

export function resolveModelCostForSize(model: ModelConfig | null, size: string): number {
  if (!model) return 0
  return resolveModelCostByTier(model, resolveImageSizeTier(size))
}
