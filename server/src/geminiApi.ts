import { HttpError } from './http.js'
import { resolveResolutionTier, type ResolutionTier } from './modelCost.js'

const GEMINI_INLINE_INPUT_LIMIT_BYTES = 20 * 1024 * 1024
const GEMINI_OUTPUT_LIMIT_BYTES = 50 * 1024 * 1024
const GEMINI_RATIOS = [
  '1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3',
  '4:5', '5:4', '8:1', '9:16', '16:9', '21:9',
] as const
const PLAYGROUND_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'] as const
const SIZE_MULTIPLE = 16
const MAX_EDGE = 3840
const MAX_PIXELS = 8_294_400

/** 记住哪些模型的上游不识别 imageConfig（需用旧版 responseFormat），进程内生效。 */
const preferredLegacyResponseFormatModels = new Set<string>()

// 上游内容审核拦截（NSFW 等）返回的 400：换 responseFormat 旧格式重试同样过不了审，
// 且备用格式会把 imageConfig 挪出 generationConfig —— 网关读不到就按 1K 档调度低档账号、
// 上游按默认 1:1 1K 出图（4K 16:9 被静默降级）。审核拦截应直接报错，不做备用格式重试。
const CONTENT_BLOCK_PATTERN = /内容审核|审核未通过|prohibited|IMAGE_SAFETY|safety|blocked|content.?policy|违规|敏感/i

function shouldRetryAlternateImageFormat(status: number, upstreamMessage: string): boolean {
  if (status !== 400 && status !== 422) return false
  return !CONTENT_BLOCK_PATTERN.test(upstreamMessage)
}

export interface GeminiInputImage {
  data: Buffer
  mimeType: string
}

export interface GeminiGeneratedImage {
  bytes: Buffer
  mimeType: string
}

export interface GeminiGenerateInput {
  apiKey: string
  baseUrl: string
  editMask?: GeminiInputImage | null
  inputImages: GeminiInputImage[]
  model: string
  prompt: string
  signal: AbortSignal
  size: string
}

export interface GeminiGenerateResult {
  images: GeminiGeneratedImage[]
  payload: unknown
  request: Record<string, unknown>
}

function normalizeGeminiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').replace(/\/v1beta$/i, '')
}

export function buildGeminiGenerateContentEndpoint(baseUrl: string, model: string): string {
  const normalizedModel = model.trim().replace(/^models\//i, '')
  return `${normalizeGeminiBaseUrl(baseUrl)}/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent`
}

export function buildGeminiModelsEndpoint(baseUrl: string): string {
  return `${normalizeGeminiBaseUrl(baseUrl)}/v1beta/models`
}

function parseSize(size: string): { width: number; height: number } | null {
  const match = size.match(/^\s*(\d+)\s*[xX×]\s*(\d+)\s*$/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  return width > 0 && height > 0 ? { width, height } : null
}

function nearestGeminiAspectRatio(size: string): string {
  const parsed = parseSize(size)
  if (!parsed) return '1:1'
  const target = parsed.width / parsed.height
  return GEMINI_RATIOS
    .map((label) => {
      const [width, height] = label.split(':').map(Number)
      return { label, distance: Math.abs(Math.log(target / (width / height))) }
    })
    .sort((left, right) => left.distance - right.distance)[0]?.label ?? '1:1'
}

function roundToMultiple(value: number): number {
  return Math.max(SIZE_MULTIPLE, Math.round(value / SIZE_MULTIPLE) * SIZE_MULTIPLE)
}

function floorToMultiple(value: number): number {
  return Math.max(SIZE_MULTIPLE, Math.floor(value / SIZE_MULTIPLE) * SIZE_MULTIPLE)
}

function normalizeCandidate(width: number, height: number): { width: number; height: number } {
  let normalizedWidth = roundToMultiple(width)
  let normalizedHeight = roundToMultiple(height)
  for (let index = 0; index < 3; index += 1) {
    const maxEdge = Math.max(normalizedWidth, normalizedHeight)
    if (maxEdge > MAX_EDGE) {
      const scale = MAX_EDGE / maxEdge
      normalizedWidth = floorToMultiple(normalizedWidth * scale)
      normalizedHeight = floorToMultiple(normalizedHeight * scale)
    }
    const pixels = normalizedWidth * normalizedHeight
    if (pixels > MAX_PIXELS) {
      const scale = Math.sqrt(MAX_PIXELS / pixels)
      normalizedWidth = floorToMultiple(normalizedWidth * scale)
      normalizedHeight = floorToMultiple(normalizedHeight * scale)
    }
  }
  return { width: normalizedWidth, height: normalizedHeight }
}

function playgroundTierSize(tier: ResolutionTier, ratio: string): { width: number; height: number } {
  const [ratioWidth, ratioHeight] = ratio.split(':').map(Number)
  // 与前端 src/lib/size.ts 的 2K 定义保持一致：统一长边 2048，
  // 面积低于 300w 下限的比例（16:9、9:16、3:2、2:3、21:9）按目标面积 310w 缩放
  if (tier === '2K') {
    const longSide = 2048
    const width = ratioWidth > ratioHeight
      ? longSide
      : roundToMultiple(longSide * ratioWidth / ratioHeight)
    const height = ratioWidth > ratioHeight
      ? roundToMultiple(longSide * ratioHeight / ratioWidth)
      : longSide
    if (width * height >= 3_000_000) {
      return { width, height }
    }
    const scale = Math.sqrt((3_100_000 * ratioWidth) / ratioHeight)
    return normalizeCandidate(roundToMultiple(scale), roundToMultiple(3_100_000 / scale))
  }
  if (ratioWidth === ratioHeight) {
    const side = tier === '1K' ? 1024 : 3840
    return { width: side, height: side }
  }
  if (tier === '1K') {
    const shortSide = 1024
    return ratioWidth > ratioHeight
      ? { width: roundToMultiple(shortSide * ratioWidth / ratioHeight), height: shortSide }
      : { width: shortSide, height: roundToMultiple(shortSide * ratioHeight / ratioWidth) }
  }
  const longSide = 3840
  return normalizeCandidate(
    ratioWidth > ratioHeight ? longSide : longSide * ratioWidth / ratioHeight,
    ratioWidth > ratioHeight ? longSide * ratioHeight / ratioWidth : longSide,
  )
}

function resolvePlaygroundResolutionTier(size: string): ResolutionTier {
  const parsed = parseSize(size)
  if (!parsed) return '1K'
  for (const tier of ['1K', '2K', '4K'] as const) {
    for (const ratio of PLAYGROUND_RATIOS) {
      const candidate = playgroundTierSize(tier, ratio)
      if (candidate.width === parsed.width && candidate.height === parsed.height) return tier
    }
  }
  return resolveResolutionTier(size)
}

export function resolveGeminiImageConfig(size: string): {
  aspectRatio: string
  imageSize: ResolutionTier
} {
  return {
    aspectRatio: nearestGeminiAspectRatio(size),
    imageSize: resolvePlaygroundResolutionTier(size),
  }
}

function readGeminiError(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const record = payload as { error?: { message?: unknown }; message?: unknown }
    if (typeof record.error?.message === 'string') return record.error.message
    if (typeof record.message === 'string') return record.message
  }
  return `Gemini 上游返回 HTTP ${status}`
}

function extractGeminiImages(payload: unknown): GeminiGeneratedImage[] {
  if (!payload || typeof payload !== 'object') return []
  const candidates = (payload as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return []

  const images: GeminiGeneratedImage[] = []
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const parts = (candidate as { content?: { parts?: unknown } }).content?.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (!part || typeof part !== 'object') continue
      const record = part as {
        inlineData?: { data?: unknown; mimeType?: unknown }
        inline_data?: { data?: unknown; mime_type?: unknown }
      }
      const inlineData = record.inlineData ?? record.inline_data
      if (!inlineData || typeof inlineData.data !== 'string' || !inlineData.data) continue
      const bytes = Buffer.from(inlineData.data, 'base64')
      if (bytes.byteLength > GEMINI_OUTPUT_LIMIT_BYTES) {
        throw new HttpError(502, 'upstream_image_too_large', 'Gemini 上游返回的图片超过 50 MiB')
      }
      images.push({
        bytes,
        mimeType: (
          ('mimeType' in inlineData ? inlineData.mimeType : undefined) ??
          ('mime_type' in inlineData ? inlineData.mime_type : undefined)
        ) as string || 'image/png',
      })
    }
  }
  return images
}

export async function callGeminiGenerateContent(input: GeminiGenerateInput): Promise<GeminiGenerateResult> {
  if (!input.apiKey.trim()) {
    throw new HttpError(500, 'missing_upstream_key', 'Gemini 渠道尚未配置 API Key')
  }

  const inlineImages = [...input.inputImages, ...(input.editMask ? [input.editMask] : [])]
  const inlineBytes = inlineImages.reduce((total, image) => total + image.data.byteLength, 0)
  if (inlineBytes > GEMINI_INLINE_INPUT_LIMIT_BYTES) {
    throw new HttpError(413, 'gemini_inline_images_too_large', 'Gemini 原生接口的内联参考图总大小不能超过 20 MiB')
  }

  const parts: Array<Record<string, unknown>> = inlineImages.map((image) => ({
    inlineData: {
      mimeType: image.mimeType,
      data: image.data.toString('base64'),
    },
  }))
  const prompt = input.editMask
    ? `${input.prompt}\n\nThe final reference image is an edit mask. Apply the requested edit primarily within its marked area.`
    : input.prompt
  parts.push({ text: prompt })

  const imageConfig = resolveGeminiImageConfig(input.size)
  const contents = [{ role: 'user', parts }]
  const bodies = [
    {
      contents,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig,
      },
    },
    {
      contents,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        responseFormat: { image: imageConfig },
      },
    },
  ]
  const request = {
    model: input.model,
    promptLength: input.prompt.length,
    referenceImageCount: input.inputImages.length,
    hasEditMask: Boolean(input.editMask),
    imageConfig,
  }
  let finalPayload: unknown = {}
  // 部分上游不识别 imageConfig（返回 400/422）。首次撞到即记忆该模型的格式偏好，
  // 后续请求直接使用正确格式，不再每次先撞一次错误格式。
  const prefersLegacyFormat = preferredLegacyResponseFormatModels.has(input.model)
  const bodyOrder = prefersLegacyFormat ? [1, 0] : [0, 1]
  for (const [attemptIndex, bodyIndex] of bodyOrder.entries()) {
    const response = await fetch(buildGeminiGenerateContentEndpoint(input.baseUrl, input.model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': input.apiKey,
      },
      body: JSON.stringify(bodies[bodyIndex]),
      signal: input.signal,
    })
    const payload = await response.json().catch(() => ({})) as unknown
    finalPayload = payload
    if (response.ok) {
      return { images: extractGeminiImages(payload), payload, request }
    }
    const shouldRetryAlternateFormat = attemptIndex === 0
      && shouldRetryAlternateImageFormat(response.status, readGeminiError(payload, response.status))
    if (!shouldRetryAlternateFormat) {
      throw new HttpError(response.status, 'gemini_upstream_error', readGeminiError(payload, response.status))
    }
    if (bodyIndex === 0 && !prefersLegacyFormat) {
      preferredLegacyResponseFormatModels.add(input.model)
      console.info('[gemini] upstream rejected imageConfig; remembering legacy responseFormat preference', {
        model: input.model,
        status: response.status,
      })
    }
  }
  throw new HttpError(502, 'gemini_upstream_error', readGeminiError(finalPayload, 502))
}
