export type ResolutionTier = '1K' | '2K' | '4K'

export interface ModelResolutionPricing {
  costCredits: number
  costCredits2K: number
  costCredits4K: number
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

export function resolveModelCostForSize(model: ModelResolutionPricing, size: string): number {
  const tier = resolveResolutionTier(size)
  if (tier === '4K') return model.costCredits4K || model.costCredits * 4
  if (tier === '2K') return model.costCredits2K || model.costCredits * 2
  return model.costCredits
}
