import { notFound } from '../errors'
import type { RequestContext } from '../types'

export async function handleGetAsset(ctx: RequestContext, assetId: string, url: URL): Promise<Response> {
  const variant = url.searchParams.get('variant') === 'original' ? 'original' : 'thumb'
  const asset = await ctx.env.DB.prepare(
    `SELECT
       a.r2_key,
       a.thumb_r2_key,
       a.mime_type,
       s.status
     FROM share_assets a
     INNER JOIN shares s ON s.id = a.share_id
     WHERE a.id = ?`,
  )
    .bind(assetId)
    .first<{
      r2_key: string
      thumb_r2_key: string | null
      mime_type: string
      status: string
    }>()

  if (!asset || asset.status !== 'published') {
    throw notFound('图片资产不存在')
  }

  const key = variant === 'original' ? asset.r2_key : asset.thumb_r2_key ?? asset.r2_key
  const object = await ctx.env.IMAGES.get(key)
  if (!object) {
    throw notFound('图片文件不存在')
  }

  const headers = new Headers(ctx.corsHeaders)
  headers.set('Content-Type', object.httpMetadata?.contentType || (variant === 'original' ? asset.mime_type : 'image/webp'))
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('ETag', object.httpEtag)

  return new Response(object.body, {
    headers,
  })
}
