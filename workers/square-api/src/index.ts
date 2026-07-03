import { createOptionsResponse, resolveCors } from './cors'
import { ApiError } from './errors'
import { jsonError, jsonOk } from './response'
import {
  handleBatchUpdateAdminShareStatus,
  handleGetAdminUsage,
  handleListAdminShares,
  handleRunAdminCleanup,
  handleUpdateAdminShareStatus,
} from './routes/admin'
import { handleGetAsset } from './routes/assets'
import { handleCreateIdentity } from './routes/identity'
import { handleReportShare } from './routes/reports'
import { handleListMyShares, handleListSquare } from './routes/square'
import {
  assertShareId,
  handleCreateShare,
  handleDeleteShare,
  handleGetShare,
} from './routes/shares'
import { cleanupSquareStorage } from './storage'
import type { Env, RequestContext } from './types'

function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`
}

function normalizePath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  return normalized || '/'
}

async function route(ctx: RequestContext): Promise<Response> {
  const url = new URL(ctx.request.url)
  const path = normalizePath(url.pathname)
  const method = ctx.request.method.toUpperCase()

  if (method === 'GET' && path === '/api/v1/health') {
    return jsonOk(
      {
        status: 'ok',
        service: 'gpt-image-square-api',
        now: Date.now(),
      },
      {},
      ctx.corsHeaders,
    )
  }

  if (method === 'POST' && path === '/api/v1/identity') {
    return handleCreateIdentity(ctx)
  }

  if (method === 'GET' && path === '/api/v1/square') {
    return handleListSquare(ctx, url)
  }

  if (method === 'GET' && path === '/api/v1/me/shares') {
    return handleListMyShares(ctx, url)
  }

  if (method === 'GET' && path === '/api/v1/admin/usage') {
    return handleGetAdminUsage(ctx)
  }

  if (method === 'GET' && path === '/api/v1/admin/shares') {
    return handleListAdminShares(ctx, url)
  }

  if (method === 'POST' && path === '/api/v1/admin/cleanup') {
    return handleRunAdminCleanup(ctx)
  }

  if (method === 'POST' && path === '/api/v1/admin/shares/batch/status') {
    return handleBatchUpdateAdminShareStatus(ctx)
  }

  const adminShareStatusMatch = /^\/api\/v1\/admin\/shares\/([^/]+)\/status$/.exec(path)
  if (adminShareStatusMatch && method === 'POST') {
    return handleUpdateAdminShareStatus(ctx, decodeURIComponent(assertShareId(adminShareStatusMatch[1])))
  }

  if (method === 'POST' && path === '/api/v1/shares') {
    return handleCreateShare(ctx)
  }

  const shareMatch = /^\/api\/v1\/shares\/([^/]+)$/.exec(path)
  if (shareMatch && method === 'GET') {
    return handleGetShare(ctx, decodeURIComponent(assertShareId(shareMatch[1])))
  }

  const shareDeleteMatch = /^\/api\/v1\/shares\/([^/]+)\/delete$/.exec(path)
  if (shareDeleteMatch && method === 'POST') {
    return handleDeleteShare(ctx, decodeURIComponent(assertShareId(shareDeleteMatch[1])))
  }

  const shareReportMatch = /^\/api\/v1\/shares\/([^/]+)\/report$/.exec(path)
  if (shareReportMatch && method === 'POST') {
    return handleReportShare(ctx, decodeURIComponent(assertShareId(shareReportMatch[1])))
  }

  const assetMatch = /^\/api\/v1\/assets\/([^/]+)$/.exec(path)
  if (assetMatch && method === 'GET') {
    return handleGetAsset(ctx, decodeURIComponent(assetMatch[1]), url)
  }

  return jsonError('not_found', '接口不存在', 404, ctx.requestId, ctx.corsHeaders)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = createRequestId()
    const cors = resolveCors(request, env)
    if (request.method.toUpperCase() === 'OPTIONS') {
      return createOptionsResponse(cors)
    }
    if (!cors.allowed) {
      return jsonError('forbidden', '当前来源不允许访问广场 API', 403, requestId)
    }

    const ctx: RequestContext = {
      env,
      request,
      requestId,
      corsHeaders: cors.headers,
    }

    try {
      return await route(ctx)
    } catch (error) {
      if (error instanceof Response) {
        return error
      }
      if (error instanceof ApiError) {
        return jsonError(error.code, error.message, error.status, requestId, cors.headers)
      }
      console.error(`[${requestId}]`, error)
      return jsonError(
        'internal_error',
        error instanceof Error ? error.message : '服务暂时不可用',
        500,
        requestId,
        cors.headers,
      )
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      cleanupSquareStorage(env, { reason: 'scheduled' }).catch((error) => {
        console.error('scheduled square cleanup failed', error)
      }),
    )
  },
}
