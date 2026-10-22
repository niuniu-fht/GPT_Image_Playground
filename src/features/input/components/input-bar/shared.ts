import { DEFAULT_MAX_INPUT_IMAGES } from '../../../../lib/modelCost'

export const API_MAX_IMAGES = DEFAULT_MAX_INPUT_IMAGES

export function isRemotePreviewUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}
