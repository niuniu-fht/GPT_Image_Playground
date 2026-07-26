import { describe, expect, it } from 'vitest'
import type { InputImage } from '../../types'
import { reorderInputImages } from '../slices/inputDraftSlice'

function createInputImage(id: string): InputImage {
  return {
    id,
    dataUrl: `data:image/png;base64,${id}`,
  }
}

describe('reorderInputImages', () => {
  const inputImages = ['one', 'two', 'three'].map(createInputImage)

  it('moves an image forward while preserving the complete image object', () => {
    const nextInputImages = reorderInputImages(inputImages, 0, 2)

    expect(nextInputImages.map((image) => image.id)).toEqual(['two', 'three', 'one'])
    expect(nextInputImages[2]).toBe(inputImages[0])
  })

  it('moves an image backward', () => {
    const nextInputImages = reorderInputImages(inputImages, 2, 0)

    expect(nextInputImages.map((image) => image.id)).toEqual(['three', 'one', 'two'])
  })

  it('keeps the same array for unchanged or invalid moves', () => {
    expect(reorderInputImages(inputImages, 1, 1)).toBe(inputImages)
    expect(reorderInputImages(inputImages, -1, 1)).toBe(inputImages)
    expect(reorderInputImages(inputImages, 0, inputImages.length)).toBe(inputImages)
  })
})
