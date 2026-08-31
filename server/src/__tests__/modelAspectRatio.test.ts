import { describe, expect, it } from 'vitest'
import { isModelAspectRatioEnabled, resolveKnownAspectRatio } from '../modelAspectRatio.js'

describe('model aspect ratio restrictions', () => {
  it('resolves all aspect ratios offered by the playground', () => {
    expect(resolveKnownAspectRatio('1024x1024')).toBe('1:1')
    expect(resolveKnownAspectRatio('1824x1024')).toBe('16:9')
    expect(resolveKnownAspectRatio('1024x1360')).toBe('3:4')
    expect(resolveKnownAspectRatio('2384x1024')).toBe('21:9')
  })

  it('blocks only the configured aspect ratios', () => {
    const model = { unsupportedAspectRatios: ['16:9', '21:9'] }
    expect(isModelAspectRatioEnabled(model, '1824x1024')).toBe(false)
    expect(isModelAspectRatioEnabled(model, '1024x1024')).toBe(true)
    expect(isModelAspectRatioEnabled(model, 'auto')).toBe(true)
  })
})
