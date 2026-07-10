import type { ModelConfig } from '../types'
import { resolveImageSizeTier, type SizeTier } from './size'

export function isGptImageModel(model: Pick<ModelConfig, 'name' | 'upstreamModel'>): boolean {
  return /^gpt-image(?:$|[-_:/.])/i.test(model.upstreamModel || '') || /^gpt-image(?:$|[-_:/.])/i.test(model.name || '')
}

export function supportsHighQualityPricing(model: ModelConfig | null): boolean {
  return Boolean(model?.highQualityEnabled && model && isGptImageModel(model))
}

export function supportsQualitySelection(model: ModelConfig | null): boolean {
  return Boolean(model && isGptImageModel(model))
}

export function isQualityEnabled(model: ModelConfig | null, quality: string): boolean {
  if (!model || !supportsQualitySelection(model)) return quality === 'medium'
  if (quality === 'low') return model.lowQualityEnabled !== false
  if (quality === 'high') return Boolean(model.highQualityEnabled)
  return model.mediumQualityEnabled !== false
}

export function resolveAvailableQualities(model: ModelConfig | null): Array<'low' | 'medium' | 'high'> {
  if (!supportsQualitySelection(model)) return ['medium']
  return (['low', 'medium', 'high'] as const).filter((quality) => isQualityEnabled(model, quality))
}

export function resolveFallbackQuality(model: ModelConfig | null): 'low' | 'medium' | 'high' {
  return resolveAvailableQualities(model)[0] ?? 'medium'
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
  if (!isGptImageModel(model)) return resolveMediumCostByTier(model, tier)
  if (quality === 'low' && isQualityEnabled(model, 'low')) return resolveLowCostByTier(model, tier)
  if (quality === 'high' && supportsHighQualityPricing(model)) return resolveHighCostByTier(model, tier)
  return resolveMediumCostByTier(model, tier)
}

export function resolveModelCostForSize(model: ModelConfig | null, size: string, quality = 'medium'): number {
  if (!model) return 0
  return resolveModelCostByTier(model, resolveImageSizeTier(size), quality)
}

export { isGptImageModel as isGptImage2Model }
