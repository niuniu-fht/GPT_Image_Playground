export type ResolutionTier = '1K' | '2K' | '4K'

export interface ModelResolutionPricing {
  name?: string
  costCredits: number
  costCredits2K: number
  costCredits4K: number
  lowQualityCostCredits?: number
  lowQualityCostCredits2K?: number
  lowQualityCostCredits4K?: number
  lowQualityEnabled?: boolean
  mediumQualityEnabled?: boolean
  highQualityCostCredits?: number
  highQualityCostCredits2K?: number
  highQualityCostCredits4K?: number
  highQualityEnabled?: boolean
  upstreamModel?: string
}

const SIZE_PATTERN = /^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/

export function resolveResolutionTier(size: string): ResolutionTier {
  const match = size.match(SIZE_PATTERN)
  if (!match) return '1K'

  const width = Number(match[1])
  const height = Number(match[2])
  const pixels = width * height
  if (!Number.isFinite(pixels) || pixels <= 0) return '1K'
  if (pixels >= 6_000_000) return '4K'
  if (pixels >= 2_600_000) return '2K'
  return '1K'
}

export function isGptImageModel(model: Pick<ModelResolutionPricing, 'name' | 'upstreamModel'>): boolean {
  return /^gpt-image(?:$|[-_:/.])/i.test(model.upstreamModel || '') || /^gpt-image(?:$|[-_:/.])/i.test(model.name || '')
}

export function supportsHighQualityPricing(model: ModelResolutionPricing): boolean {
  return Boolean(model.highQualityEnabled && isGptImageModel(model))
}

function resolveMediumTierCost(model: ModelResolutionPricing, tier: ResolutionTier): number {
  if (tier === '4K') return model.costCredits4K || model.costCredits * 4
  if (tier === '2K') return model.costCredits2K || model.costCredits * 2
  return model.costCredits
}

function resolveLowTierCost(model: ModelResolutionPricing, tier: ResolutionTier): number {
  const mediumCost = resolveMediumTierCost(model, tier)
  if (tier === '4K') return model.lowQualityCostCredits4K || model.lowQualityCostCredits || mediumCost
  if (tier === '2K') return model.lowQualityCostCredits2K || model.lowQualityCostCredits || mediumCost
  return model.lowQualityCostCredits || mediumCost
}

function resolveHighTierCost(model: ModelResolutionPricing, tier: ResolutionTier): number {
  const mediumCost = resolveMediumTierCost(model, tier)
  if (tier === '4K') return model.highQualityCostCredits4K || model.highQualityCostCredits || mediumCost
  if (tier === '2K') return model.highQualityCostCredits2K || model.highQualityCostCredits || mediumCost
  return model.highQualityCostCredits || mediumCost
}

export function resolveModelCostForSize(
  model: ModelResolutionPricing,
  size: string,
  quality = 'medium',
): number {
  const tier = resolveResolutionTier(size)
  if (!isGptImageModel(model)) return resolveMediumTierCost(model, tier)
  if (quality === 'low' && model.lowQualityEnabled !== false) return resolveLowTierCost(model, tier)
  if (quality === 'high' && supportsHighQualityPricing(model)) return resolveHighTierCost(model, tier)
  return resolveMediumTierCost(model, tier)
}

export { isGptImageModel as isGptImage2Model }
