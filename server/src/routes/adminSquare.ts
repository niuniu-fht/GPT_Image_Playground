import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Router } from 'express'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import { requireAdmin } from '../auth.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import {
  getSquareRuntimeConfig,
  toSquareAdminConfigView,
  upsertSquareRuntimeConfig,
} from '../squareConfig.js'
import type { Request } from 'express'
import type { Prisma } from '@prisma/client'

const router = Router()
router.use(requireAdmin)

type SquareEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { message?: string; code?: string } }

type SquareShareStatus = 'published' | 'pending_review' | 'hidden' | 'deleted' | 'rejected'

interface AdminSquareSharePage {
  page: number
  pageSize: number
  skip: number
}

interface LocalSquareCleanupInput {
  dryRun?: boolean
  limit?: number
}

interface LocalSquareCleanupResult {
  mode: 'local'
  dryRun: boolean
  candidates: {
    shares: number
    assets: number
    r2Objects: number
    estimatedBytes: number
  }
  deleted: {
    shares: number
    assets: number
    r2Objects: number
  }
}

function createR2Client(config: Awaited<ReturnType<typeof getSquareRuntimeConfig>>): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId: config.r2AccessKey,
      secretAccessKey: config.r2SecretKey,
    },
  })
}

function readAdminSquareSharePage(req: Request): AdminSquareSharePage {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1))
  const rawPageSize = Number(req.query.pageSize ?? req.query.limit)
  const pageSize = Math.max(1, Math.min(Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.floor(rawPageSize) : 20, 100))
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
  }
}

function getR2ValidationMessage(config: Awaited<ReturnType<typeof getSquareRuntimeConfig>>): string | null {
  if (!config.r2Enabled) return 'R2 存储未启用，请先开启后再测试'
  if (!config.r2Endpoint) return '缺少 R2 Endpoint'
  if (!config.r2AccessKey) return '缺少 R2 Access Key'
  if (!config.r2SecretKey) return '缺少 R2 Secret Key'
  if (!config.r2Bucket) return '缺少 R2 Bucket'
  return null
}

function getDiagnosticErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'CredentialsProviderError') return 'R2 密钥不可用，请检查 Access Key 和 Secret Key'
    if (/AccessDenied|Forbidden/i.test(error.message)) return 'R2 权限不足，请确认 Token 具备对象写入、读取和删除权限'
    if (/NoSuchBucket|not exist/i.test(error.message)) return 'R2 Bucket 不存在或当前密钥无权访问'
    if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(error.message)) return '无法连接 R2 Endpoint，请检查账号 ID 和网络'
    return error.message
  }
  return String(error)
}

async function getConfiguredSquare() {
  const config = await getSquareRuntimeConfig()
  if (!config.squareApiUrl || !config.squareAdminToken) {
    throw new HttpError(
      400,
      'square_not_configured',
      '尚未在管理员后台配置广场 API 地址或管理员令牌，无法管理广场内容',
    )
  }
  return config
}

async function isSquareConfigured() {
  const config = await getSquareRuntimeConfig()
  return Boolean(config.squareApiUrl && config.squareAdminToken)
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
  const config = await getConfiguredSquare()
  const response = await fetch(`${config.squareApiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.squareAdminToken}`,
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

async function absolutizeSquareAssetUrls(value: unknown): Promise<unknown> {
  if (!value || typeof value !== 'object') return value
  const config = await getSquareRuntimeConfig()
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
              ? `${config.squareApiUrl}${item.coverAsset.thumbUrl}`
              : item.coverAsset.thumbUrl,
            originalUrl: item.coverAsset.originalUrl?.startsWith('/')
              ? `${config.squareApiUrl}${item.coverAsset.originalUrl}`
              : item.coverAsset.originalUrl,
          }
        : item.coverAsset,
    })),
  }
}

function safeArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function buildPublicAssetUrl(publicBaseUrl: string, key: string): string {
  if (/^https?:\/\//i.test(key)) return key
  if (!publicBaseUrl) return key
  return `${publicBaseUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function mapLocalAsset(asset: {
  id: string
  clientAssetId: string
  role: string
  r2Key: string
  thumbR2Key: string | null
  width: number | null
  height: number | null
}, publicBaseUrl: string) {
  return {
    assetId: asset.id,
    clientAssetId: asset.clientAssetId,
    role: asset.role,
    thumbUrl: buildPublicAssetUrl(publicBaseUrl, asset.thumbR2Key ?? asset.r2Key),
    originalUrl: buildPublicAssetUrl(publicBaseUrl, asset.r2Key),
    width: asset.width,
    height: asset.height,
  }
}

function collectShareAssetKeys(assets: Array<{ r2Key: string; thumbR2Key: string | null }>): string[] {
  return Array.from(
    new Set(
      assets
        .flatMap((asset) => [asset.r2Key, asset.thumbR2Key])
        .filter((key): key is string => typeof key === 'string' && !/^https?:\/\//i.test(key)),
    ),
  )
}

async function deleteLocalSquareR2Objects(keys: string[]): Promise<number> {
  if (!keys.length) return 0
  const config = await getSquareRuntimeConfig()
  const validationMessage = getR2ValidationMessage(config)
  if (validationMessage) {
    throw new HttpError(409, 'r2_cleanup_not_configured', `${validationMessage}，暂不能清理广场云端资源`)
  }

  const client = createR2Client(config)
  try {
    for (const key of keys) {
      await client.send(new DeleteObjectCommand({
        Bucket: config.r2Bucket,
        Key: key,
      }))
    }
  } catch (error) {
    console.warn('[square] local cleanup r2 delete failed', error)
    throw new HttpError(502, 'r2_cleanup_failed', getDiagnosticErrorMessage(error))
  }
  return keys.length
}

async function cleanupLocalSquare(input: LocalSquareCleanupInput): Promise<LocalSquareCleanupResult> {
  const dryRun = input.dryRun !== false
  const limit = Math.max(1, Math.min(Number(input.limit) || 20, 100))
  const shares = await prisma.squareShare.findMany({
    where: { status: 'deleted' },
    orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
    include: { assets: true },
  })
  const assets = shares.flatMap((share) => share.assets)
  const keys = collectShareAssetKeys(assets)
  const estimatedBytes = assets.reduce((sum, asset) => sum + asset.byteSize + asset.thumbByteSize, 0)
  const candidates = {
    shares: shares.length,
    assets: assets.length,
    r2Objects: keys.length,
    estimatedBytes,
  }

  if (dryRun || shares.length === 0) {
    return {
      mode: 'local',
      dryRun,
      candidates,
      deleted: { shares: 0, assets: 0, r2Objects: 0 },
    }
  }

  const deletedR2Objects = await deleteLocalSquareR2Objects(keys)
  const deleteResult = await prisma.squareShare.deleteMany({
    where: { id: { in: shares.map((share) => share.id) } },
  })

  return {
    mode: 'local',
    dryRun,
    candidates,
    deleted: {
      shares: deleteResult.count,
      assets: assets.length,
      r2Objects: deletedR2Objects,
    },
  }
}

async function getLocalSquareUsage() {
  const config = await getSquareRuntimeConfig()
  const [shares, assetAgg] = await Promise.all([
    prisma.squareShare.groupBy({
      by: ['status', 'kind'],
      _count: { _all: true },
    }),
    prisma.squareShareAsset.aggregate({
      _sum: { byteSize: true, thumbByteSize: true },
      _count: { _all: true },
    }),
  ])
  const byKind: Record<string, number> = { image: 0, task: 0, prompt: 0 }
  const statusCounts: Record<string, number> = {
    published: 0,
    hidden: 0,
    deleted: 0,
    rejected: 0,
    pending_review: 0,
  }
  for (const row of shares) {
    byKind[row.kind] = (byKind[row.kind] ?? 0) + row._count._all
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + row._count._all
  }
  const originalBytes = assetAgg._sum.byteSize ?? 0
  const thumbnailBytes = assetAgg._sum.thumbByteSize ?? 0
  return {
    storage: {
      enabled: config.r2Enabled,
      provider: 'Cloudflare R2',
      publicBaseUrl: config.publicBaseUrl,
      endpoint: config.r2Endpoint,
      bucket: config.r2Bucket,
      estimatedBytes: originalBytes + thumbnailBytes,
      counterBytes: originalBytes + thumbnailBytes,
      originalBytes,
      thumbnailBytes,
      assetCount: assetAgg._count._all,
      maxBytes: 0,
      cleanupTargetBytes: 0,
      percentOfMax: 0,
    },
    shares: {
      total: shares.reduce((sum, row) => sum + row._count._all, 0),
      published: statusCounts.published ?? 0,
      hidden: statusCounts.hidden ?? 0,
      deleted: statusCounts.deleted ?? 0,
      rejected: statusCounts.rejected ?? 0,
      pendingReview: statusCounts.pending_review ?? 0,
      byKind,
    },
    limits: {
      maxPublishedShares: 0,
      maxStoredShares: 0,
      cleanupBatchLimit: 100,
    },
  }
}

async function listLocalSquareShares(req: Request) {
  const config = await getSquareRuntimeConfig()
  const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined
  const kind = typeof req.query.kind === 'string' && req.query.kind !== 'all' ? req.query.kind : undefined
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const pagination = readAdminSquareSharePage(req)
  const where: Prisma.SquareShareWhereInput = {
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { prompt: { contains: q, mode: 'insensitive' } }] } : {}),
  }
  const [total, items] = await prisma.$transaction([
    prisma.squareShare.count({ where }),
    prisma.squareShare.findMany({
      where,
      include: { assets: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.pageSize,
    }),
  ])
  return {
    total,
    page: pagination.page,
    pageSize: pagination.pageSize,
    items: items.map((item) => ({
      id: item.id,
      publisherId: item.publisherId,
      kind: item.kind,
      title: item.title,
      prompt: item.prompt,
      tags: safeArray(item.tags),
      status: item.status,
      clientRequestId: item.clientRequestId,
      viewCount: item.viewCount,
      reportCount: item.reportCount,
      createdAt: item.createdAt.getTime(),
      updatedAt: item.updatedAt.getTime(),
      coverAsset: item.assets[0] ? mapLocalAsset(item.assets[0], config.publicBaseUrl) : null,
    })),
  }
}

router.get('/config', async (_req, res, next) => {
  try {
    const config = await getSquareRuntimeConfig()
    sendOk(res, { config: toSquareAdminConfigView(config) })
  } catch (error) {
    next(error)
  }
})

const configSchema = z.object({
  squareApiUrl: z.string().url().optional().or(z.literal('')),
  squareAdminToken: z.string().max(4000).optional(),
  r2Enabled: z.boolean().optional(),
  r2Endpoint: z.string().url().optional().or(z.literal('')),
  r2AccessKey: z.string().max(4000).optional(),
  r2SecretKey: z.string().max(4000).optional(),
  r2Bucket: z.string().max(120).optional(),
  publicBaseUrl: z.string().url().optional().or(z.literal('')),
})

router.patch('/config', async (req, res, next) => {
  try {
    const input = configSchema.parse(req.body ?? {})
    const config = await upsertSquareRuntimeConfig(input)
    await writeAudit(req, 'square.config.update', 'square', {
      ...input,
      squareAdminToken: input.squareAdminToken ? '[REDACTED]' : undefined,
      r2AccessKey: input.r2AccessKey ? '[REDACTED]' : undefined,
      r2SecretKey: input.r2SecretKey ? '[REDACTED]' : undefined,
    })
    sendOk(res, { config: toSquareAdminConfigView(config) })
  } catch (error) {
    next(error)
  }
})

router.post('/test-r2', async (req, res, next) => {
  const startedAt = Date.now()
  try {
    const config = await getSquareRuntimeConfig()
    const validationMessage = getR2ValidationMessage(config)
    if (validationMessage) {
      throw new HttpError(400, 'r2_config_incomplete', validationMessage)
    }

    const client = createR2Client(config)
    const objectKey = `diagnostics/r2-test-${Date.now()}.txt`
    const body = Buffer.from(`GPT Image Playground R2 diagnostic ${new Date().toISOString()}\n`, 'utf8')

    await client.send(new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: objectKey,
      Body: body,
      ContentType: 'text/plain; charset=utf-8',
      Metadata: {
        source: 'gpt-image-playground-admin-diagnostic',
      },
    }))
    const head = await client.send(new HeadObjectCommand({
      Bucket: config.r2Bucket,
      Key: objectKey,
    }))
    await client.send(new DeleteObjectCommand({
      Bucket: config.r2Bucket,
      Key: objectKey,
    }))

    await writeAudit(req, 'square.r2.test', 'square', {
      bucket: config.r2Bucket,
      endpoint: config.r2Endpoint,
      objectKey,
      latencyMs: Date.now() - startedAt,
    })
    sendOk(res, {
      result: {
        ok: true,
        message: 'R2 测试成功：已完成上传、读取元信息和清理',
        bucket: config.r2Bucket,
        endpoint: config.r2Endpoint,
        publicBaseUrl: config.publicBaseUrl,
        objectKey,
        publicUrl: buildPublicAssetUrl(config.publicBaseUrl, objectKey),
        byteSize: head.ContentLength ?? body.byteLength,
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.warn('[square] r2 diagnostic failed', error)
    if (error instanceof HttpError) {
      next(error)
      return
    }
    next(new HttpError(502, 'r2_test_failed', getDiagnosticErrorMessage(error)))
  }
})

router.get('/usage', async (_req, res, next) => {
  try {
    if (!(await isSquareConfigured())) {
      sendOk(res, await getLocalSquareUsage())
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
    if (!(await isSquareConfigured())) {
      sendOk(res, await listLocalSquareShares(req))
      return
    }
    const query = new URLSearchParams()
    for (const key of ['status', 'kind', 'q', 'limit', 'page', 'pageSize']) {
      const value = req.query[key]
      if (typeof value === 'string' && value) query.set(key, value)
    }
    const data = await callSquare(`/api/v1/admin/shares?${query}`)
    sendOk(res, await absolutizeSquareAssetUrls(data))
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

const cleanupSchema = z.object({
  dryRun: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  prunePublished: z.boolean().optional(),
})

router.post('/shares/batch/status', async (req, res, next) => {
  try {
    const input = batchStatusSchema.parse(req.body)
    if (!(await isSquareConfigured())) {
      const result = await prisma.squareShare.updateMany({
        where: { id: { in: input.ids } },
        data: { status: input.status },
      })
      await writeAudit(req, 'square.share.batch.status', 'square', {
        status: input.status,
        ids: input.ids,
        affected: result.count,
      })
      sendOk(res, { affected: result.count, requested: input.ids.length, status: input.status })
      return
    }
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
    if (!(await isSquareConfigured())) {
      await prisma.squareShare.update({
        where: { id: req.params.id },
        data: { status: input.status as SquareShareStatus },
      })
      await writeAudit(req, 'square.share.status', req.params.id, input)
      sendOk(res, { id: req.params.id, status: input.status })
      return
    }
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
    const input = cleanupSchema.parse(req.body ?? {})
    if (!(await isSquareConfigured())) {
      const result = await cleanupLocalSquare(input)
      await writeAudit(req, 'square.cleanup', 'square', {
        ...input,
        result,
      })
      sendOk(res, result)
      return
    }
    const data = await callSquare('/api/v1/admin/cleanup', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    await writeAudit(req, 'square.cleanup', 'square', input)
    sendOk(res, data)
  } catch (error) {
    next(error)
  }
})

export default router
