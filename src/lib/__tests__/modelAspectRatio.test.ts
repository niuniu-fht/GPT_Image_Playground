import { describe, expect, it } from 'vitest'
import { isModelAspectRatioEnabled, isModelSizeAspectRatioEnabled, resolveEnabledModelAspectRatios } from '../modelAspectRatio'

const model = { unsupportedAspectRatios: ['16:9', '21:9'] } as never

describe('model aspect ratio restrictions', () => {
  it('keeps every ratio available by default', () => {
    expect(resolveEnabledModelAspectRatios(null)).toHaveLength(10)
  })

  it('filters only ratios disabled in the model', () => {
    expect(isModelAspectRatioEnabled(model, '16:9')).toBe(false)
    expect(isModelAspectRatioEnabled(model, '3:4')).toBe(true)
    expect(resolveEnabledModelAspectRatios(model)).not.toContain('21:9')
  })

  it('recognizes the normalized playground size before checking a restriction', () => {
    expect(isModelSizeAspectRatioEnabled(model, '1824x1024')).toBe(false)
    expect(isModelSizeAspectRatioEnabled(model, '1024x1360')).toBe(true)
    expect(isModelSizeAspectRatioEnabled(model, 'auto')).toBe(true)
  })
})
