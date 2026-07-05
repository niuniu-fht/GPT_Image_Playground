import { getConfig } from './config'
import type { Env } from './types'

export function buildAssetUrl(env: Env, assetId: string, r2Key: string | null | undefined, variant: 'thumb' | 'original'): string {
  const publicBaseUrl = getConfig(env).publicAssetBaseUrl
  if (publicBaseUrl && r2Key) {
    return `${publicBaseUrl}/${r2Key.replace(/^\/+/, '')}`
  }
  return `/api/v1/assets/${assetId}?variant=${variant}`
}
