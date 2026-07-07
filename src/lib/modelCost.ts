import type { ModelConfig } from '../types'
import { resolveImageSizeTier, type SizeTier } from './size'

export function isGptImage2Model(model: Pick<ModelConfig, 'name' | 'upstreamModel'>): boolean {
  return model.name === 'gpt-image-2'
}

export function supportsHighQualityPricing(model: ModelConfig | null): boolean {
  return Boolean(model?.highQualityEnabled && isGptImage2Model(model))
}

export function supportsQualitySelection(model: ModelConfig | null): boolean {
  return Boolean(model && isGptImage2Model(model))
}

function resolveMediumCostByTier(model: ModelConfig, tier: SizeTier): number {
  if (tier === '4K') return model.costCredits4K || model.costCredits * 4
  if (tier === '2K') return model.costCredits2K || model.costCredits * 2
  return model.costCredits
}

function resolveLowCostByTier(model: ModelConfig, tier: SizeTier): number {
  const mediumCost = resolveMediumCostByTier(model, tier)
  if (tier === '4K') return model.lowQualityCostCredits4K || model.lowQualityCostCredits || mediumCost
  if (tier === '2K') return model.lowQualityCostCredits2K || model.lowQualityCostCredits || mediumCost
  return model.lowQualityCostCredits || mediumCost
}

function resolveHighCostByTier(model: ModelConfig, tier: SizeTier): number {
  const mediumCost = resolveMediumCostByTier(model, tier)
  if (tier === '4K') return model.highQualityCostCredits4K || model.highQualityCostCredits || mediumCost
  if (tier === '2K') return model.highQualityCostCredits2K || model.highQualityCostCredits || mediumCost
  return model.highQualityCostCredits || mediumCost
}

export function resolveModelCostByTier(model: ModelConfig, tier: SizeTier, quality = 'medium'): number {
  if (!isGptImage2Model(model)) return resolveMediumCostByTier(model, tier)
  if (quality === 'low') return resolveLowCostByTier(model, tier)
  if (quality === 'high' && supportsHighQualityPricing(model)) return resolveHighCostByTier(model, tier)
  return resolveMediumCostByTier(model, tier)
}

export function resolveModelCostForSize(model: ModelConfig | null, size: string, quality = 'medium'): number {
  if (!model) return 0
  return resolveModelCostByTier(model, resolveImageSizeTier(size), quality)
}
