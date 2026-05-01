import { ApiError, badRequest, forbidden, unauthorized } from '../errors'
import { getBearerToken } from '../request'
import { jsonOk } from '../response'
import { cleanupSquareStorage, getSquareUsage } from '../storage'
import type { RequestContext } from '../types'

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
