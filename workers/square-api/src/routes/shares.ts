import { getConfig } from '../config'
import {
  assertQuotaAvailable,
  consumeQuota,
  createAssetId,
  createShareId,
  enforceRateLimit,
  findExistingShareByRequest,
  getPublisherByRequest,
  releaseQuotaBestEffort,
} from '../db'
import { forbidden, notFound, validationFailed } from '../errors'
import { getClientIp } from '../request'
import { jsonOk } from '../response'
import { buildAssetUrl } from '../assetUrls'
import {
  assertSquareCapacityAvailable,
  getUploadedAssetsStorageBytes,
  purgeShareAssets,
  releaseStorageBytesBestEffort,
  reserveStorageBytes,
} from '../storage'
import { validateTurnstileIfNeeded } from '../turnstile'
import type {
  RequestContext,
  ShareManifest,
  StoredAssetRow,
  UploadedAsset,
} from '../types'
import { readCreateShareRequest } from '../validation'

function safeJsonArray(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function getCoverAssetId(rows: StoredAssetRow[]): string | null {
  return rows.find((asset) => asset.role === 'output')?.id ?? rows[0]?.id ?? null
}

function buildR2Key(shareId: string, assetId: string, variant: 'original' | 'thumb'): string {
  return `shares/${shareId}/assets/${assetId}/${variant}`
}

function buildStoredAssetResponse(ctx: RequestContext, row: StoredAssetRow) {
  return {
    assetId: row.id,
    clientAssetId: row.clientAssetId,
    role: row.role,
    thumbUrl: buildAssetUrl(ctx.env, row.id, row.thumbR2Key ?? row.r2Key, 'thumb'),
    originalUrl: buildAssetUrl(ctx.env, row.id, row.r2Key, 'original'),
    width: row.width,
    height: row.height,
  }
}

async function listStoredAssetResponses(ctx: RequestContext, shareId: string) {
  const rows = await ctx.env.DB.prepare(
    `SELECT id, client_asset_id, role, r2_key, thumb_r2_key, width, height
     FROM share_assets
     WHERE share_id = ?
     ORDER BY created_at ASC`,
  )
    .bind(shareId)
    .all<{
      id: string
      client_asset_id: string
      role: 'output' | 'origin_input'
      r2_key: string
      thumb_r2_key: string | null
      width: number | null
      height: number | null
    }>()

  return rows.results.map((row) => ({
    assetId: row.id,
    clientAssetId: row.client_asset_id,
    role: row.role,
    thumbUrl: buildAssetUrl(ctx.env, row.id, row.thumb_r2_key ?? row.r2_key, 'thumb'),
    originalUrl: buildAssetUrl(ctx.env, row.id, row.r2_key, 'original'),
    width: row.width,
    height: row.height,
  }))
}

async function uploadAssets(
  ctx: RequestContext,
  shareId: string,
  assets: UploadedAsset[],
): Promise<StoredAssetRow[]> {
  const rows: StoredAssetRow[] = []
  for (const asset of assets) {
    const assetId = createAssetId()
    const r2Key = buildR2Key(shareId, assetId, 'original')
    const thumbR2Key = buildR2Key(shareId, assetId, 'thumb')
    let originalUploaded = false
    try {
      await ctx.env.IMAGES.put(r2Key, asset.original, {
        httpMetadata: {
          contentType: asset.original.type || asset.manifest.mimeType,
        },
        customMetadata: {
          shareId,
          assetId,
          role: asset.manifest.role,
        },
      })
      originalUploaded = true
      await ctx.env.IMAGES.put(thumbR2Key, asset.thumbnail, {
        httpMetadata: {
          contentType: asset.thumbnail.type || 'image/webp',
        },
        customMetadata: {
          shareId,
          assetId,
          role: asset.manifest.role,
          variant: 'thumb',
        },
      })
    } catch (error) {
      if (originalUploaded) {
        await ctx.env.IMAGES.delete(r2Key).catch(() => undefined)
      }
      throw error
    }

    rows.push({
      id: assetId,
      clientAssetId: asset.manifest.clientAssetId,
      role: asset.manifest.role,
      r2Key,
      thumbR2Key,
      mimeType: asset.original.type || asset.manifest.mimeType,
      byteSize: asset.original.size,
      thumbByteSize: asset.thumbnail.size,
      width: asset.manifest.width ?? null,
      height: asset.manifest.height ?? null,
    })
  }

  return rows
}

async function deleteUploadedAssetsBestEffort(ctx: RequestContext, rows: StoredAssetRow[]): Promise<void> {
  await Promise.all(
    rows.flatMap((asset) => [
      ctx.env.IMAGES.delete(asset.r2Key).catch(() => undefined),
      ctx.env.IMAGES.delete(asset.thumbR2Key).catch(() => undefined),
    ]),
  )
}

function buildShareStatements(
  ctx: RequestContext,
  input: {
    shareId: string
    publisherId: string
    manifest: ShareManifest
    manifestJson: string
    coverAssetId: string | null
    assetRows: StoredAssetRow[]
    now: number
  },
): D1PreparedStatement[] {
  const config = getConfig(ctx.env)
  const tagsJson = JSON.stringify(input.manifest.tags ?? [])
  const statements = [
    ctx.env.DB.prepare(
      `INSERT INTO shares (
         id,
         publisher_id,
         kind,
         title,
         prompt,
         manifest_json,
         cover_asset_id,
         tags_json,
         status,
         client_request_id,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      input.shareId,
      input.publisherId,
      input.manifest.kind,
      input.manifest.title,
      input.manifest.prompt,
      input.manifestJson,
      input.coverAssetId,
      tagsJson,
      config.defaultShareStatus,
      input.manifest.clientRequestId,
      input.now,
      input.now,
    ),
  ]

  for (const asset of input.assetRows) {
    statements.push(
      ctx.env.DB.prepare(
        `INSERT INTO share_assets (
           id,
           share_id,
           client_asset_id,
           role,
           r2_key,
           thumb_r2_key,
           mime_type,
           byte_size,
           thumb_byte_size,
           width,
           height,
           created_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        asset.id,
        input.shareId,
        asset.clientAssetId,
        asset.role,
        asset.r2Key,
        asset.thumbR2Key,
        asset.mimeType,
        asset.byteSize,
        asset.thumbByteSize,
        asset.width,
        asset.height,
        input.now,
      ),
    )
  }

  return statements
}

async function storeShare(
  ctx: RequestContext,
  input: {
    publisherId: string
    manifest: ShareManifest
    assets: UploadedAsset[]
  },
): Promise<{ id: string; assets: ReturnType<typeof buildStoredAssetResponse>[] }> {
  const existingShare = await findExistingShareByRequest(
    ctx.env,
    input.publisherId,
    input.manifest.clientRequestId,
  )
  if (existingShare) {
    return {
      id: existingShare.id,
      assets: await listStoredAssetResponses(ctx, existingShare.id),
    }
  }

  await assertQuotaAvailable(ctx.env, input.publisherId, input.manifest.kind)
  await assertSquareCapacityAvailable(ctx.env)

  const storageBytes = getUploadedAssetsStorageBytes(input.assets)
  let storageReserved = false
  await reserveStorageBytes(ctx.env, storageBytes)
  storageReserved = storageBytes > 0

  const shareId = createShareId()
  let uploadedRows: StoredAssetRow[] = []
  let quotaConsumed = false
  try {
    uploadedRows = await uploadAssets(ctx, shareId, input.assets)
    await consumeQuota(ctx.env, input.publisherId, input.manifest.kind)
    quotaConsumed = true
    const now = Date.now()
    await ctx.env.DB.batch(
      buildShareStatements(ctx, {
        shareId,
        publisherId: input.publisherId,
        manifest: input.manifest,
        manifestJson: JSON.stringify(input.manifest),
        coverAssetId: getCoverAssetId(uploadedRows),
        assetRows: uploadedRows,
        now,
      }),
    )
    return {
      id: shareId,
      assets: uploadedRows.map((row) => buildStoredAssetResponse(ctx, row)),
    }
  } catch (error) {
    await deleteUploadedAssetsBestEffort(ctx, uploadedRows)
    if (quotaConsumed) {
      await releaseQuotaBestEffort(ctx.env, input.publisherId, input.manifest.kind)
    }
    if (storageReserved) {
      await releaseStorageBytesBestEffort(ctx.env, storageBytes)
    }
    throw error
  }
}

export async function handleCreateShare(ctx: RequestContext): Promise<Response> {
  const config = getConfig(ctx.env)
  const publisher = await getPublisherByRequest(ctx.request, ctx.env)
  const ip = getClientIp(ctx.request)
  await enforceRateLimit(
    ctx.env,
    `share:publisher:${publisher.id}`,
    config.publisherShareRateLimitPerMinute,
    60 * 1000,
  )
  await enforceRateLimit(
    ctx.env,
    `share:ip:${ip}`,
    config.ipShareRateLimitPerMinute,
    60 * 1000,
  )

  const { manifest, assets } = await readCreateShareRequest(ctx.env, ctx.request)
  await validateTurnstileIfNeeded(ctx, manifest.turnstileToken)
  const share = await storeShare(ctx, {
    publisherId: publisher.id,
    manifest,
    assets,
  })

  return jsonOk(share, { status: 201 }, ctx.corsHeaders)
}

export async function handleGetShare(ctx: RequestContext, shareId: string): Promise<Response> {
  const share = await ctx.env.DB.prepare(
    `SELECT
       id,
       kind,
       title,
       prompt,
       manifest_json,
       cover_asset_id,
       tags_json,
       status,
       created_at,
       view_count
     FROM shares
     WHERE id = ?`,
  )
    .bind(shareId)
    .first<{
      id: string
      kind: 'image' | 'task' | 'prompt'
      title: string
      prompt: string
      manifest_json: string
      cover_asset_id: string | null
      tags_json: string
      status: string
      created_at: number
      view_count: number
    }>()

  if (!share || share.status !== 'published') {
    throw notFound('分享不存在')
  }

  const assets = await ctx.env.DB.prepare(
    `SELECT id, client_asset_id, role, r2_key, thumb_r2_key, width, height
     FROM share_assets
     WHERE share_id = ?
     ORDER BY created_at ASC`,
  )
    .bind(shareId)
    .all<{
      id: string
      client_asset_id: string
      role: 'output' | 'origin_input'
      r2_key: string
      thumb_r2_key: string | null
      width: number | null
      height: number | null
    }>()

  await ctx.env.DB.prepare('UPDATE shares SET view_count = view_count + 1 WHERE id = ?')
    .bind(shareId)
    .run()
    .catch(() => undefined)

  const normalizedAssets = assets.results.map((asset) => ({
    assetId: asset.id,
    clientAssetId: asset.client_asset_id,
    role: asset.role,
    thumbUrl: buildAssetUrl(ctx.env, asset.id, asset.thumb_r2_key ?? asset.r2_key, 'thumb'),
    originalUrl: buildAssetUrl(ctx.env, asset.id, asset.r2_key, 'original'),
    width: asset.width,
    height: asset.height,
  }))

  return jsonOk(
    {
      id: share.id,
      kind: share.kind,
      title: share.title,
      prompt: share.prompt,
      tags: safeJsonArray(share.tags_json),
      status: share.status,
      createdAt: share.created_at,
      viewCount: share.view_count + 1,
      coverAsset:
        normalizedAssets.find((asset) => asset.assetId === share.cover_asset_id) ?? null,
      assets: normalizedAssets,
      manifest: JSON.parse(share.manifest_json) as unknown,
    },
    {},
    ctx.corsHeaders,
  )
}

export async function handleDeleteShare(ctx: RequestContext, shareId: string): Promise<Response> {
  const publisher = await getPublisherByRequest(ctx.request, ctx.env)
  const share = await ctx.env.DB.prepare(
    'SELECT publisher_id, status FROM shares WHERE id = ?',
  )
    .bind(shareId)
    .first<{ publisher_id: string; status: string }>()

  if (!share) {
    throw notFound('分享不存在')
  }
  if (share.publisher_id !== publisher.id) {
    throw forbidden('不能删除其他发布者的分享')
  }
  if (share.status === 'deleted') {
    await purgeShareAssets(ctx.env, shareId).catch((error) => {
      console.error(`failed to purge assets for deleted share ${shareId}`, error)
    })
    return jsonOk({}, {}, ctx.corsHeaders)
  }

  await ctx.env.DB.prepare(
    `UPDATE shares
     SET status = 'deleted', updated_at = ?
     WHERE id = ?`,
  )
    .bind(Date.now(), shareId)
    .run()

  await purgeShareAssets(ctx.env, shareId).catch((error) => {
    console.error(`failed to purge assets for deleted share ${shareId}`, error)
  })

  return jsonOk({}, {}, ctx.corsHeaders)
}

export function assertShareId(value: string | undefined): string {
  if (!value) {
    throw validationFailed('缺少分享 ID')
  }
  return value
}
