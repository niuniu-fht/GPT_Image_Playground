import { describe, expect, it } from 'vitest'
import { isQualityTierEnabled, resolveModelCostForSize } from '../modelCost.js'

function createModel() {
  return {
    name: 'gpt-image-test',
    upstreamModel: 'gpt-image-test',
    costCredits: 4,
    costCredits2K: 6,
    costCredits4K: 8,
    lowQualityEnabled: true,
    lowQuality1KEnabled: true,
    lowQuality2KEnabled: false,
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
  }
}

describe('server model quality resolution controls', () => {
  it('checks each quality and resolution combination independently', () => {
    const model = createModel()

    expect(isQualityTierEnabled(model, 'low', '1K')).toBe(true)
    expect(isQualityTierEnabled(model, 'low', '2K')).toBe(false)
    expect(isQualityTierEnabled(model, 'low', '4K')).toBe(true)
  })

  it('uses the configured price for an enabled combination', () => {
    expect(resolveModelCostForSize(createModel(), '3840x3840', 'low')).toBe(3)
  })
})
