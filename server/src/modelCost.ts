export type ResolutionTier = '1K' | '2K' | '4K'

export const MAX_INPUT_IMAGE_COUNT = 16

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
  lowQualityMaxInputImages?: number | null
  lowQualityMaxInputImages2K?: number | null
  lowQualityMaxInputImages4K?: number | null
  mediumQualityEnabled?: boolean
  mediumQuality1KEnabled?: boolean
  mediumQuality2KEnabled?: boolean
  mediumQuality4KEnabled?: boolean
  mediumQualityMaxInputImages?: number | null
  mediumQualityMaxInputImages2K?: number | null
  mediumQualityMaxInputImages4K?: number | null
  highQualityCostCredits?: number
  highQualityCostCredits2K?: number
  highQualityCostCredits4K?: number
  highQualityEnabled?: boolean
  highQuality1KEnabled?: boolean
  highQuality2KEnabled?: boolean
  highQuality4KEnabled?: boolean
  highQualityMaxInputImages?: number | null
  highQualityMaxInputImages2K?: number | null
  highQualityMaxInputImages4K?: number | null
  xhighQualityCostCredits?: number
  xhighQualityCostCredits2K?: number
  xhighQualityCostCredits4K?: number
  xhighQualityEnabled?: boolean
  xhighQuality1KEnabled?: boolean
  xhighQuality2KEnabled?: boolean
  xhighQuality4KEnabled?: boolean
  xhighQualityMaxInputImages?: number | null
  xhighQualityMaxInputImages2K?: number | null
  xhighQualityMaxInputImages4K?: number | null
  maxQualityCostCredits?: number
  maxQualityCostCredits2K?: number
  maxQualityCostCredits4K?: number
  maxQualityEnabled?: boolean
  maxQuality1KEnabled?: boolean
  maxQuality2KEnabled?: boolean
  maxQuality4KEnabled?: boolean
  maxQualityMaxInputImages?: number | null
  maxQualityMaxInputImages2K?: number | null
  maxQualityMaxInputImages4K?: number | null
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
  if (quality === 'high' || quality === 'xhigh' || quality === 'max') {
    const prefix = quality === 'xhigh' ? 'xhigh' : quality === 'max' ? 'max' : 'high'
    const enabled = model[`${prefix}Quality${tier}Enabled` as keyof ModelResolutionPricing] as boolean | undefined
    const fallbackEnabled = model[`${prefix}QualityEnabled` as keyof ModelResolutionPricing] as boolean | undefined
    if (tier === '4K') return enabled ?? fallbackEnabled ?? false
    if (tier === '2K') return enabled ?? fallbackEnabled ?? false
    return enabled ?? fallbackEnabled ?? false
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
  if ((quality === 'high' || quality === 'xhigh' || quality === 'max') && isQualityTierEnabled(model, quality, tier)) {
    const prefix = quality === 'xhigh' ? 'xhigh' : quality === 'max' ? 'max' : 'high'
    const medium = resolveMediumTierCost(model, tier)
    const key = tier === '4K' ? `${prefix}QualityCostCredits4K` : tier === '2K' ? `${prefix}QualityCostCredits2K` : `${prefix}QualityCostCredits`
    return (model[key as keyof ModelResolutionPricing] as number | undefined) || (prefix === 'high' ? resolveHighTierCost(model, tier) : medium)
  }
  return resolveMediumTierCost(model, tier)
}

export function resolveMaxInputImages(
  model: ModelResolutionPricing,
  quality: string,
  tier: ResolutionTier,
): number {
  const prefix = quality === 'low'
    ? 'low'
    : quality === 'high'
      ? 'high'
      : quality === 'xhigh'
        ? 'xhigh'
        : quality === 'max'
          ? 'max'
          : 'medium'
  const suffix = tier === '4K' ? '4K' : tier === '2K' ? '2K' : ''
  const clamp = (value: unknown): number | null => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    return Math.max(0, Math.min(Math.floor(value), MAX_INPUT_IMAGE_COUNT))
  }
  const specific = clamp(model[`${prefix}QualityMaxInputImages${suffix}` as keyof ModelResolutionPricing])
  if (specific !== null) return specific
  const base = clamp(model[`${prefix}QualityMaxInputImages` as keyof ModelResolutionPricing])
  if (base !== null) return base
  return MAX_INPUT_IMAGE_COUNT
}

export { isGptImageModel as isGptImage2Model }
