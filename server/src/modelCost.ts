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
  lowQuality1KEnabled?: boolean
  lowQuality2KEnabled?: boolean
  lowQuality4KEnabled?: boolean
  mediumQualityEnabled?: boolean
  mediumQuality1KEnabled?: boolean
  mediumQuality2KEnabled?: boolean
  mediumQuality4KEnabled?: boolean
  highQualityCostCredits?: number
  highQualityCostCredits2K?: number
  highQualityCostCredits4K?: number
  highQualityEnabled?: boolean
  highQuality1KEnabled?: boolean
  highQuality2KEnabled?: boolean
  highQuality4KEnabled?: boolean
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
  return Boolean(isGptImageModel(model) && (
    isQualityTierEnabled(model, 'high', '1K') ||
    isQualityTierEnabled(model, 'high', '2K') ||
    isQualityTierEnabled(model, 'high', '4K')
  ))
}

export function isQualityTierEnabled(
  model: ModelResolutionPricing,
  quality: string,
  tier: ResolutionTier,
): boolean {
  if (!isGptImageModel(model) && quality !== 'medium') return false
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
  if (quality === 'low' && isQualityTierEnabled(model, 'low', tier)) return resolveLowTierCost(model, tier)
  if (quality === 'high' && isQualityTierEnabled(model, 'high', tier)) return resolveHighTierCost(model, tier)
  return resolveMediumTierCost(model, tier)
}

export { isGptImageModel as isGptImage2Model }
