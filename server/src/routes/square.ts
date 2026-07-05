import crypto from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../prisma.js'
import { HttpError } from '../http.js'
import { resLocals } from '../auth.js'
import { getSquareRuntimeConfig } from '../squareConfig.js'

const router = Router()
const SQUARE_UPLOAD_FILE_SIZE_LIMIT_BYTES = 50 * 1024 * 1024
const SQUARE_UPLOAD_FILE_COUNT_LIMIT = 48

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: SQUARE_UPLOAD_FILE_SIZE_LIMIT_BYTES,
    files: SQUARE_UPLOAD_FILE_COUNT_LIMIT,
  },
})

type ShareKind = 'image' | 'task' | 'prompt'
type AssetRole = 'output' | 'origin_input'

interface ManifestAsset {
  clientAssetId: string
  role: AssetRole
  localImageId?: string
  mimeType: string
  width?: number | null
  height?: number | null
  byteSize: number
  standaloneShareAllowed?: boolean
}

interface ShareManifest {
  kind: ShareKind
  clientRequestId: string
  title: string
  prompt: string
  tags?: string[]
  assets?: ManifestAsset[]
  taskShare?: {
    lineage?: unknown[]
  }
}

interface UploadedFileMap {
  original?: Express.Multer.File
  thumb?: Express.Multer.File
}

function jsonOk<T>(res: import('express').Response, data: T, status = 200) {
  res.status(status).json({ ok: true, data })
}

function readBearerToken(header: string | undefined): string {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '')
  if (!match) throw new HttpError(401, 'unauthorized', '缺少广场身份令牌')
  return match[1].trim()
}

function requireShareKind(value: unknown): ShareKind {
  if (value === 'image' || value === 'task' || value === 'prompt') return value
  throw new HttpError(400, 'validation_failed', '分享类型不合法')
}

function readString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new HttpError(400, 'validation_failed', `${field} 必须是字符串`)
  const normalized = value.trim()
  if (!normalized) throw new HttpError(400, 'validation_failed', `${field} 不能为空`)
  return normalized.slice(0, maxLength)
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))).slice(0, 8)
}

function normalizeManifestAsset(value: unknown): ManifestAsset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'validation_failed', '图片资产格式无效')
  }
  const record = value as Record<string, unknown>
  const role = record.role === 'output' || record.role === 'origin_input' ? record.role : null
  if (!role) throw new HttpError(400, 'validation_failed', '图片资产 role 不合法')
  const byteSize = typeof record.byteSize === 'number' && Number.isFinite(record.byteSize) ? record.byteSize : 0
  if (byteSize <= 0) throw new HttpError(400, 'validation_failed', '图片资产 byteSize 无效')
  return {
    clientAssetId: readString(record.clientAssetId, 'clientAssetId', 120),
    role,
    localImageId: typeof record.localImageId === 'string' ? record.localImageId : undefined,
    mimeType: readString(record.mimeType, 'mimeType', 64).toLowerCase(),
    width: typeof record.width === 'number' ? record.width : null,
    height: typeof record.height === 'number' ? record.height : null,
    byteSize,
    standaloneShareAllowed: typeof record.standaloneShareAllowed === 'boolean' ? record.standaloneShareAllowed : undefined,
  }
}

function parseManifest(raw: unknown): ShareManifest {
  if (typeof raw !== 'string') throw new HttpError(400, 'validation_failed', '缺少 manifest')
  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HttpError(400, 'validation_failed', 'manifest 格式无效')
  }
  const record = parsed as Record<string, unknown>
  const assets = Array.isArray(record.assets) ? record.assets.map(normalizeManifestAsset) : []
  const manifest: ShareManifest = {
    ...record,
    kind: requireShareKind(record.kind),
    clientRequestId: readString(record.clientRequestId, 'clientRequestId', 160),
    title: readString(record.title, 'title', 80),
    prompt: readString(record.prompt, 'prompt', 8000),
    tags: normalizeTags(record.tags),
    assets,
  }
  if (manifest.kind !== 'prompt' && !assets.some((asset) => asset.role === 'output')) {
    throw new HttpError(400, 'validation_failed', '图片分享至少需要一张输出图')
  }
  return manifest
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

function buildPublicAssetUrl(publicBaseUrl: string, key: string): string {
  if (/^https?:\/\//i.test(key)) return key
  if (!publicBaseUrl) return `/api/v1/assets/by-key/${encodeURIComponent(key)}`
  return `${publicBaseUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function buildAssetUrl(asset: { id: string; r2Key: string; thumbR2Key: string | null }, variant: 'thumb' | 'original', publicBaseUrl: string): string {
  const key = variant === 'thumb' ? asset.thumbR2Key ?? asset.r2Key : asset.r2Key
  return buildPublicAssetUrl(publicBaseUrl, key)
}

function mapAsset(asset: {
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
    r2Key: asset.r2Key,
    thumbUrl: buildAssetUrl(asset, 'thumb', publicBaseUrl),
    originalUrl: buildAssetUrl(asset, 'original', publicBaseUrl),
    width: asset.width,
    height: asset.height,
  }
}

async function getPublisherByToken(token: string) {
  const publisher = await prisma.squarePublisher.findUnique({ where: { token } })
  if (!publisher || publisher.status !== 'active') {
    throw new HttpError(401, 'unauthorized', '广场身份令牌无效')
  }
  return publisher
}

function groupUploadFiles(files: Express.Multer.File[]): Map<string, UploadedFileMap> {
  const result = new Map<string, UploadedFileMap>()
  for (const file of files) {
    const match = /^asset:(.+):(original|thumb)$/.exec(file.fieldname)
    if (!match) continue
    const clientAssetId = match[1]
    const variant = match[2] as 'original' | 'thumb'
    const group = result.get(clientAssetId) ?? {}
    group[variant] = file
    result.set(clientAssetId, group)
  }
  return result
}

async function uploadShareAssets(input: {
  shareId: string
  manifestAssets: ManifestAsset[]
  files: Express.Multer.File[]
}) {
  const config = await getSquareRuntimeConfig()
  if (!config.r2Enabled || !config.r2Endpoint || !config.r2AccessKey || !config.r2SecretKey || !config.r2Bucket) {
    throw new HttpError(400, 'r2_not_configured', '尚未配置 R2 存储，无法发布广场内容')
  }

  const client = createR2Client(config)
  const fileMap = groupUploadFiles(input.files)
  const rows = []
  for (const asset of input.manifestAssets) {
    const files = fileMap.get(asset.clientAssetId)
    if (!files?.original || !files.thumb) {
      throw new HttpError(400, 'validation_failed', `缺少图片文件 ${asset.clientAssetId}`)
    }
    const assetId = crypto.randomUUID()
    const ext = asset.mimeType.includes('jpeg') || asset.mimeType.includes('jpg') ? 'jpg' : asset.mimeType.includes('webp') ? 'webp' : 'png'
    const r2Key = `shares/${input.shareId}/assets/${assetId}/original.${ext}`
    const thumbR2Key = `shares/${input.shareId}/assets/${assetId}/thumb.webp`
    await client.send(new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: r2Key,
      Body: files.original.buffer,
      ContentType: files.original.mimetype || asset.mimeType,
    }))
    await client.send(new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: thumbR2Key,
      Body: files.thumb.buffer,
      ContentType: files.thumb.mimetype || 'image/webp',
    }))
    rows.push({
      id: assetId,
      clientAssetId: asset.clientAssetId,
      role: asset.role,
      r2Key,
      thumbR2Key,
      mimeType: files.original.mimetype || asset.mimeType,
      byteSize: files.original.size,
      thumbByteSize: files.thumb.size,
      width: asset.width ?? null,
      height: asset.height ?? null,
    })
  }
  return rows
}

function getCursorDate(cursor: unknown): Date | undefined {
  if (typeof cursor !== 'string' || !cursor) return undefined
  const date = new Date(cursor)
  return Number.isNaN(date.getTime()) ? undefined : date
}

async function getPublicBaseUrl() {
  return (await getSquareRuntimeConfig()).publicBaseUrl
}

router.post('/identity', async (req, res, next) => {
  try {
    const user = resLocals(req).user
    const existing = await prisma.squarePublisher.findFirst({
      where: user ? { userId: user.id } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      jsonOk(res, { publisherId: existing.id, token: existing.token })
      return
    }
    const token = crypto.randomBytes(32).toString('base64url')
    const publisher = await prisma.squarePublisher.create({
      data: {
        userId: user?.id ?? null,
        token,
      },
    })
    jsonOk(res, { publisherId: publisher.id, token })
  } catch (error) {
    next(error)
  }
})

router.get('/square', async (req, res, next) => {
  try {
    const kind = req.query.kind ? requireShareKind(req.query.kind) : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 60))
    const cursorDate = getCursorDate(req.query.cursor)
    const publicBaseUrl = await getPublicBaseUrl()
    const items = await prisma.squareShare.findMany({
      where: {
        status: 'published',
        ...(kind ? { kind } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { prompt: { contains: q, mode: 'insensitive' } }] } : {}),
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      include: { assets: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
    const pageItems = items.slice(0, limit)
    jsonOk(res, {
      items: pageItems.map((share) => ({
        id: share.id,
        kind: share.kind,
        title: share.title,
        prompt: share.prompt,
        tags: Array.isArray(share.tags) ? share.tags : [],
        status: share.status,
        createdAt: share.createdAt.getTime(),
        viewCount: share.viewCount,
        coverAsset: share.assets[0] ? mapAsset(share.assets[0], publicBaseUrl) : null,
      })),
      nextCursor: items.length > limit ? pageItems.at(-1)?.createdAt.toISOString() ?? null : null,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/me/shares', async (req, res, next) => {
  try {
    const publisher = await getPublisherByToken(readBearerToken(req.headers.authorization))
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 60))
    const cursorDate = getCursorDate(req.query.cursor)
    const publicBaseUrl = await getPublicBaseUrl()
    const items = await prisma.squareShare.findMany({
      where: {
        publisherId: publisher.id,
        status: { not: 'deleted' },
        ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { prompt: { contains: q, mode: 'insensitive' } }] } : {}),
        ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
      },
      include: { assets: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
    const pageItems = items.slice(0, limit)
    jsonOk(res, {
      items: pageItems.map((share) => ({
        id: share.id,
        kind: share.kind,
        title: share.title,
        prompt: share.prompt,
        tags: Array.isArray(share.tags) ? share.tags : [],
        status: share.status,
        createdAt: share.createdAt.getTime(),
        viewCount: share.viewCount,
        coverAsset: share.assets[0] ? mapAsset(share.assets[0], publicBaseUrl) : null,
      })),
      nextCursor: items.length > limit ? pageItems.at(-1)?.createdAt.toISOString() ?? null : null,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/shares', upload.any(), async (req, res, next) => {
  try {
    const publisher = await getPublisherByToken(readBearerToken(req.headers.authorization))
    const manifest = parseManifest(req.body.manifest)
    const existing = await prisma.squareShare.findUnique({
      where: { publisherId_clientRequestId: { publisherId: publisher.id, clientRequestId: manifest.clientRequestId } },
      include: { assets: { orderBy: { createdAt: 'asc' } } },
    })
    const publicBaseUrl = await getPublicBaseUrl()
    if (existing) {
      jsonOk(res, {
        id: existing.id,
        assets: existing.assets.map((asset) => mapAsset(asset, publicBaseUrl)),
      }, 201)
      return
    }

    const shareId = crypto.randomUUID()
    const assetRows = await uploadShareAssets({
      shareId,
      manifestAssets: manifest.assets ?? [],
      files: Array.isArray(req.files) ? req.files : [],
    })
    await prisma.squareShare.create({
      data: {
        id: shareId,
        publisherId: publisher.id,
        userId: publisher.userId,
        kind: manifest.kind,
        title: manifest.title,
        prompt: manifest.prompt,
        manifestJson: manifest as unknown as object,
        coverAssetId: assetRows.find((asset) => asset.role === 'output')?.id ?? assetRows[0]?.id ?? null,
        tags: manifest.tags ?? [],
        status: 'published',
        clientRequestId: manifest.clientRequestId,
        assets: { create: assetRows },
      },
    })
    jsonOk(res, {
      id: shareId,
      assets: assetRows.map((asset) => mapAsset(asset, publicBaseUrl)),
    }, 201)
  } catch (error) {
    next(error)
  }
})

router.get('/shares/:id', async (req, res, next) => {
  try {
    const publicBaseUrl = await getPublicBaseUrl()
    const share = await prisma.squareShare.update({
      where: { id: req.params.id },
      data: { viewCount: { increment: 1 } },
      include: { assets: { orderBy: { createdAt: 'asc' } } },
    }).catch(() => null)
    if (!share || share.status !== 'published') throw new HttpError(404, 'not_found', '分享不存在')
    const assets = share.assets.map((asset) => mapAsset(asset, publicBaseUrl))
    jsonOk(res, {
      id: share.id,
      kind: share.kind,
      title: share.title,
      prompt: share.prompt,
      tags: Array.isArray(share.tags) ? share.tags : [],
      status: share.status,
      createdAt: share.createdAt.getTime(),
      viewCount: share.viewCount + 1,
      coverAsset: assets.find((asset) => asset.assetId === share.coverAssetId) ?? assets[0] ?? null,
      assets,
      manifest: share.manifestJson,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/shares/:id/delete', async (req, res, next) => {
  try {
    const publisher = await getPublisherByToken(readBearerToken(req.headers.authorization))
    const share = await prisma.squareShare.findUnique({ where: { id: req.params.id } })
    if (!share || share.publisherId !== publisher.id) throw new HttpError(404, 'not_found', '分享不存在')
    await prisma.squareShare.update({ where: { id: share.id }, data: { status: 'deleted' } })
    jsonOk(res, {})
  } catch (error) {
    next(error)
  }
})

router.post('/shares/:id/report', async (req, res, next) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : ''
    if (!reason) throw new HttpError(400, 'validation_failed', '请选择举报原因')
    await prisma.squareReport.create({
      data: {
        shareId: req.params.id,
        userId: resLocals(req).user?.id ?? null,
        reason,
      },
    })
    await prisma.squareShare.update({ where: { id: req.params.id }, data: { reportCount: { increment: 1 } } }).catch(() => undefined)
    jsonOk(res, {})
  } catch (error) {
    next(error)
  }
})

export default router
