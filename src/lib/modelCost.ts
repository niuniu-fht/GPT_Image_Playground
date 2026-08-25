import type { ModelConfig } from '../types'
import { resolveImageSizeTier, type SizeTier } from './size'

export function isGptImageModel(model: Pick<ModelConfig, 'name' | 'upstreamModel'>): boolean {
  return /^gpt-image(?:$|[-_:/.])/i.test(model.upstreamModel || '') || /^gpt-image(?:$|[-_:/.])/i.test(model.name || '')
}

export function supportsHighQualityPricing(model: ModelConfig | null): boolean {
  return Boolean(model && isGptImageModel(model) && (
    isQualityTierEnabled(model, 'high', '1K') ||
    isQualityTierEnabled(model, 'high', '2K') ||
    isQualityTierEnabled(model, 'high', '4K')
  ))
}

export function supportsQualitySelection(model: ModelConfig | null): boolean {
  return Boolean(model && isGptImageModel(model))
}

export function isQualityTierEnabled(
  model: ModelConfig | null,
  quality: string,
  tier: SizeTier,
): boolean {
  if (!model) return false
  if (!supportsQualitySelection(model) && quality !== 'medium') return false

  if (quality === 'low') {
    if (tier === '4K') return model.lowQuality4KEnabled ?? model.lowQualityEnabled !== false
    if (tier === '2K') return model.lowQuality2KEnabled ?? model.lowQualityEnabled !== false
    return model.lowQuality1KEnabled ?? model.lowQualityEnabled !== false
  }
  if (quality === 'high') {
    if (tier === '4K') return model.highQuality4KEnabled ?? Boolean(model.highQualityEnabled)
    if (tier === '2K') return model.highQuality2KEnabled ?? Boolean(model.highQualityEnabled)
    return model.highQuality1KEnabled ?? Boolean(model.highQualityEnabled)
  }
  if (tier === '4K') return model.mediumQuality4KEnabled ?? model.mediumQualityEnabled !== false
  if (tier === '2K') return model.mediumQuality2KEnabled ?? model.mediumQualityEnabled !== false
  return model.mediumQuality1KEnabled ?? model.mediumQualityEnabled !== false
}

export function isQualityEnabled(model: ModelConfig | null, quality: string): boolean {
  return (['1K', '2K', '4K'] as const).some((tier) => isQualityTierEnabled(model, quality, tier))
}

export function resolveAvailableQualities(
  model: ModelConfig | null,
  tier: SizeTier = '1K',
): Array<'low' | 'medium' | 'high'> {
  const qualities = supportsQualitySelection(model)
    ? (['low', 'medium', 'high'] as const)
    : (['medium'] as const)
  return qualities.filter((quality) => isQualityTierEnabled(model, quality, tier))
}

export function resolveAvailableTiers(model: ModelConfig | null, quality: string): SizeTier[] {
  return (['1K', '2K', '4K'] as const).filter((tier) => isQualityTierEnabled(model, quality, tier))
}

export function resolveFallbackQuality(
  model: ModelConfig | null,
  tier: SizeTier = '1K',
): 'low' | 'medium' | 'high' {
  return resolveAvailableQualities(model, tier)[0] ?? 'medium'
}

export function resolveFirstAvailableCombination(model: ModelConfig | null): {
  quality: 'low' | 'medium' | 'high'
  tier: SizeTier
} {
  for (const tier of ['1K', '2K', '4K'] as const) {
    const quality = resolveAvailableQualities(model, tier)[0]
    if (quality) return { quality, tier }
  }
  return { quality: 'medium', tier: '1K' }
}

export function resolveEffectiveModelQuality(
  model: ModelConfig | null,
  requestedQuality: string,
  size = '1024x1024',
): 'low' | 'medium' | 'high' {
  const tier = resolveImageSizeTier(size)
  if (requestedQuality !== 'auto' && isQualityTierEnabled(model, requestedQuality, tier)) {
    return requestedQuality as 'low' | 'medium' | 'high'
  }
  return resolveFallbackQuality(model, tier)
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
  if (quality === 'low' && isQualityTierEnabled(model, 'low', tier)) return resolveLowCostByTier(model, tier)
  if (quality === 'high' && isQualityTierEnabled(model, 'high', tier)) return resolveHighCostByTier(model, tier)
  return resolveMediumCostByTier(model, tier)
}

export function resolveModelCostForSize(model: ModelConfig | null, size: string, quality = 'medium'): number {
  if (!model) return 0
  return resolveModelCostByTier(model, resolveImageSizeTier(size), quality)
}

export { isGptImageModel as isGptImage2Model }
