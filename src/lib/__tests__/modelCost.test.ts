import { describe, expect, it } from 'vitest'
import type { ModelConfig } from '../../types'
import { resolveEffectiveModelQuality, resolveModelCostForSize } from '../modelCost'

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
    lowQualityCostCredits: 1,
    lowQualityCostCredits2K: 2,
    lowQualityCostCredits4K: 3,
    mediumQualityEnabled: true,
    highQualityEnabled: false,
    highQualityCostCredits: 10,
    highQualityCostCredits2K: 11,
    highQualityCostCredits4K: 12,
    upstreamModel: 'group-medium',
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
    const model = createModel({ highQualityEnabled: true })

    expect(resolveEffectiveModelQuality(model, 'high')).toBe('high')
    expect(resolveModelCostForSize(model, '1024x1024', 'high')).toBe(10)
  })
})
