import { describe, expect, it } from 'vitest'
import { calculateImageSize, KNOWN_ASPECT_RATIOS, resolveImageSizeTier } from '../size'

// 档位像素区间定义：1K < 300w；2K ∈ [300w, 600w)；4K ≥ 600w

function pixelsOf(tier: '1K' | '2K' | '4K', ratio: string): { size: string; pixels: number } {
  const size = calculateImageSize(tier, ratio)
  if (!size) throw new Error(`calculateImageSize(${tier}, ${ratio}) 返回空`)
  const [width, height] = size.split('x').map(Number)
  return { size, pixels: width * height }
}

describe('档位像素区间（2K = 300w~600w）', () => {
  it('所有 2K 尺寸落在 [300w, 600w) 区间', () => {
    for (const ratio of KNOWN_ASPECT_RATIOS) {
      const { size, pixels } = pixelsOf('2K', ratio)
      expect(pixels, `${ratio} -> ${size}`).toBeGreaterThanOrEqual(3_000_000)
      expect(pixels, `${ratio} -> ${size}`).toBeLessThan(6_000_000)
    }
  })

  it('所有 1K 尺寸低于 300w，所有 4K 尺寸不低于 600w', () => {
    for (const ratio of KNOWN_ASPECT_RATIOS) {
      expect(pixelsOf('1K', ratio).pixels, `${ratio} 1K`).toBeLessThan(3_000_000)
      expect(pixelsOf('4K', ratio).pixels, `${ratio} 4K`).toBeGreaterThanOrEqual(6_000_000)
    }
  })

  it('每个 档位×比例 的尺寸都能被 resolveImageSizeTier 正确还原档位', () => {
    for (const tier of ['1K', '2K', '4K'] as const) {
      for (const ratio of KNOWN_ASPECT_RATIOS) {
        const { size } = pixelsOf(tier, ratio)
        expect(resolveImageSizeTier(size), `${tier} ${ratio} -> ${size}`).toBe(tier)
      }
    }
  })

  it('旧版 2048x1152 的 2K 尺寸按新定义归入 1K', () => {
    expect(resolveImageSizeTier('2048x1152')).toBe('1K')
  })
})
