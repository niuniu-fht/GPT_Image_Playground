import { badRequest } from '../errors'
import { getPublisherByRequest } from '../db'
import { jsonOk } from '../response'
import type { RequestContext, ShareKind } from '../types'

const FEED_LIMIT_MAX = 60

function readKind(value: string | null): ShareKind {
  if (value === 'image' || value === 'task' || value === 'prompt') {
    return value
  }
  throw badRequest('kind 只允许 image、task 或 prompt')
}

function readLimit(value: string | null): number {
  if (!value) return 30
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 30
  return Math.min(Math.floor(parsed), FEED_LIMIT_MAX)
}

function encodeCursor(createdAt: number, id: string): string {
  return `${createdAt}:${id}`
}

function decodeCursor(cursor: string | null): { createdAt: number; id: string } | null {
  if (!cursor) return null
  const separatorIndex = cursor.indexOf(':')
  if (separatorIndex <= 0) return null
  const createdAt = Number(cursor.slice(0, separatorIndex))
  const id = cursor.slice(separatorIndex + 1)
  if (!Number.isFinite(createdAt) || !id) return null
  return { createdAt, id }
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

export async function handleListSquare(ctx: RequestContext, url: URL): Promise<Response> {
  const kind = readKind(url.searchParams.get('kind'))
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const limit = readLimit(url.searchParams.get('limit'))
  const cursor = decodeCursor(url.searchParams.get('cursor'))
  const conditions = ['s.status = ?', 's.kind = ?']
  const params: Array<string | number> = ['published', kind]

  if (q) {
    conditions.push('(LOWER(s.title) LIKE ? OR LOWER(s.prompt) LIKE ? OR LOWER(s.tags_json) LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  if (cursor) {
    conditions.push('(s.created_at < ? OR (s.created_at = ? AND s.id < ?))')
    params.push(cursor.createdAt, cursor.createdAt, cursor.id)
  }

  params.push(limit + 1)
  const rows = await ctx.env.DB.prepare(
    `SELECT
       s.id,
       s.kind,
       s.title,
       s.prompt,
       s.tags_json,
       s.status,
       s.created_at,
       s.view_count,
       a.id AS cover_asset_id,
       a.width AS cover_width,
       a.height AS cover_height
     FROM shares s
     LEFT JOIN share_assets a ON a.id = s.cover_asset_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT ?`,
  )
    .bind(...params)
    .all<{
      id: string
      kind: ShareKind
      title: string
      prompt: string
      tags_json: string
      status: string
      created_at: number
      view_count: number
      cover_asset_id: string | null
      cover_width: number | null
      cover_height: number | null
    }>()

  const pageRows = rows.results.slice(0, limit)
  const nextRow = rows.results.length > limit ? rows.results[limit] : null
  const items = pageRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    prompt: row.prompt,
    tags: safeJsonArray(row.tags_json),
    status: row.status,
    createdAt: row.created_at,
    viewCount: row.view_count,
    coverAsset: row.cover_asset_id
      ? {
          assetId: row.cover_asset_id,
          thumbUrl: `/api/v1/assets/${row.cover_asset_id}?variant=thumb`,
          originalUrl: `/api/v1/assets/${row.cover_asset_id}?variant=original`,
          width: row.cover_width,
          height: row.cover_height,
        }
      : null,
  }))

  return jsonOk(
    {
      items,
      nextCursor: nextRow ? encodeCursor(nextRow.created_at, nextRow.id) : null,
    },
    {},
    ctx.corsHeaders,
  )
}

export async function handleListMyShares(ctx: RequestContext, url: URL): Promise<Response> {
  const publisher = await getPublisherByRequest(ctx.request, ctx.env)
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
  const limit = readLimit(url.searchParams.get('limit'))
  const cursor = decodeCursor(url.searchParams.get('cursor'))
  const conditions = ['s.publisher_id = ?', "s.status != 'deleted'", "s.kind IN ('task', 'prompt')"]
  const params: Array<string | number> = [publisher.id]

  if (q) {
    conditions.push('(LOWER(s.title) LIKE ? OR LOWER(s.prompt) LIKE ? OR LOWER(s.tags_json) LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }

  if (cursor) {
    conditions.push('(s.created_at < ? OR (s.created_at = ? AND s.id < ?))')
    params.push(cursor.createdAt, cursor.createdAt, cursor.id)
  }

  params.push(limit + 1)
  const rows = await ctx.env.DB.prepare(
    `SELECT
       s.id,
       s.kind,
       s.title,
       s.prompt,
       s.tags_json,
       s.status,
       s.created_at,
       s.view_count,
       a.id AS cover_asset_id,
       a.width AS cover_width,
       a.height AS cover_height
     FROM shares s
     LEFT JOIN share_assets a ON a.id = s.cover_asset_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY s.created_at DESC, s.id DESC
     LIMIT ?`,
  )
    .bind(...params)
    .all<{
      id: string
      kind: ShareKind
      title: string
      prompt: string
      tags_json: string
      status: string
      created_at: number
      view_count: number
      cover_asset_id: string | null
      cover_width: number | null
      cover_height: number | null
    }>()

  const pageRows = rows.results.slice(0, limit)
  const nextRow = rows.results.length > limit ? rows.results[limit] : null
  const items = pageRows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    prompt: row.prompt,
    tags: safeJsonArray(row.tags_json),
    status: row.status,
    createdAt: row.created_at,
    viewCount: row.view_count,
    coverAsset: row.cover_asset_id
      ? {
          assetId: row.cover_asset_id,
          thumbUrl: `/api/v1/assets/${row.cover_asset_id}?variant=thumb`,
          originalUrl: `/api/v1/assets/${row.cover_asset_id}?variant=original`,
          width: row.cover_width,
          height: row.cover_height,
        }
      : null,
  }))

  return jsonOk(
    {
      items,
      nextCursor: nextRow ? encodeCursor(nextRow.created_at, nextRow.id) : null,
    },
    {},
    ctx.corsHeaders,
  )
}
