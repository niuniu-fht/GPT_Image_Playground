import { ApiError, badRequest, forbidden, unauthorized } from '../errors'
import { getBearerToken } from '../request'
import { jsonOk } from '../response'
import { cleanupSquareStorage, getSquareUsage } from '../storage'
import { buildAssetUrl } from '../assetUrls'
import type { RequestContext, ShareKind, ShareStatus } from '../types'

function assertAdmin(ctx: RequestContext): void {
  const expectedToken = ctx.env.ADMIN_TOKEN?.trim()
  if (!expectedToken) {
    throw forbidden('服务端未配置 ADMIN_TOKEN，无法访问管理接口')
  }

  const token = getBearerToken(ctx.request)
  if (!token || token !== expectedToken) {
    throw unauthorized('管理员令牌无效')
  }
}

async function readOptionalJsonBody(request: Request): Promise<Record<string, unknown>> {
  const rawBody = await request.text()
  if (!rawBody.trim()) return {}

  try {
    const parsed = JSON.parse(rawBody) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw badRequest('请求体必须是 JSON 对象')
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw badRequest('请求体不是合法 JSON')
  }
}

function readOptionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw badRequest('limit 必须是正数')
  }
  return Math.floor(value)
}

function readLimitParam(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 30
  return Math.min(Math.floor(parsed), 100)
}

function readPageParam(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 1
  return Math.floor(parsed)
}

function readPageSizeParam(searchParams: URLSearchParams): number {
  return readLimitParam(searchParams.get('pageSize') ?? searchParams.get('limit'))
}

function readShareStatus(value: unknown): ShareStatus {
  if (
    value === 'published' ||
    value === 'pending_review' ||
    value === 'hidden' ||
    value === 'deleted' ||
    value === 'rejected'
  ) {
    return value
  }
  throw badRequest('status 只允许 published、pending_review、hidden、deleted 或 rejected')
}

function readShareIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw badRequest('ids 必须是数组')
  }
  const ids = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  if (ids.length < 1) {
    throw badRequest('至少选择 1 条广场内容')
  }
  if (ids.length > 100) {
    throw badRequest('单次最多处理 100 条广场内容')
  }
  return ids
}

function safeJsonArray(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

export async function handleGetAdminUsage(ctx: RequestContext): Promise<Response> {
  assertAdmin(ctx)
  return jsonOk(await getSquareUsage(ctx.env), {}, ctx.corsHeaders)
}

export async function handleRunAdminCleanup(ctx: RequestContext): Promise<Response> {
  assertAdmin(ctx)
  const body = await readOptionalJsonBody(ctx.request)
  const result = await cleanupSquareStorage(ctx.env, {
    reason: 'manual',
    dryRun: body.dryRun === true,
    limit: readOptionalNumber(body.limit),
    prunePublished:
      typeof body.prunePublished === 'boolean' ? body.prunePublished : undefined,
  })

  return jsonOk(result, {}, ctx.corsHeaders)
}

export async function handleListAdminShares(ctx: RequestContext, url: URL): Promise<Response> {
  assertAdmin(ctx)
  const page = readPageParam(url.searchParams.get('page'))
  const pageSize = readPageSizeParam(url.searchParams)
  const offset = (page - 1) * pageSize
  const status = url.searchParams.get('status')
  const kind = url.searchParams.get('kind')
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const conditions: string[] = []
  const params: Array<string | number> = []

  if (status && status !== 'all') {
    conditions.push('s.status = ?')
    params.push(readShareStatus(status))
  }

  if (kind && kind !== 'all') {
    if (kind !== 'image' && kind !== 'task' && kind !== 'prompt') {
      throw badRequest('kind 只允许 image、task、prompt 或 all')
    }
    conditions.push('s.kind = ?')
    params.push(kind)
  }

  if (q) {
    conditions.push('(LOWER(s.title) LIKE ? OR LOWER(s.prompt) LIKE ? OR LOWER(s.tags_json) LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = await ctx.env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM shares s
     ${whereSql}`,
  )
    .bind(...params)
    .first<{ total: number }>()

  const rows = await ctx.env.DB.prepare(
    `SELECT
       s.id,
       s.publisher_id,
       s.kind,
       s.title,
       s.prompt,
       s.tags_json,
       s.status,
       s.client_request_id,
       s.view_count,
       s.report_count,
       s.created_at,
       s.updated_at,
       a.id AS cover_asset_id,
       a.r2_key AS cover_r2_key,
       a.thumb_r2_key AS cover_thumb_r2_key,
       a.width AS cover_width,
       a.height AS cover_height
     FROM shares s
     LEFT JOIN share_assets a ON a.id = s.cover_asset_id
     ${whereSql}
     ORDER BY s.updated_at DESC, s.created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all<{
      id: string
      publisher_id: string
      kind: ShareKind
      title: string
      prompt: string
      tags_json: string
      status: ShareStatus
      client_request_id: string
      view_count: number
      report_count: number
      created_at: number
      updated_at: number
      cover_asset_id: string | null
      cover_r2_key: string | null
      cover_thumb_r2_key: string | null
      cover_width: number | null
      cover_height: number | null
    }>()

  return jsonOk(
    {
      total: totalRow?.total ?? 0,
      page,
      pageSize,
      items: rows.results.map((row) => ({
        id: row.id,
        publisherId: row.publisher_id,
        kind: row.kind,
        title: row.title,
        prompt: row.prompt,
        tags: safeJsonArray(row.tags_json),
        status: row.status,
        clientRequestId: row.client_request_id,
        viewCount: row.view_count,
        reportCount: row.report_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        coverAsset: row.cover_asset_id
          ? {
              assetId: row.cover_asset_id,
              thumbUrl: buildAssetUrl(ctx.env, row.cover_asset_id, row.cover_thumb_r2_key ?? row.cover_r2_key, 'thumb'),
              originalUrl: buildAssetUrl(ctx.env, row.cover_asset_id, row.cover_r2_key, 'original'),
              width: row.cover_width,
              height: row.cover_height,
            }
          : null,
      })),
    },
    {},
    ctx.corsHeaders,
  )
}

export async function handleUpdateAdminShareStatus(
  ctx: RequestContext,
  shareId: string,
): Promise<Response> {
  assertAdmin(ctx)
  const body = await readOptionalJsonBody(ctx.request)
  const status = readShareStatus(body.status)
  const result = await ctx.env.DB.prepare(
    `UPDATE shares
     SET status = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(status, Date.now(), shareId)
    .run()

  if ((result.meta.changes ?? 0) < 1) {
    throw badRequest('分享不存在或状态未更新')
  }

  return jsonOk({ id: shareId, status }, {}, ctx.corsHeaders)
}

export async function handleBatchUpdateAdminShareStatus(ctx: RequestContext): Promise<Response> {
  assertAdmin(ctx)
  const body = await readOptionalJsonBody(ctx.request)
  const status = readShareStatus(body.status)
  const ids = readShareIds(body.ids)
  const now = Date.now()
  const statements = ids.map((id) => ctx.env.DB.prepare(
    `UPDATE shares
     SET status = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(status, now, id))
  const results = await ctx.env.DB.batch(statements)
  const affected = results.reduce((sum, result) => sum + (result.meta.changes ?? 0), 0)

  return jsonOk({ affected, requested: ids.length, status }, {}, ctx.corsHeaders)
}
