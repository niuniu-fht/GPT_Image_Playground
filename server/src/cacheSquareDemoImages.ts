import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './prisma.js'

const DEMO_SHARE_PREFIX = 'demo-ai-square-v1'
const DEMO_ASSET_PREFIX = 'demo-ai-square-v1-asset-'
const LOCAL_DEMO_BASE_URL = process.env.SQUARE_DEMO_PUBLIC_BASE_URL || 'http://127.0.0.1:8080/demo-square'
const MAX_CONCURRENT_DOWNLOADS = 1
const MAX_DOWNLOAD_ATTEMPTS = 5
const DOWNLOAD_RETRY_BASE_MS = 2500

interface DemoAssetRow {
  id: string
  r2Key: string
}

function resolveProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return path.resolve(path.dirname(currentFile), '..', '..')
}

function resolveDemoFileName(assetId: string): string {
  const suffix = assetId.replace(DEMO_ASSET_PREFIX, '')
  return `ai-demo-${suffix}.jpg`
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function getRetryDelayMs(attempt: number): number {
  return DOWNLOAD_RETRY_BASE_MS * attempt * attempt
}

async function fetchImageWithRetry(asset: DemoAssetRow): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(asset.r2Key)
      if (response.ok) return response
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`download failed ${response.status} for ${asset.id}`)
      }
      lastError = new Error(`download failed ${response.status} for ${asset.id}`)
    } catch (error) {
      lastError = error
    }

    if (attempt < MAX_DOWNLOAD_ATTEMPTS) {
      const delayMs = getRetryDelayMs(attempt)
      console.warn(`[seed:square-demo] retry ${attempt}/${MAX_DOWNLOAD_ATTEMPTS} for ${asset.id} in ${delayMs}ms`)
      await delay(delayMs)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`download failed for ${asset.id}`)
}

async function downloadImage(asset: DemoAssetRow, outputDir: string): Promise<void> {
  if (!asset.r2Key.startsWith('https://image.pollinations.ai/')) {
    return
  }

  const fileName = resolveDemoFileName(asset.id)
  const localUrl = `${LOCAL_DEMO_BASE_URL.replace(/\/+$/, '')}/${fileName}`
  const response = await fetchImageWithRetry(asset)

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('image/')) {
    throw new Error(`unexpected content type ${contentType || 'unknown'} for ${asset.id}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength < 2048) {
    throw new Error(`downloaded image too small for ${asset.id}`)
  }

  await writeFile(path.join(outputDir, fileName), bytes)
  await prisma.squareShareAsset.update({
    where: { id: asset.id },
    data: {
      r2Key: localUrl,
      thumbR2Key: localUrl,
      byteSize: bytes.byteLength,
      thumbByteSize: bytes.byteLength,
    },
  })
  await delay(1200)
}

async function runLimited<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(MAX_CONCURRENT_DOWNLOADS, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item) {
        await worker(item)
      }
    }
  })
  await Promise.all(workers)
}

async function cacheSquareDemoImages() {
  const outputDir = path.join(resolveProjectRoot(), 'public', 'demo-square')
  await mkdir(outputDir, { recursive: true })

  const assets = await prisma.squareShareAsset.findMany({
    where: {
      id: { startsWith: DEMO_ASSET_PREFIX },
      share: { id: { startsWith: `${DEMO_SHARE_PREFIX}-share-` } },
    },
    select: { id: true, r2Key: true },
    orderBy: { id: 'asc' },
  })

  await runLimited(assets, (asset) => downloadImage(asset, outputDir))
  const cached = await prisma.squareShareAsset.count({
    where: {
      id: { startsWith: DEMO_ASSET_PREFIX },
      r2Key: { startsWith: LOCAL_DEMO_BASE_URL.replace(/\/+$/, '') },
    },
  })

  console.log(`[seed:square-demo] cached ${cached}/${assets.length} demo images to public/demo-square`)
}

cacheSquareDemoImages()
  .finally(async () => {
    await prisma.$disconnect()
  })
