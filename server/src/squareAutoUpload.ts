import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import type { Metadata } from 'sharp'
import { prisma } from './prisma.js'
import { getSquareRuntimeConfig, type SquareRuntimeConfig } from './squareConfig.js'

interface GeneratedSquareImage {
  dataUrl: string
  index?: number
  mimeType: string
}

interface AutoUploadInput {
  userId: string
  taskId: string
  prompt: string
  params: unknown
  images: GeneratedSquareImage[]
}

interface SquareIdentity {
  publisherId: string
  token: string
}

interface AutoUploadManifestAsset {
  clientAssetId: string
  role: 'output'
  localImageId: string
  mimeType: string
  width: number | null
  height: number | null
  byteSize: number
  standaloneShareAllowed: boolean
}

interface SquareUploadedAssetResponse {
  clientAssetId: string
  role: 'output' | 'origin_input'
  r2Key?: string
  originalUrl: string
  thumbUrl?: string
  width?: number | null
  height?: number | null
}

export interface SquareAutoUploadResult {
  mode: 'square' | 'r2'
  shareId?: string
  assetUrls?: string[]
  assets?: UploadedGeneratedAsset[]
}

export interface UploadedGeneratedAsset {
  imageIndex: number
  r2Key?: string | null
  publicUrl: string
  mimeType: string
  byteSize: number
  width?: number | null
  height?: number | null
}

type SquareEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error?: { message?: string } }

const MAX_TITLE_LENGTH = 80
const THUMBNAIL_MAX_BYTES = 512 * 1024

function buildSquareUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

function buildPublicAssetUrl(config: SquareRuntimeConfig, key: string): string {
  if (!config.publicBaseUrl) return key
  return `${config.publicBaseUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
}

function normalizeTitle(prompt: string): string {
  return prompt.trim().slice(0, MAX_TITLE_LENGTH) || '自动同步的生成图片'
}

function mimeToExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
  if (normalized.includes('avif')) return 'avif'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  return 'png'
}

function toBlobPart(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

async function readSquareEnvelope<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as SquareEnvelope<T> | null
  if (!payload || payload.ok !== true) {
    const message = payload && 'error' in payload ? payload.error?.message : ''
    throw new Error(message || `广场接口请求失败：HTTP ${response.status}`)
  }
  return payload.data
}

async function ensureSquareIdentity(userId: string, squareApiUrl: string): Promise<SquareIdentity> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { squarePublisherId: true, squarePublisherToken: true },
  })
  if (user?.squarePublisherId && user.squarePublisherToken) {
    return {
      publisherId: user.squarePublisherId,
      token: user.squarePublisherToken,
    }
  }

  const response = await fetch(buildSquareUrl(squareApiUrl, '/api/v1/identity'), {
    method: 'POST',
  })
  const identity = await readSquareEnvelope<SquareIdentity>(response)
  await prisma.user.update({
    where: { id: userId },
    data: {
      squarePublisherId: identity.publisherId,
      squarePublisherToken: identity.token,
    },
  })
  return identity
}

async function imageToBuffer(image: GeneratedSquareImage): Promise<{ buffer: Buffer; mimeType: string }> {
  if (/^data:/i.test(image.dataUrl)) {
    const response = await fetch(image.dataUrl)
    const arrayBuffer = await response.arrayBuffer()
    const dataUrlMime = image.dataUrl.match(/^data:([^;,]+)/i)?.[1]
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = normalizeDownloadedMimeType(image.mimeType || dataUrlMime || response.headers.get('content-type'), buffer)
    return { buffer, mimeType }
  }

  const response = await fetch(image.dataUrl)
  if (!response.ok) {
    throw new Error(`下载生成图片失败：HTTP ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return {
    buffer,
    mimeType: normalizeDownloadedMimeType(image.mimeType || response.headers.get('content-type'), buffer),
  }
}

function normalizeDownloadedMimeType(rawMimeType: string | null | undefined, buffer: Buffer): string {
  const normalized = rawMimeType?.split(';')[0]?.trim().toLowerCase() || ''
  const sniffed = sniffImageMimeType(buffer)
  if (sniffed) return sniffed
  if (normalized.startsWith('image/')) return normalized

  const preview = buffer.subarray(0, 80).toString('utf8').replace(/\s+/g, ' ').trim()
  throw new Error(`生成图片源不是可识别图片，content-type=${normalized || 'unknown'}${preview ? `，内容开头=${preview}` : ''}`)
}

function sniffImageMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString('ascii')
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif'
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii')
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }
  return null
}

async function readImageMetadata(buffer: Buffer): Promise<Metadata> {
  try {
    return await sharp(buffer).metadata()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`生成图片格式无法解析，无法同步到云端：${message}`)
  }
}

async function createThumbnail(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const thumbnail = await sharp(buffer)
    .rotate()
    .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 76 })
    .toBuffer()

  if (thumbnail.byteLength <= THUMBNAIL_MAX_BYTES) {
    return { buffer: thumbnail, mimeType: 'image/webp' }
  }

  const smaller = await sharp(buffer)
    .rotate()
    .resize({ width: 384, height: 384, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 62 })
    .toBuffer()
  return { buffer: smaller, mimeType: 'image/webp' }
}

function createR2Client(config: SquareRuntimeConfig): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: config.r2Endpoint,
    credentials: {
      accessKeyId: config.r2AccessKey,
      secretAccessKey: config.r2SecretKey,
    },
  })
}

async function uploadDirectlyToR2(
  config: SquareRuntimeConfig,
  input: AutoUploadInput,
): Promise<SquareAutoUploadResult | null> {
  if (!config.r2Enabled || !config.r2Endpoint || !config.r2AccessKey || !config.r2SecretKey || !config.r2Bucket) {
    return null
  }

  const client = createR2Client(config)
  const assetUrls: string[] = []
  const assets: UploadedGeneratedAsset[] = []
  for (const [index, image] of input.images.entries()) {
    const sourceIndex = typeof image.index === 'number' ? image.index : index
    const original = await imageToBuffer(image)
    const metadata = await readImageMetadata(original.buffer)
    const ext = mimeToExtension(original.mimeType)
    const key = `generated/${input.taskId}/${sourceIndex}.${ext}`
    await client.send(new PutObjectCommand({
      Bucket: config.r2Bucket,
      Key: key,
      Body: original.buffer,
      ContentType: original.mimeType,
      Metadata: {
        taskId: input.taskId,
        imageIndex: String(sourceIndex),
        source: 'gpt-image-playground-server',
      },
    }))
    const publicUrl = buildPublicAssetUrl(config, key)
    assetUrls.push(publicUrl)
    assets.push({
      imageIndex: sourceIndex,
      r2Key: key,
      publicUrl,
      mimeType: original.mimeType,
      byteSize: original.buffer.byteLength,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    })
  }

  return {
    mode: 'r2',
    assetUrls,
    assets,
  }
}

async function uploadToSquareWorker(
  config: SquareRuntimeConfig,
  input: AutoUploadInput,
): Promise<SquareAutoUploadResult | null> {
  if (!config.squareApiUrl) return null
  const identity = await ensureSquareIdentity(input.userId, config.squareApiUrl)
  const form = new FormData()
  const manifestAssets: AutoUploadManifestAsset[] = []
  const outputAssetIds: string[] = []
  const originalAssetMeta = new Map<string, Omit<UploadedGeneratedAsset, 'publicUrl' | 'r2Key'>>()

  for (const [index, image] of input.images.entries()) {
    const sourceIndex = typeof image.index === 'number' ? image.index : index
    const original = await imageToBuffer(image)
    const metadata = await readImageMetadata(original.buffer)
    const thumbnail = await createThumbnail(original.buffer)
    const clientAssetId = `asset_output_${sourceIndex}_${input.taskId.slice(0, 24)}`
    outputAssetIds.push(clientAssetId)
    manifestAssets.push({
      clientAssetId,
      role: 'output',
      localImageId: `${input.taskId}:${sourceIndex}`,
      mimeType: original.mimeType,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      byteSize: original.buffer.byteLength,
      standaloneShareAllowed: true,
    })
    originalAssetMeta.set(clientAssetId, {
      imageIndex: sourceIndex,
      mimeType: original.mimeType,
      byteSize: original.buffer.byteLength,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
    })
    form.append(
      `asset:${clientAssetId}:original`,
      new File([toBlobPart(original.buffer)], `${clientAssetId}.${mimeToExtension(original.mimeType)}`, { type: original.mimeType }),
    )
    form.append(
      `asset:${clientAssetId}:thumb`,
      new File([toBlobPart(thumbnail.buffer)], `${clientAssetId}.webp`, { type: thumbnail.mimeType }),
    )
  }

  form.append('manifest', JSON.stringify({
    kind: 'task',
    clientRequestId: `server_task_${input.taskId}`,
    title: normalizeTitle(input.prompt),
    prompt: input.prompt,
    tags: ['自动同步'],
    source: {
      app: 'gpt-image-playground-server',
      schemaVersion: 1,
    },
    taskShare: {
      entryTaskId: input.taskId,
      entryOutputImageIds: outputAssetIds,
      lineage: [{
        localTaskId: input.taskId,
        taskKind: 'generation',
        status: 'done',
        isAborted: false,
        parentTaskId: null,
        parentImageId: null,
        prompt: input.prompt,
        params: input.params,
        responseMeta: null,
        providerName: null,
        categoryName: null,
        createdAt: Date.now(),
        finishedAt: Date.now(),
        elapsed: null,
        inputAssetRefs: [],
        outputAssetRefs: outputAssetIds,
      }],
      originAssets: [],
    },
    assets: manifestAssets,
  }))

  const response = await fetch(buildSquareUrl(config.squareApiUrl, '/api/v1/shares'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${identity.token}`,
    },
    body: form,
  })
  const result = await readSquareEnvelope<{ id: string; assets?: SquareUploadedAssetResponse[] }>(response)
  const assetUrls = outputAssetIds
    .map((clientAssetId) => result.assets?.find((asset) => asset.clientAssetId === clientAssetId && asset.role === 'output')?.originalUrl)
    .filter((url): url is string => typeof url === 'string' && Boolean(url.trim()))
  const assets = outputAssetIds
    .map((clientAssetId): UploadedGeneratedAsset | null => {
      const uploaded = result.assets?.find((asset) => asset.clientAssetId === clientAssetId && asset.role === 'output')
      const meta = originalAssetMeta.get(clientAssetId)
      if (!uploaded?.originalUrl || !meta) return null
      return {
        ...meta,
        r2Key: uploaded.r2Key ?? null,
        publicUrl: uploaded.originalUrl,
        width: uploaded.width ?? meta.width ?? null,
        height: uploaded.height ?? meta.height ?? null,
      }
    })
    .filter((asset): asset is UploadedGeneratedAsset => asset !== null)
  return {
    mode: 'square',
    shareId: result.id,
    assetUrls: assetUrls.length > 0 ? assetUrls : undefined,
    assets: assets.length > 0 ? assets : undefined,
  }
}

export async function autoUploadGeneratedImagesToSquare(input: AutoUploadInput): Promise<SquareAutoUploadResult | null> {
  const config = await getSquareRuntimeConfig()
  if (!config.autoUploadGeneratedImages || input.images.length === 0) {
    return null
  }

  const squareResult = await uploadToSquareWorker(config, input)
  if (squareResult) return squareResult
  return uploadDirectlyToR2(config, input)
}
