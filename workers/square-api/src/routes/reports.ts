import { getConfig } from '../config'
import { createReportId, enforceRateLimit, getPublisherByRequest } from '../db'
import { hmacSha256 } from '../crypto'
import { notFound } from '../errors'
import { getBearerToken, getClientIp } from '../request'
import { jsonOk } from '../response'
import type { RequestContext } from '../types'
import { readJsonBody } from '../validation'

async function readOptionalPublisherId(ctx: RequestContext): Promise<string | null> {
  if (!getBearerToken(ctx.request)) return null
  try {
    return (await getPublisherByRequest(ctx.request, ctx.env)).id
  } catch {
    return null
  }
}

async function hashReporterIp(ctx: RequestContext): Promise<string> {
  const ip = getClientIp(ctx.request)
  const secret = ctx.env.TOKEN_HASH_SECRET || 'report-ip-fallback'
  return hmacSha256(secret, ip)
}

export async function handleReportShare(ctx: RequestContext, shareId: string): Promise<Response> {
  const config = getConfig(ctx.env)
  const ip = getClientIp(ctx.request)
  await enforceRateLimit(ctx.env, `report:ip:${ip}`, 10, 60 * 1000)

  const share = await ctx.env.DB.prepare('SELECT status FROM shares WHERE id = ?')
    .bind(shareId)
    .first<{ status: string }>()
  if (!share || share.status === 'deleted') {
    throw notFound('分享不存在')
  }

  const body = await readJsonBody<{ reason?: unknown }>(ctx.request)
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 400) : null
  const publisherId = await readOptionalPublisherId(ctx)
  const reporterIpHash = await hashReporterIp(ctx)
  const now = Date.now()

  await ctx.env.DB.prepare(
    `INSERT INTO reports (id, share_id, publisher_id, reporter_ip_hash, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(createReportId(), shareId, publisherId, reporterIpHash, reason, now)
    .run()

  const updateResult = await ctx.env.DB.prepare(
    `UPDATE shares
     SET report_count = report_count + 1,
         updated_at = ?
     WHERE id = ?`,
  )
    .bind(now, shareId)
    .run()

  if ((updateResult.meta.changes ?? 0) > 0) {
    await ctx.env.DB.prepare(
      `UPDATE shares
       SET status = 'pending_review', updated_at = ?
       WHERE id = ?
         AND status = 'published'
         AND report_count >= ?`,
    )
      .bind(now, shareId, config.autoHideReportThreshold)
      .run()
      .catch(() => undefined)
  }

  return jsonOk({}, {}, ctx.corsHeaders)
}
