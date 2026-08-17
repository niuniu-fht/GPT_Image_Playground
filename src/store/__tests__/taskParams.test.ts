import { describe, expect, it } from 'vitest'
import type { ModelConfig } from '../../types'
import { resolveModelSwitchParams } from '../taskParams'

function createModel(overrides: Partial<ModelConfig> = {}): ModelConfig {
  return {
    id: 'model-1',
    name: 'gpt-image-test',
    displayName: 'Test model',
    description: 'Test model',
    icon: 'sparkles',
    costCredits: 4,
    costCredits2K: 8,
    costCredits4K: 16,
    lowQualityEnabled: true,
    lowQualityCostCredits: 1,
    lowQualityCostCredits2K: 2,
    lowQualityCostCredits4K: 4,
    mediumQualityEnabled: true,
    highQualityEnabled: true,
    highQualityCostCredits: 8,
    highQualityCostCredits2K: 16,
    highQualityCostCredits4K: 32,
    upstreamModel: 'gpt-image-test',
    apiProtocol: 'images',
    enabled: true,
    isNew: false,
    sortOrder: 0,
    ...overrides,
  }
}

describe('model switch params', () => {
  it('resets every model switch to one 1K image at the lowest enabled quality', () => {
    expect(resolveModelSwitchParams(createModel())).toEqual({
      size: '1024x1024',
      quality: 'low',
      n: 1,
    })
  })

  it('uses the next lowest quality when low quality is disabled', () => {
    expect(resolveModelSwitchParams(createModel({ lowQualityEnabled: false }))).toEqual({
      size: '1024x1024',
      quality: 'medium',
      n: 1,
    })
  })
})
