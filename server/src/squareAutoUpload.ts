import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
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
  if (normalized.includes('webp')) return 'webp'
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
    const mimeType = image.mimeType || response.headers.get('content-type') || 'image/png'
    return { buffer: Buffer.from(arrayBuffer), mimeType }
  }

  const response = await fetch(image.dataUrl)
  if (!response.ok) {
    throw new Error(`下载生成图片失败：HTTP ${response.status}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: image.mimeType || response.headers.get('content-type') || 'image/png',
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
    const metadata = await sharp(original.buffer).metadata()
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
    const metadata = await sharp(original.buffer).metadata()
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
