import { describe, expect, it } from 'vitest'
import type { ModelConfig } from '../../types'
import { DEFAULT_MAX_INPUT_IMAGES, resolveEffectiveModelQuality, resolveMaxInputImages, resolveModelCostForSize } from '../modelCost'

function createModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'model-1',
    name: 'gpt-image-test',
    displayName: 'Test model',
    description: 'Test model',
    icon: 'sparkles',
    costCredits: 4,
    costCredits2K: 6,
    costCredits4K: 8,
    lowQualityEnabled: true,
    lowQuality1KEnabled: true,
    lowQuality2KEnabled: true,
    lowQuality4KEnabled: true,
    lowQualityCostCredits: 1,
    lowQualityCostCredits2K: 2,
    lowQualityCostCredits4K: 3,
    mediumQualityEnabled: true,
    mediumQuality1KEnabled: true,
    mediumQuality2KEnabled: true,
    mediumQuality4KEnabled: true,
    highQualityEnabled: false,
    highQuality1KEnabled: false,
    highQuality2KEnabled: false,
    highQuality4KEnabled: false,
    highQualityCostCredits: 10,
    highQualityCostCredits2K: 11,
    highQualityCostCredits4K: 12,
    upstreamModel: 'group-medium',
    unsupportedAspectRatios: [],
    apiProtocol: 'images',
    enabled: true,
    isNew: false,
    sortOrder: 0,
    ...overrides,
  }
}

describe('model quality cost', () => {
  it('uses the quality that will become active after selecting another model', () => {
    const model = createModel()
    const quality = resolveEffectiveModelQuality(model, 'high')

    expect(quality).toBe('low')
    expect(resolveModelCostForSize(model, '1024x1024', quality)).toBe(1)
  })

  it('keeps an enabled requested quality', () => {
    const model = createModel({ highQualityEnabled: true, highQuality1KEnabled: true })

    expect(resolveEffectiveModelQuality(model, 'high')).toBe('high')
    expect(resolveModelCostForSize(model, '1024x1024', 'high')).toBe(10)
  })

  it('treats xhigh and max as independently enabled high-priced tiers', () => {
    const model = createModel({
      highQualityEnabled: true,
      highQuality1KEnabled: true,
      xhighQualityEnabled: true,
      xhighQuality1KEnabled: true,
      maxQualityEnabled: true,
      maxQuality1KEnabled: true,
    })

    expect(resolveEffectiveModelQuality(model, 'xhigh')).toBe('xhigh')
    expect(resolveEffectiveModelQuality(model, 'max')).toBe('max')
    expect(resolveModelCostForSize(model, '1024x1024', 'xhigh')).toBe(10)
    expect(resolveModelCostForSize(model, '1024x1024', 'max')).toBe(10)
  })

  it('enables quality and resolution combinations independently', () => {
    const model = createModel({ lowQuality2KEnabled: false })

    expect(resolveEffectiveModelQuality(model, 'low', '2048x2048')).toBe('medium')
    expect(resolveEffectiveModelQuality(model, 'low', '1024x1024')).toBe('low')
  })
})

describe('max input images per quality and resolution', () => {
  it('falls back to the global default when nothing is configured', () => {
    const model = createModel()

    expect(resolveMaxInputImages(model, 'medium', '1K')).toBe(DEFAULT_MAX_INPUT_IMAGES)
    expect(resolveMaxInputImages(model, 'high', '4K')).toBe(DEFAULT_MAX_INPUT_IMAGES)
    expect(resolveMaxInputImages(null, 'medium', '1K')).toBe(DEFAULT_MAX_INPUT_IMAGES)
  })

  it('prefers the tier-specific limit, then the quality base limit', () => {
    const model = createModel({
      highQualityMaxInputImages: 6,
      highQualityMaxInputImages4K: 2,
    })

    expect(resolveMaxInputImages(model, 'high', '1K')).toBe(6)
    expect(resolveMaxInputImages(model, 'high', '2K')).toBe(6)
    expect(resolveMaxInputImages(model, 'high', '4K')).toBe(2)
  })

  it('clamps configured limits into the allowed range', () => {
    const model = createModel({
      lowQualityMaxInputImages: 99,
      mediumQualityMaxInputImages: 0,
    })

    expect(resolveMaxInputImages(model, 'low', '1K')).toBe(DEFAULT_MAX_INPUT_IMAGES)
    expect(resolveMaxInputImages(model, 'medium', '1K')).toBe(0)
  })
})
