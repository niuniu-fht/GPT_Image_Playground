import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './prisma.js'

const DEMO_PUBLISHER_ID = 'demo-square-commons-ai-gallery-publisher'
const DEMO_PUBLISHER_TOKEN = 'demo-square-commons-ai-gallery-token'
const DEMO_SHARE_PREFIX = 'commons-ai-square-v1'
const LOCAL_DEMO_BASE_URL = process.env.SQUARE_DEMO_PUBLIC_BASE_URL || 'http://127.0.0.1:8080/demo-square'
const TARGET_IMAGE_COUNT = 60
const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php'
const COMMONS_CATEGORIES = [
  'AI-generated photographs',
  'AI-generated images of humans',
  'AI-generated landscapes',
  'AI-generated images of objects',
  'AI-generated images',
]
const MAX_FETCH_ATTEMPTS = 4
const FETCH_RETRY_BASE_MS = 1500

interface CommonsImageInfo {
  thumburl?: string
  url?: string
  mime?: string
  width?: number
  height?: number
  size?: number
}

interface CommonsPage {
  title: string
  imageinfo?: CommonsImageInfo[]
}

interface CommonsQueryResponse {
  query?: {
    pages?: Record<string, CommonsPage>
  }
}

interface CommonsCandidate {
  sourceTitle: string
  sourceUrl: string
  mimeType: string
  width: number | null
  height: number | null
  sourceCategory: string
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function resolveProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url)
  return path.resolve(path.dirname(currentFile), '..', '..')
}

async function fetchWithRetry(url: string, label: string): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GPT-Image-Playground-DemoSeeder/1.0',
        },
      })
      if (response.ok) return response
      lastError = new Error(`request failed ${response.status}: ${label}`)
    } catch (error) {
      lastError = error
    }

    if (attempt < MAX_FETCH_ATTEMPTS) {
      const delayMs = FETCH_RETRY_BASE_MS * attempt
      console.warn(`[seed:square-commons] retry ${attempt}/${MAX_FETCH_ATTEMPTS} for ${label} in ${delayMs}ms`)
      await delay(delayMs)
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`request failed: ${label}`)
}

function getCommonsUrl(category: string): string {
  const query = new URLSearchParams({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: `Category:${category}`,
    gcmlimit: '50',
    gcmtype: 'file',
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '900',
    format: 'json',
    origin: '*',
  })
  return `${COMMONS_API_URL}?${query.toString()}`
}

function getFileExtension(mimeType: string): string {
  if (mimeType.includes('png')) return 'png'
  if (mimeType.includes('webp')) return 'webp'
  return 'jpg'
}

function normalizeTitle(sourceTitle: string, index: number): string {
  const cleaned = sourceTitle
    .replace(/^File:/i, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return `AI 灵感作品 ${String(index + 1).padStart(2, '0')}`
  return cleaned.length > 28 ? `${cleaned.slice(0, 28)}...` : cleaned
}

function buildPrompt(candidate: CommonsCandidate): string {
  return `来自 Wikimedia Commons「${candidate.sourceCategory}」分类的公开 AI 生成图片，用于作品广场演示。原始文件：${candidate.sourceTitle}`
}

async function fetchCommonsCandidates(): Promise<CommonsCandidate[]> {
  const candidates: CommonsCandidate[] = []
  const seenUrls = new Set<string>()

  for (const category of COMMONS_CATEGORIES) {
    let response: Response
    try {
      response = await fetchWithRetry(getCommonsUrl(category), category)
    } catch (error) {
      console.warn(`[seed:square-commons] Commons category failed: ${category}`, error)
      continue
    }

    const payload = (await response.json()) as CommonsQueryResponse
    const pages = payload.query?.pages ? Object.values(payload.query.pages) : []
    for (const page of pages) {
      const info = page.imageinfo?.[0]
      const sourceUrl = info?.thumburl ?? info?.url
      if (!sourceUrl || seenUrls.has(sourceUrl)) continue
      const mimeType = info?.mime ?? 'image/jpeg'
      if (!mimeType.startsWith('image/')) continue
      seenUrls.add(sourceUrl)
      candidates.push({
        sourceTitle: page.title,
        sourceUrl,
        mimeType,
        width: info?.width ?? null,
        height: info?.height ?? null,
        sourceCategory: category,
      })
      if (candidates.length >= TARGET_IMAGE_COUNT) return candidates
    }
  }

  return candidates
}

async function downloadCandidate(candidate: CommonsCandidate, filePath: string): Promise<number> {
  const response = await fetchWithRetry(candidate.sourceUrl, candidate.sourceTitle)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.byteLength < 2048) {
    throw new Error(`downloaded Commons image too small: ${candidate.sourceUrl}`)
  }
  await writeFile(filePath, bytes)
  return bytes.byteLength
}

async function seedSquareCommonsDemoImages() {
  const outputDir = path.join(resolveProjectRoot(), 'public', 'demo-square')
  await mkdir(outputDir, { recursive: true })

  const candidates = await fetchCommonsCandidates()
  if (candidates.length < 50) {
    throw new Error(`Commons AI image candidates are not enough: ${candidates.length}`)
  }

  await prisma.squarePublisher.upsert({
    where: { id: DEMO_PUBLISHER_ID },
    update: { token: DEMO_PUBLISHER_TOKEN, status: 'active' },
    create: {
      id: DEMO_PUBLISHER_ID,
      token: DEMO_PUBLISHER_TOKEN,
      status: 'active',
    },
  })

  for (const [index, candidate] of candidates.entries()) {
    const serial = String(index + 1).padStart(2, '0')
    const shareId = `${DEMO_SHARE_PREFIX}-share-${serial}`
    const assetId = `${DEMO_SHARE_PREFIX}-asset-${serial}`
    const clientRequestId = `${DEMO_SHARE_PREFIX}-${serial}`
    const clientAssetId = `${clientRequestId}-output`
    const extension = getFileExtension(candidate.mimeType)
    const fileName = `commons-ai-demo-${serial}.${extension}`
    const localUrl = `${LOCAL_DEMO_BASE_URL.replace(/\/+$/, '')}/${fileName}`
    const byteSize = await downloadCandidate(candidate, path.join(outputDir, fileName))
    const title = normalizeTitle(candidate.sourceTitle, index)
    const prompt = buildPrompt(candidate)
    const createdAt = new Date(Date.now() - index * 30_000)
    const tags = ['AI生成', '公开素材', candidate.sourceCategory.replace('AI-generated ', '')]
    const manifest = {
      kind: 'task',
      clientRequestId,
      title,
      prompt,
      tags,
      demoSource: 'Wikimedia Commons',
      sourceUrl: candidate.sourceUrl,
      assets: [
        {
          clientAssetId,
          role: 'output',
          mimeType: candidate.mimeType,
          width: candidate.width,
          height: candidate.height,
          byteSize,
          standaloneShareAllowed: true,
        },
      ],
    }

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
        r2Key: localUrl,
        thumbR2Key: localUrl,
        mimeType: candidate.mimeType,
        byteSize,
        thumbByteSize: byteSize,
        width: candidate.width,
        height: candidate.height,
      },
    })
  }

  console.log(`[seed:square-commons] upserted ${candidates.length} Commons AI demo images`)
}

seedSquareCommonsDemoImages()
  .finally(async () => {
    await prisma.$disconnect()
  })
