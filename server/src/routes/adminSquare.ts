import { Router } from 'express'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import { requireAdmin } from '../auth.js'
import { env } from '../env.js'
import { HttpError, sendOk } from '../http.js'

const router = Router()
router.use(requireAdmin)

type SquareEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { message?: string; code?: string } }

function assertSquareConfigured() {
  if (!env.squareApiUrl || !env.squareAdminToken) {
    throw new HttpError(
      400,
      'square_not_configured',
      '尚未配置 SQUARE_API_URL / SQUARE_ADMIN_TOKEN，无法管理广场内容',
    )
  }
}

function isSquareConfigured() {
  return Boolean(env.squareApiUrl && env.squareAdminToken)
}

function emptySquareUsage() {
  return {
    storage: {
      estimatedBytes: 0,
      assetCount: 0,
      maxBytes: 0,
      percentOfMax: 0,
    },
    shares: {
      total: 0,
      published: 0,
      hidden: 0,
      deleted: 0,
      rejected: 0,
      pendingReview: 0,
      byKind: {},
    },
    limits: {
      maxPublishedShares: 0,
      maxStoredShares: 0,
      cleanupBatchLimit: 0,
    },
  }
}

async function callSquare<T>(path: string, init: RequestInit = {}): Promise<T> {
  assertSquareConfigured()
  const response = await fetch(`${env.squareApiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.squareAdminToken}`,
      ...init.headers,
    },
  })
  const payload = (await response.json().catch(() => null)) as SquareEnvelope<T> | null
  if (!response.ok || !payload?.ok) {
    throw new HttpError(
      response.status || 502,
      payload && !payload.ok ? payload.error?.code || 'square_error' : 'square_error',
      payload && !payload.ok ? payload.error?.message || '广场接口请求失败' : '广场接口请求失败',
    )
  }
  return payload.data
}

function absolutizeSquareAssetUrls(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const data = value as { items?: Array<{ coverAsset?: { thumbUrl?: string; originalUrl?: string } | null }> }
  if (!Array.isArray(data.items)) return value
  return {
    ...data,
    items: data.items.map((item) => ({
      ...item,
      coverAsset: item.coverAsset
        ? {
            ...item.coverAsset,
            thumbUrl: item.coverAsset.thumbUrl?.startsWith('/')
              ? `${env.squareApiUrl}${item.coverAsset.thumbUrl}`
              : item.coverAsset.thumbUrl,
            originalUrl: item.coverAsset.originalUrl?.startsWith('/')
              ? `${env.squareApiUrl}${item.coverAsset.originalUrl}`
              : item.coverAsset.originalUrl,
          }
        : item.coverAsset,
    })),
  }
}

router.get('/usage', async (_req, res, next) => {
  try {
    if (!isSquareConfigured()) {
      sendOk(res, emptySquareUsage())
      return
    }
    const usage = await callSquare('/api/v1/admin/usage')
    sendOk(res, usage)
  } catch (error) {
    next(error)
  }
})

router.get('/shares', async (req, res, next) => {
  try {
    if (!isSquareConfigured()) {
      sendOk(res, { items: [] })
      return
    }
    const query = new URLSearchParams()
    for (const key of ['status', 'kind', 'q', 'limit']) {
      const value = req.query[key]
      if (typeof value === 'string' && value) query.set(key, value)
    }
    const data = await callSquare(`/api/v1/admin/shares?${query}`)
    sendOk(res, absolutizeSquareAssetUrls(data))
  } catch (error) {
    next(error)
  }
})

const statusSchema = z.object({
  status: z.enum(['published', 'pending_review', 'hidden', 'deleted', 'rejected']),
})

const batchStatusSchema = statusSchema.extend({
  ids: z.array(z.string().min(1)).min(1).max(100),
})

router.post('/shares/batch/status', async (req, res, next) => {
  try {
    const input = batchStatusSchema.parse(req.body)
    const data = await callSquare('/api/v1/admin/shares/batch/status', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    await writeAudit(req, 'square.share.batch.status', 'square', {
      status: input.status,
      ids: input.ids,
      affected: typeof data === 'object' && data && 'affected' in data ? data.affected : undefined,
    })
    sendOk(res, data)
  } catch (error) {
    next(error)
  }
})

router.post('/shares/:id/status', async (req, res, next) => {
  try {
    const input = statusSchema.parse(req.body)
    const data = await callSquare(`/api/v1/admin/shares/${encodeURIComponent(req.params.id)}/status`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    await writeAudit(req, 'square.share.status', req.params.id, input)
    sendOk(res, data)
  } catch (error) {
    next(error)
  }
})

router.post('/cleanup', async (req, res, next) => {
  try {
    const data = await callSquare('/api/v1/admin/cleanup', {
      method: 'POST',
      body: JSON.stringify(req.body ?? {}),
    })
    await writeAudit(req, 'square.cleanup', 'square', req.body ?? {})
    sendOk(res, data)
  } catch (error) {
    next(error)
  }
})

export default router
