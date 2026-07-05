import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './prisma.js'
import { getSquareRuntimeConfig, type SquareRuntimeConfig } from './squareConfig.js'

const DEMO_PUBLISHER_ID = 'demo-square-r2-ai-gallery-publisher'
const DEMO_PUBLISHER_TOKEN = 'demo-square-r2-ai-gallery-token'
const DEMO_SHARE_PREFIX = 'r2-ai-square-v1'
const SOURCE_DIR_ENV = 'SQUARE_R2_DEMO_SOURCE_DIR'
const MIN_IMAGE_COUNT = 50

interface DemoImageManifestItem {
  fileName: string
  title: string
  sourceTitle: string
  sourceUrl: string
  category: string
  mimeType: string
  width: number | null
  height: number | null
}

function resolveProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return path.resolve(path.dirname(currentFile), '..', '..')
}

function resolveSourceDir(): string {
  return process.env[SOURCE_DIR_ENV] || path.join(resolveProjectRoot(), 'server', 'tmp', 'square-r2-demo')
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

function assertR2Configured(config: SquareRuntimeConfig): void {
  if (!config.r2Enabled) throw new Error('R2 未启用，请先在后台广场配置中开启 R2')
  if (!config.r2Endpoint) throw new Error('缺少 R2 Endpoint')
  if (!config.r2AccessKey) throw new Error('缺少 R2 Access Key')
  if (!config.r2SecretKey) throw new Error('缺少 R2 Secret Key')
  if (!config.r2Bucket) throw new Error('缺少 R2 Bucket')
  if (!config.publicBaseUrl) throw new Error('缺少 R2 公网访问域名 publicBaseUrl')
}

function isManifestItem(value: unknown): value is DemoImageManifestItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.fileName === 'string' &&
    typeof record.title === 'string' &&
    typeof record.sourceTitle === 'string' &&
    typeof record.sourceUrl === 'string' &&
    typeof record.category === 'string' &&
    typeof record.mimeType === 'string' &&
    (typeof record.width === 'number' || record.width === null) &&
    (typeof record.height === 'number' || record.height === null)
  )
}

async function readManifest(sourceDir: string): Promise<DemoImageManifestItem[]> {
  const raw = await readFile(path.join(sourceDir, 'manifest.json'), 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error('manifest.json 必须是数组')
  }
  const items = parsed.filter(isManifestItem)
  if (items.length < MIN_IMAGE_COUNT) {
    throw new Error(`R2 演示图片不足 ${MIN_IMAGE_COUNT} 张，当前 ${items.length} 张`)
  }
  return items
}

function getExtension(fileName: string, mimeType: string): string {
  const fileExt = path.extname(fileName).replace('.', '').toLowerCase()
  if (fileExt) return fileExt
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  return 'jpg'
}

function normalizeTitle(title: string, index: number): string {
  const cleaned = title
    .replace(/^File:/i, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return `AI 作品 ${String(index + 1).padStart(2, '0')}`
  return cleaned.length > 36 ? `${cleaned.slice(0, 36)}...` : cleaned
}

async function uploadObject(input: {
  client: S3Client
  config: SquareRuntimeConfig
  key: string
  body: Buffer
  contentType: string
  sourceUrl: string
}): Promise<void> {
  await input.client.send(new PutObjectCommand({
    Bucket: input.config.r2Bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      source: 'wikimedia-commons-ai-demo',
      sourceUrl: input.sourceUrl.slice(0, 1024),
    },
  }))
}

async function hidePreviousDemoShares(): Promise<void> {
  await prisma.squareShare.updateMany({
    where: {
      OR: [
        { id: { startsWith: 'demo-ai-square-v1-share-' } },
        { id: { startsWith: 'commons-ai-square-v1-share-' } },
        { id: { startsWith: `${DEMO_SHARE_PREFIX}-share-` } },
      ],
    },
    data: { status: 'hidden' },
  })
}

async function seedSquareR2Demo(): Promise<void> {
  const sourceDir = resolveSourceDir()
  const items = await readManifest(sourceDir)
  const config = await getSquareRuntimeConfig()
  assertR2Configured(config)
  const client = createR2Client(config)

  await prisma.squarePublisher.upsert({
    where: { id: DEMO_PUBLISHER_ID },
    update: { token: DEMO_PUBLISHER_TOKEN, status: 'active' },
    create: {
      id: DEMO_PUBLISHER_ID,
      token: DEMO_PUBLISHER_TOKEN,
      status: 'active',
    },
  })
  await hidePreviousDemoShares()

  for (const [index, item] of items.entries()) {
    const serial = String(index + 1).padStart(2, '0')
    const shareId = `${DEMO_SHARE_PREFIX}-share-${serial}`
    const assetId = `${DEMO_SHARE_PREFIX}-asset-${serial}`
    const clientRequestId = `${DEMO_SHARE_PREFIX}-${serial}`
    const clientAssetId = `${clientRequestId}-output`
    const title = normalizeTitle(item.title, index)
    const prompt = `公开 AI 生成图片演示素材。来源：Wikimedia Commons「${item.category}」，原始文件：${item.sourceTitle}`
    const tags = ['AI生成', 'R2素材', item.category.replace('AI-generated ', '')]
    const extension = getExtension(item.fileName, item.mimeType)
    const body = await readFile(path.join(sourceDir, item.fileName))
    const r2Key = `demo-square/r2-gallery/${serial}/original.${extension}`
    const thumbR2Key = `demo-square/r2-gallery/${serial}/thumb.${extension}`
    const createdAt = new Date(Date.now() - index * 30_000)
    const manifest = {
      kind: 'task',
      clientRequestId,
      title,
      prompt,
      tags,
      demoSource: 'Wikimedia Commons',
      sourceUrl: item.sourceUrl,
      assets: [
        {
          clientAssetId,
          role: 'output',
          mimeType: item.mimeType,
          width: item.width,
          height: item.height,
          byteSize: body.byteLength,
          standaloneShareAllowed: true,
        },
      ],
    }

    await uploadObject({
      client,
      config,
      key: r2Key,
      body,
      contentType: item.mimeType,
      sourceUrl: item.sourceUrl,
    })
    await uploadObject({
      client,
      config,
      key: thumbR2Key,
      body,
      contentType: item.mimeType,
      sourceUrl: item.sourceUrl,
    })

    await prisma.squareShare.upsert({
      where: {
        publisherId_clientRequestId: {
          publisherId: DEMO_PUBLISHER_ID,
          clientRequestId,
        },
      },
      update: {
        id: shareId,
        kind: 'task',
        title,
        prompt,
        manifestJson: manifest,
        coverAssetId: assetId,
        tags,
        status: 'published',
        createdAt,
        updatedAt: createdAt,
      },
      create: {
        id: shareId,
        publisherId: DEMO_PUBLISHER_ID,
        kind: 'task',
        title,
        prompt,
        manifestJson: manifest,
        coverAssetId: assetId,
        tags,
        status: 'published',
        clientRequestId,
        createdAt,
        updatedAt: createdAt,
      },
    })

    await prisma.squareShareAsset.deleteMany({ where: { shareId } })
    await prisma.squareShareAsset.create({
      data: {
        id: assetId,
        shareId,
        clientAssetId,
        role: 'output',
        r2Key,
        thumbR2Key,
        mimeType: item.mimeType,
        byteSize: body.byteLength,
        thumbByteSize: body.byteLength,
        width: item.width,
        height: item.height,
      },
    })
  }

  console.log(`[seed:square-r2] uploaded and published ${items.length} demo images to R2`)
}

seedSquareR2Demo()
  .finally(async () => {
    await prisma.$disconnect()
  })
