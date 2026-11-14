import { Router } from 'express'
import type { ApiProtocol, GenerationTask, Prisma } from '@prisma/client'
import crypto from 'node:crypto'
import { z } from 'zod'
import { requireUser, resLocals, type RequestUser } from '../auth.js'
import { env } from '../env.js'
import {
  getGenerationTimeoutMessage,
  readStoredGenerationTimeoutSeconds,
} from '../generationTimeout.js'
import { HttpError, sendOk } from '../http.js'
import { callGeminiGenerateContent } from '../geminiApi.js'
import { isModelAspectRatioEnabled, resolveKnownAspectRatio } from '../modelAspectRatio.js'
import {
  isGptImage2Model,
  isQualityTierEnabled,
  MAX_INPUT_IMAGE_COUNT,
  resolveMaxInputImages,
  resolveModelCostForSize,
  resolveResolutionTier,
} from '../modelCost.js'
import { prisma } from '../prisma.js'
import { enqueueR2UploadForImages, resolveR2UploadPlan } from '../r2Upload/queue.js'
import { getPlatformSettings } from '../settings.js'
import {
  reserveGenerationTaskSlot,
  withGenerationUpstreamSlot,
} from '../generationConcurrency.js'
import {
  deleteGeneratedImageFilesForTasks,
  getGeneratedImageFilePath,
  writeGeneratedImageFile,
} from '../generatedImageFiles.js'

const router = Router()
const MAX_UPSTREAM_IMAGE_COUNT = 10
const MAX_INPUT_IMAGE_BYTES = 50 * 1024 * 1024
const MAX_TOTAL_INPUT_BYTES = 128 * 1024 * 1024
const MAX_UPSTREAM_JSON_BYTES = 80 * 1024 * 1024

const taskParamsSchema = z.object({
  size: z.string().default('auto'),
  quality: z.string().default('auto'),
  output_format: z.string().default('png'),
  output_compression: z.number().nullable().optional(),
  moderation: z.string().default('auto'),
  n: z.number().int().min(1).max(10).default(1),
})

const generationSchema = z.object({
  clientRequestId: z.string().trim().min(1).max(128),
  modelConfigId: z.string().min(1),
  prompt: z.string().min(1, '请输入提示词'),
  params: taskParamsSchema,
  inputImages: z.array(z.object({ id: z.string(), dataUrl: z.string() })).max(MAX_INPUT_IMAGE_COUNT).default([]),
  editMask: z
    .object({
      dataUrl: z.string(),
      sourceImageId: z.string().nullable().optional(),
      selection: z.unknown().nullable().optional(),
    })
    .nullable()
    .optional(),
})

type GenerationInput = z.infer<typeof generationSchema>
type GenerationModel = Prisma.ModelConfigGetPayload<{
  include: {
    upstreamProvider: true
    lowQualityUpstreamProvider: true
    highQualityUpstreamProvider: true
    ,xhighQualityUpstreamProvider: true
    ,maxQualityUpstreamProvider: true
  }
}>
type GenerationUpstream = { model: string; baseUrl: string; apiKey: string; protocol: ApiProtocol }
type PreparedGenerationImage = {
  byteSize: number
  file: File
  id: string
  mimeType: string
  sha256: string
}
type PreparedGenerationMask = {
  byteSize: number
  file: File
  mimeType: string
  sha256: string
  selection?: unknown
  sourceImageId?: string | null
}
type PreparedGenerationInput = Omit<GenerationInput, 'editMask' | 'inputImages'> & {
  editMask?: PreparedGenerationMask | null
  inputImages: PreparedGenerationImage[]
}
type TaskImagePayload = { dataUrl: string; index?: number; mimeType: string }
type GenerationResponseTask = Pick<
  GenerationTask,
  'id' | 'userId' | 'modelConfigId' | 'status' | 'error' | 'outputImages' | 'costCredits' | 'params'
>
type GeneratedImagePayload =
  | { bytes: Buffer; index?: number; mimeType: string; upstreamResponse?: unknown }
  | { remoteUrl: string; index?: number; mimeType: string; upstreamResponse?: unknown }
type GenerationImageResult =
  | { index: number; status: 'done'; mimeType: string; upstreamResponse?: unknown }
  | { error: string; httpStatus?: number; index: number; status: 'error' }
type StoredGenerationImageResult =
  | { dataUrl: string; index: number; mimeType: string; status: 'done' }
  | { error: string; index: number; status: 'error' }

const GENERIC_GENERATION_FAILURE_MESSAGE = '生成失败，请稍后重试'
const UPSTREAM_FALLBACK_RETRY_COUNT = 1
const GENERATION_TIMEOUT_ERROR_CODE = 'generation_timeout'

function createGenerationTimeoutError(timeoutSeconds: number): HttpError {
  return new HttpError(504, GENERATION_TIMEOUT_ERROR_CODE, getGenerationTimeoutMessage(timeoutSeconds))
}

function isGenerationTimeoutError(error: unknown): boolean {
  return error instanceof HttpError && error.code === GENERATION_TIMEOUT_ERROR_CODE
}

function publicUser(user: { id: string; email: string; role: string; creditBalance: number }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    creditBalance: user.creditBalance,
  }
}

function resolveQualityUpstreamModel(model: GenerationModel, quality: string): string {
  if (quality === 'low') return model.lowQualityUpstreamModel?.trim() || model.upstreamModel
  if (quality === 'xhigh') return model.xhighQualityUpstreamModel?.trim() || model.upstreamModel
  if (quality === 'max') return model.maxQualityUpstreamModel?.trim() || model.upstreamModel
  if (quality === 'high') return model.highQualityUpstreamModel?.trim() || model.upstreamModel
  return model.upstreamModel
}

function resolveGenerationUpstream(model: GenerationModel, quality: string): GenerationUpstream {
  const upstreamModel = resolveQualityUpstreamModel(model, quality)
  const qualityProvider = quality === 'low'
    ? model.lowQualityUpstreamProvider
    : quality === 'xhigh'
      ? model.xhighQualityUpstreamProvider
      : quality === 'max'
        ? model.maxQualityUpstreamProvider
        : quality === 'high'
          ? model.highQualityUpstreamProvider
      : null
  const upstreamProvider = qualityProvider?.enabled ? qualityProvider : model.upstreamProvider
  return upstreamProvider?.enabled
    ? {
        model: upstreamModel,
        baseUrl: upstreamProvider.baseUrl,
        apiKey: upstreamProvider.apiKey,
        protocol: model.apiProtocol,
      }
    : {
        model: upstreamModel,
        baseUrl: env.openaiBaseUrl,
        apiKey: env.openaiApiKey,
        protocol: model.apiProtocol,
      }
}

function normalizeTaskImages(outputImages: unknown): TaskImagePayload[] {
  if (!Array.isArray(outputImages)) return []
  return outputImages.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const image = item as Record<string, unknown>
    if (typeof image.dataUrl !== 'string') return []
    return [{
      dataUrl: image.dataUrl,
      index: typeof image.index === 'number' ? image.index : undefined,
      mimeType: typeof image.mimeType === 'string' ? image.mimeType : 'image/png',
    }]
  })
}

function normalizeTaskImageResults(
  outputImages: unknown,
  taskError: string | null,
  params: Prisma.JsonValue,
): GenerationImageResult[] {
  const requestedCount = params && typeof params === 'object' && !Array.isArray(params)
    && typeof (params as Record<string, unknown>).n === 'number'
    ? clampImageCount((params as Record<string, unknown>).n as number)
    : 1
  const resultsByIndex = new Map<number, GenerationImageResult>()

  if (Array.isArray(outputImages)) {
    outputImages.forEach((item, fallbackIndex) => {
      if (!item || typeof item !== 'object') return
      const record = item as Record<string, unknown>
      const index = typeof record.index === 'number' ? record.index : fallbackIndex
      if (typeof record.dataUrl === 'string') {
        resultsByIndex.set(index, {
          index,
          status: 'done',
          mimeType: typeof record.mimeType === 'string' ? record.mimeType : 'image/png',
        })
        return
      }
      if (record.status === 'error') {
        resultsByIndex.set(index, {
          index,
          status: 'error',
          error: typeof record.error === 'string' ? record.error : GENERIC_GENERATION_FAILURE_MESSAGE,
        })
      }
    })
  }

  if (taskError && !resultsByIndex.size) {
    for (let index = 0; index < requestedCount; index += 1) {
      resultsByIndex.set(index, {
        index,
        status: 'error',
        error: getGenerationFailureMessage(taskError),
      })
    }
  }

  return Array.from(resultsByIndex.values()).sort((left, right) => left.index - right.index)
}

async function buildGenerationTaskResponse(
  task: GenerationResponseTask,
  related?: {
    user: { id: string; email: string; role: string; creditBalance: number }
    model: { id: string; displayName: string }
  },
) {
  const responseRelations = related ?? await (async () => {
    const [user, model] = await Promise.all([
      prisma.user.findUnique({
        where: { id: task.userId },
        select: { id: true, email: true, role: true, creditBalance: true },
      }),
      prisma.modelConfig.findUnique({
        where: { id: task.modelConfigId },
        select: { id: true, displayName: true },
      }),
    ])
    return { user, model }
  })()
  const latestUser = responseRelations.user
  const model = responseRelations.model

  return {
    taskId: task.id,
    status: task.status,
    error: task.status === 'error' ? task.error || GENERIC_GENERATION_FAILURE_MESSAGE : null,
    images: normalizeTaskImages(task.outputImages),
    model: {
      id: model?.id ?? task.modelConfigId,
      displayName: model?.displayName ?? '未知模型',
      costCredits: task.costCredits,
    },
    user: latestUser ? publicUser(latestUser) : null,
    responseMeta: {
      pending: task.status === 'running',
      generationTimeoutSeconds: readStoredGenerationTimeoutSeconds(task.params),
      squareUploadError: null,
      imageResults: normalizeTaskImageResults(task.outputImages, task.error, task.params),
      appliedImageParams: {
        size: typeof (task.params as { size?: unknown }).size === 'string'
          ? (task.params as { size: string }).size
          : 'auto',
        quality: typeof (task.params as { quality?: unknown }).quality === 'string'
          ? (task.params as { quality: string }).quality
          : 'auto',
        output_format: typeof (task.params as { output_format?: unknown }).output_format === 'string'
          ? (task.params as { output_format: string }).output_format
          : 'png',
      },
    },
  }
}

function getGenerationFailureMessage(error: unknown): string {
  if (error instanceof HttpError) {
    if (isGenerationTimeoutError(error)) {
      return error.message
    }
    if (error.status === 400) {
      return error.message || '请求参数不正确，请调整后重试'
    }
    if (error.code === 'missing_upstream_key') {
      return '生成服务配置异常，请联系管理员'
    }
    if (error.code === 'upstream_error') {
      return '生成失败，请调整提示词或稍后重试'
    }
    if (error.code === 'upstream_image_download_failed') {
      return GENERIC_GENERATION_FAILURE_MESSAGE
    }
    if (error.status >= 500) {
      return GENERIC_GENERATION_FAILURE_MESSAGE
    }
    return error.message
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/fetch failed|network|timeout|timed out|abort|ECONN|ENOTFOUND|EAI_AGAIN|socket|TLS|certificate/i.test(message)) {
    return GENERIC_GENERATION_FAILURE_MESSAGE
  }
  return GENERIC_GENERATION_FAILURE_MESSAGE
}

function shouldFallbackRetryGeneration(error: unknown): boolean {
  if (error instanceof HttpError) {
    if (error.status === 400) return false
    if (error.code === 'missing_upstream_key') return false
    return error.status >= 408 || error.code === 'upstream_no_images' || error.code === 'upstream_image_download_failed'
  }

  const message = error instanceof Error ? error.message : String(error)
  return /fetch failed|network|timeout|timed out|abort|ECONN|ENOTFOUND|EAI_AGAIN|socket|TLS|certificate/i.test(message)
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Buffer } {
  const match = /^data:([^;,]+)(?:;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) throw new HttpError(400, 'invalid_image', '参考图格式无效')
  const mimeType = match[1] || 'image/png'
  const body = match[2] || ''
  const bytes = dataUrl.includes(';base64,')
    ? Buffer.from(body, 'base64')
    : Buffer.from(decodeURIComponent(body), 'utf8')
  return { mimeType, bytes }
}

function prepareGenerationInput(input: GenerationInput): PreparedGenerationInput {
  let totalBytes = 0
  const accountForBytes = (bytes: Buffer, label: string) => {
    if (bytes.byteLength > MAX_INPUT_IMAGE_BYTES) {
      throw new HttpError(413, 'input_image_too_large', `${label}超过 50 MiB`)
    }
    totalBytes += bytes.byteLength
    if (totalBytes > MAX_TOTAL_INPUT_BYTES) {
      throw new HttpError(413, 'input_images_too_large', '参考图与蒙版总大小超过 128 MiB')
    }
  }

  const inputImages = input.inputImages.map((image, index): PreparedGenerationImage => {
    const { mimeType, bytes } = parseDataUrl(image.dataUrl)
    accountForBytes(bytes, `第 ${index + 1} 张参考图`)
    return {
      id: image.id,
      mimeType,
      byteSize: bytes.byteLength,
      file: new File([Uint8Array.from(bytes)], `input-${index}.png`, { type: mimeType }),
      sha256: crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16),
    }
  })
  const editMask = input.editMask?.dataUrl
    ? (() => {
        const { mimeType, bytes } = parseDataUrl(input.editMask!.dataUrl)
        accountForBytes(bytes, '编辑蒙版')
        return {
          byteSize: bytes.byteLength,
          file: new File([Uint8Array.from(bytes)], 'mask.png', { type: mimeType }),
          mimeType,
          sha256: crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16),
          sourceImageId: input.editMask!.sourceImageId,
          selection: input.editMask!.selection,
        } satisfies PreparedGenerationMask
      })()
    : null

  return {
    clientRequestId: input.clientRequestId,
    modelConfigId: input.modelConfigId,
    prompt: input.prompt,
    params: input.params,
    inputImages,
    editMask,
  }
}

function summarizeReferenceImage(
  image: PreparedGenerationImage,
  index: number,
): Record<string, unknown> {
  return {
    index,
    id: image.id,
    mimeType: image.mimeType,
    byteSize: image.byteSize,
    sha256: image.sha256,
  }
}

function summarizeMaskImage(mask: PreparedGenerationInput['editMask']): Record<string, unknown> | null {
  if (!mask) return null
  return {
    sourceImageId: mask.sourceImageId ?? null,
    mimeType: mask.mimeType,
    byteSize: mask.byteSize,
    sha256: mask.sha256,
    hasSelection: Boolean(mask.selection),
  }
}

function createAdminTaskMeta(input: PreparedGenerationInput): Record<string, unknown> {
  const operation = input.inputImages.length > 0 ? 'edit' : 'generation'
  const referenceImages = operation === 'edit'
    ? input.inputImages.map(summarizeReferenceImage)
    : []
  const mask = summarizeMaskImage(input.editMask)

  return {
    operation,
    operationLabel: operation === 'edit' ? '编辑' : '生成',
    referenceImageCount: input.inputImages.length,
    referenceImages,
    mask,
  }
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function mergeAdminReturnParams(
  currentParams: Prisma.JsonValue,
  generationResult: Awaited<ReturnType<typeof callImagesApi>>,
): Prisma.InputJsonValue {
  const params = currentParams && typeof currentParams === 'object' && !Array.isArray(currentParams)
    ? currentParams as Record<string, unknown>
    : {}
  const currentAdmin = params._admin && typeof params._admin === 'object' && !Array.isArray(params._admin)
    ? params._admin as Record<string, unknown>
    : {}

  return toPrismaJsonValue({
    ...params,
    _admin: {
      ...currentAdmin,
      upstreamResponse: {
        requestedCount: generationResult.requestedCount,
        receivedCount: generationResult.images.length,
        imageResults: generationResult.imageResults,
      },
    },
  })
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

function resolveUpstreamImageUrl(url: string, baseUrl: string): string {
  const normalized = url.trim()
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (normalized.startsWith('/')) return new URL(normalized, `${baseUrl.replace(/\/+$/, '')}/`).toString()
  throw new HttpError(502, 'upstream_image_download_failed', '上游返回了无效图片地址')
}

async function normalizeImageResponse(
  payload: unknown,
  upstreamBaseUrl: string,
  signal: AbortSignal,
): Promise<GeneratedImagePayload[]> {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const data = Array.isArray(record.data) ? record.data : []
  const upstreamResponse = sanitizeUpstreamPayload(payload)
  const images: GeneratedImagePayload[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const image = item as Record<string, unknown>
    if (typeof image.b64_json === 'string') {
      const bytes = Buffer.from(image.b64_json, 'base64')
      if (bytes.byteLength > MAX_INPUT_IMAGE_BYTES) {
        throw new HttpError(502, 'upstream_image_too_large', '上游返回的图片超过 50 MiB')
      }
      images.push({
        bytes,
        mimeType: sniffImageMimeType(bytes) || 'image/png',
        upstreamResponse,
      })
      continue
    }
    const remoteUrl = typeof image.url === 'string'
      ? image.url
      : typeof image.image_url === 'string'
        ? image.image_url
        : ''
    if (remoteUrl) {
      images.push({
        remoteUrl: resolveUpstreamImageUrl(remoteUrl, upstreamBaseUrl),
        mimeType: 'image/png',
        upstreamResponse,
      })
    }
  }
  return images
}

export async function checkModerationRules(prompt: string) {
  const rules = await prisma.moderationRule.findMany({
    where: { enabled: true },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    take: 200,
  })
  const normalizedPrompt = prompt.toLowerCase()
  for (const rule of rules) {
    let matched = false
    if (rule.type === 'regex') {
      try {
        matched = new RegExp(rule.pattern, 'i').test(prompt)
      } catch {
        matched = false
      }
    } else {
      matched = normalizedPrompt.includes(rule.pattern.toLowerCase())
    }
    if (matched) {
      await prisma.moderationRule.update({
        where: { id: rule.id },
        data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
      })
      throw new HttpError(400, 'moderation_blocked', rule.message || '提示词包含平台暂不支持的内容，请调整后重试')
    }
  }
}

function clampImageCount(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(Math.floor(value), MAX_UPSTREAM_IMAGE_COUNT))
}

function withImageCount(input: PreparedGenerationInput, n: number): PreparedGenerationInput {
  return {
    ...input,
    params: {
      ...input.params,
      n,
    },
  }
}

function shouldRequestExplicitBase64(model: string): boolean {
  return !/^gpt-image(?:$|[-_:/.])/i.test(model.trim())
}

export function resolveEffectiveQuality(model: GenerationModel, quality: string, size: string): string {
  const tier = resolveResolutionTier(size)
  if (!isGptImage2Model(model)) {
    if (isQualityTierEnabled(model, 'medium', tier)) return 'medium'
    throw new HttpError(400, 'model_option_disabled', `当前模型未开放${tier}分辨率`)
  }
  if (quality !== 'auto') {
    if (!isQualityTierEnabled(model, quality, tier)) {
      throw new HttpError(400, 'model_option_disabled', `当前模型未开放${tier} ${quality}质量`)
    }
    return quality
  }
  for (const fallback of ['low', 'medium', 'high', 'xhigh', 'max']) {
    if (isQualityTierEnabled(model, fallback, tier)) return fallback
  }
  throw new HttpError(400, 'model_option_disabled', `当前模型未开放${tier}分辨率`)
}

function sanitizeUpstreamPayload(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[depth-limit]'
  if (typeof value === 'string') {
    if (value.length > 300) return `[string length=${value.length} preview=${value.slice(0, 120)}]`
    return value
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeUpstreamPayload(item, depth + 1))
  }
  if (!value || typeof value !== 'object') return value

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/b64|base64/i.test(key) && typeof item === 'string') {
      result[key] = `[base64 length=${item.length}]`
      continue
    }
    result[key] = sanitizeUpstreamPayload(item, depth + 1)
  }
  return result
}

async function readUpstreamJsonWithLog(response: Response, context: {
  endpoint: string
  operation: 'generation' | 'edit'
  request: Record<string, unknown>
}): Promise<unknown> {
  const contentType = response.headers.get('content-type') || ''
  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_JSON_BYTES) {
    await response.body?.cancel().catch(() => undefined)
    throw new HttpError(502, 'upstream_response_too_large', '上游响应超过 80 MiB')
  }
  const payload = await response.json().catch((error: unknown) => {
    console.warn('[generation] failed to parse upstream response body', {
      endpoint: context.endpoint,
      status: response.status,
      error: error instanceof Error ? error.message : String(error),
    })
    return {}
  })

  console.info('[generation] upstream response', {
    endpoint: context.endpoint,
    operation: context.operation,
    status: response.status,
    ok: response.ok,
    contentType,
    request: context.request,
    payload: sanitizeUpstreamPayload(payload),
  })

  return payload
}

function logUpstreamRequest(context: {
  endpoint: string
  operation: 'generation' | 'edit'
  request: Record<string, unknown>
}) {
  console.info('[generation] upstream request', context)
}

async function callImagesApiOnce(
  input: PreparedGenerationInput,
  upstream: GenerationUpstream,
  signal: AbortSignal,
) {
  if (!upstream.apiKey) {
    throw new HttpError(500, 'missing_upstream_key', '服务端尚未配置 OPENAI_API_KEY')
  }

  const baseUrl = upstream.baseUrl.replace(/\/+$/, '')
  const headers = { Authorization: `Bearer ${upstream.apiKey}` }
  const hasInputImages = input.inputImages.length > 0
  const requestExplicitBase64 = shouldRequestExplicitBase64(upstream.model)

  if (hasInputImages) {
    const form = new FormData()
    form.set('model', upstream.model)
    form.set('prompt', input.prompt)
    form.set('size', input.params.size)
    form.set('quality', input.params.quality)
    form.set('n', String(input.params.n))
    if (requestExplicitBase64) form.set('response_format', 'b64_json')
    input.inputImages.forEach((image) => {
      form.append('image[]', image.file)
    })
    if (input.editMask) {
      form.set('mask', input.editMask.file)
    }

    const endpoint = `${baseUrl}/v1/images/edits`
    const requestLog = {
      model: upstream.model,
      promptLength: input.prompt.length,
      size: input.params.size,
      quality: input.params.quality,
      n: input.params.n,
      response_format: requestExplicitBase64 ? 'b64_json' : 'b64_json (GPT Image 默认)',
      referenceImageCount: input.inputImages.length,
      referenceImages: input.inputImages.map(summarizeReferenceImage),
      mask: summarizeMaskImage(input.editMask),
    }
    logUpstreamRequest({
      endpoint: '/v1/images/edits',
      operation: 'edit',
      request: requestLog,
    })
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: form,
      signal,
    })
    const payload = await readUpstreamJsonWithLog(response, {
      endpoint: '/v1/images/edits',
      operation: 'edit',
      request: requestLog,
    })
    if (!response.ok) {
      const message = typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
        ? (payload as { error: { message: string } }).error.message
        : '上游图像编辑请求失败'
      throw new HttpError(response.status, 'upstream_error', message)
    }
    return normalizeImageResponse(payload, baseUrl, signal)
  }

  const body: Record<string, unknown> = {
    model: upstream.model,
    prompt: input.prompt,
    size: input.params.size,
    quality: input.params.quality,
    output_format: input.params.output_format,
    moderation: input.params.moderation,
    n: input.params.n,
  }
  if (requestExplicitBase64) body.response_format = 'b64_json'
  if (typeof input.params.output_compression === 'number') {
    body.output_compression = input.params.output_compression
  }

  const endpoint = `${baseUrl}/v1/images/generations`
  logUpstreamRequest({
    endpoint: '/v1/images/generations',
    operation: 'generation',
    request: body,
  })
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
  const payload = await readUpstreamJsonWithLog(response, {
    endpoint: '/v1/images/generations',
    operation: 'generation',
    request: body,
  })
  if (!response.ok) {
    const message = typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
      ? (payload as { error: { message: string } }).error.message
      : '上游图像生成请求失败'
    throw new HttpError(response.status, 'upstream_error', message)
  }
  return normalizeImageResponse(payload, baseUrl, signal)
}

async function callGeminiApiOnce(
  input: PreparedGenerationInput,
  upstream: GenerationUpstream,
  signal: AbortSignal,
): Promise<GeneratedImagePayload[]> {
  const inputImages = await Promise.all(input.inputImages.map(async (image) => ({
    data: Buffer.from(await image.file.arrayBuffer()),
    mimeType: image.mimeType,
  })))
  const editMask = input.editMask
    ? {
        data: Buffer.from(await input.editMask.file.arrayBuffer()),
        mimeType: input.editMask.mimeType,
      }
    : null
  const result = await callGeminiGenerateContent({
    apiKey: upstream.apiKey,
    baseUrl: upstream.baseUrl,
    editMask,
    inputImages,
    model: upstream.model,
    prompt: input.prompt,
    signal,
    size: input.params.size,
  })
  console.info('[generation] Gemini upstream response', {
    endpoint: '/v1beta/models/{model}:generateContent',
    operation: input.inputImages.length > 0 ? 'edit' : 'generation',
    request: result.request,
    payload: sanitizeUpstreamPayload(result.payload),
  })
  const upstreamResponse = sanitizeUpstreamPayload(result.payload)
  return result.images.map((image) => ({
    bytes: image.bytes,
    mimeType: image.mimeType,
    upstreamResponse,
  }))
}

function callUpstreamImageApiOnce(
  input: PreparedGenerationInput,
  upstream: GenerationUpstream,
  signal: AbortSignal,
): Promise<GeneratedImagePayload[]> {
  return upstream.protocol === 'gemini'
    ? callGeminiApiOnce(input, upstream, signal)
    : callImagesApiOnce(input, upstream, signal)
}

async function callSingleImageApi(
  input: PreparedGenerationInput,
  upstream: GenerationUpstream,
  signal: AbortSignal,
  timeoutSeconds: number,
): Promise<GeneratedImagePayload> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= UPSTREAM_FALLBACK_RETRY_COUNT; attempt += 1) {
    try {
      if (signal.aborted) {
        throw createGenerationTimeoutError(timeoutSeconds)
      }
      const images = await withGenerationUpstreamSlot(
        signal,
        () => callUpstreamImageApiOnce(withImageCount(input, 1), upstream, signal),
      )
      const image = images[0]
      if (!image) {
        throw new HttpError(502, 'upstream_no_images', GENERIC_GENERATION_FAILURE_MESSAGE)
      }
      return image
    } catch (error) {
      lastError = error
      if (signal.aborted) {
        throw createGenerationTimeoutError(timeoutSeconds)
      }
      if (attempt >= UPSTREAM_FALLBACK_RETRY_COUNT || !shouldFallbackRetryGeneration(error)) {
        throw error
      }
      console.warn('[generation] upstream request failed, running fallback retry', {
        attempt: attempt + 1,
        model: upstream.model,
        status: error instanceof HttpError ? error.status : null,
        code: error instanceof HttpError ? error.code : null,
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function callImagesApi(
  input: PreparedGenerationInput,
  upstream: GenerationUpstream,
  signal: AbortSignal,
  timeoutSeconds: number,
  persistImage: (
    image: GeneratedImagePayload,
    index: number,
  ) => Promise<Extract<StoredGenerationImageResult, { status: 'done' }>>,
) {
  const requestedCount = clampImageCount(input.params.n)
  const settled = await Promise.allSettled(
    Array.from({ length: requestedCount }, (_item, index) => (
      callSingleImageApi(input, upstream, signal, timeoutSeconds).then(async (image) => {
        try {
          return {
            image: await persistImage(image, index),
            index,
            mimeType: image.mimeType,
            upstreamResponse: image.upstreamResponse,
          }
        } finally {
          if ('bytes' in image) image.bytes = Buffer.alloc(0)
        }
      })
    )),
  )
  const imageResults: GenerationImageResult[] = []
  const images: Array<Extract<StoredGenerationImageResult, { status: 'done' }>> = []

  if (signal.aborted) {
    throw createGenerationTimeoutError(timeoutSeconds)
  }

  settled.forEach((result, fallbackIndex) => {
    const index = result.status === 'fulfilled' ? result.value.index : fallbackIndex
    if (result.status === 'fulfilled') {
      images.push(result.value.image)
      imageResults.push({
        index,
        status: 'done',
        mimeType: result.value.mimeType,
        upstreamResponse: result.value.upstreamResponse,
      })
      return
    }

    imageResults.push({
      index,
      status: 'error',
      httpStatus: result.reason instanceof HttpError ? result.reason.status : undefined,
      error: getGenerationFailureMessage(result.reason),
    })
  })

  if (!images.length) {
    const firstError = imageResults.find((item) => item.status === 'error')
    const allFailuresAreClientErrors = imageResults.every(
      (item) => item.status === 'error' && item.httpStatus === 400,
    )
    throw new HttpError(
      allFailuresAreClientErrors ? 400 : 502,
      'upstream_all_images_failed',
      firstError?.error || GENERIC_GENERATION_FAILURE_MESSAGE,
    )
  }

  if (images.length < requestedCount) {
    console.warn('[generation] partial image generation completed', {
      requested: requestedCount,
      received: images.length,
      failed: requestedCount - images.length,
      taskPromptLength: input.prompt.length,
    })
  }

  imageResults.sort((left, right) => left.index - right.index)
  return { imageResults, images, requestedCount }
}

async function refundFailedGeneration(input: {
  costCredits: number
  error: unknown
  taskId: string
  userId: string
}) {
  await prisma.$transaction(async (tx) => {
    const failed = await tx.generationTask.updateMany({
      where: {
        id: input.taskId,
        userId: input.userId,
        status: 'running',
      },
      data: {
        status: 'error',
        error: getGenerationFailureMessage(input.error),
        finishedAt: new Date(),
      },
    })
    if (failed.count === 0) {
      return
    }

    const latestUser = await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: { increment: input.costCredits } },
      select: { creditBalance: true },
    })
    await tx.creditLedger.create({
      data: {
        userId: input.userId,
        delta: input.costCredits,
        reason: isGenerationTimeoutError(input.error) ? '生成超时退回积分' : '生成失败退回积分',
        taskId: input.taskId,
        balanceAfter: latestUser.creditBalance,
      },
    })
  })
}

async function runGenerationTask(input: {
  costCredits: number
  generationDeadlineAt: number
  generationInput: PreparedGenerationInput
  generationTimeoutSeconds: number
  model: GenerationModel
  releaseTaskSlot: () => void
  taskId: string
  userId: string
}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, Math.max(0, input.generationDeadlineAt - Date.now()))

  try {
    const currentTask = await prisma.generationTask.findUnique({
      where: { id: input.taskId },
      select: { status: true },
    })
    if (!currentTask || currentTask.status !== 'running') {
      return
    }
    const generationResult = await callImagesApi(
      input.generationInput,
      resolveGenerationUpstream(input.model, input.generationInput.params.quality),
      controller.signal,
      input.generationTimeoutSeconds,
      async (image, index) => {
        if (controller.signal.aborted) {
          throw createGenerationTimeoutError(input.generationTimeoutSeconds)
        }
        const dataUrl = 'remoteUrl' in image
          ? image.remoteUrl
          : await writeGeneratedImageFile({
              taskId: input.taskId,
              index,
              mimeType: image.mimeType,
              bytes: image.bytes,
            })
        return {
          dataUrl,
          index,
          mimeType: image.mimeType,
          status: 'done',
        }
      },
    )
    if (controller.signal.aborted) {
      throw createGenerationTimeoutError(input.generationTimeoutSeconds)
    }
    const images = generationResult.images
    const failedImages = generationResult.imageResults
      .filter((item): item is Extract<GenerationImageResult, { status: 'error' }> => item.status === 'error')
      .map((item): StoredGenerationImageResult => ({
        index: item.index,
        status: 'error',
        error: item.error,
      }))

    // R2 上传决策：立即模式同步上传并把地址替换为 R2 链接；窗口模式在提交后入队
    const r2Images = images.map((image) => ({
      dataUrl: image.dataUrl,
      index: image.index,
      mimeType: image.mimeType,
    }))
    let r2Plan: Awaited<ReturnType<typeof resolveR2UploadPlan>> | null = null
    if (!controller.signal.aborted && r2Images.length) {
      r2Plan = await resolveR2UploadPlan({ taskId: input.taskId, images: r2Images })
    }
    const finalImages = r2Plan
      ? images.map((image) => {
          const r2Url = r2Plan.urls.get(image.index)
          return r2Url ? { ...image, dataUrl: r2Url } : image
        })
      : images
    const outputImages = [...finalImages, ...failedImages].sort((left, right) => left.index - right.index)
    const outputPreviews = [
      ...images.map((image) => ({
        index: image.index,
        status: image.status,
        mimeType: image.mimeType,
      })),
      ...failedImages,
    ].sort((left, right) => left.index - right.index)
    const refundCredits = generationResult.requestedCount > 0 && failedImages.length > 0
      ? (input.costCredits / generationResult.requestedCount) * failedImages.length
      : 0
    const chargedCredits = input.costCredits - refundCredits

    if (controller.signal.aborted) {
      throw createGenerationTimeoutError(input.generationTimeoutSeconds)
    }
    let completedTask = false
    await prisma.$transaction(async (tx) => {
      const currentTask = await tx.generationTask.findUnique({
        where: { id: input.taskId },
        select: { params: true, status: true },
      })
      if (!currentTask || currentTask.status !== 'running') {
        console.info('[generation] async task result ignored because task is no longer running', {
          taskId: input.taskId,
          status: currentTask?.status ?? 'missing',
        })
        return
      }
      if (controller.signal.aborted) {
        throw createGenerationTimeoutError(input.generationTimeoutSeconds)
      }
      const completed = await tx.generationTask.updateMany({
        where: {
          id: input.taskId,
          status: 'running',
        },
        data: {
          status: 'done',
          costCredits: chargedCredits,
          error: null,
          params: mergeAdminReturnParams(currentTask.params, generationResult),
          outputImages,
          outputPreviews,
          finishedAt: new Date(),
        },
      })
      if (completed.count === 0) {
        return
      }
      completedTask = true
      if (refundCredits > 0) {
        const latestUser = await tx.user.update({
          where: { id: input.userId },
          data: { creditBalance: { increment: refundCredits } },
          select: { creditBalance: true },
        })
        await tx.creditLedger.create({
          data: {
            userId: input.userId,
            delta: refundCredits,
            reason: '部分图片生成失败退回积分',
            taskId: input.taskId,
            balanceAfter: latestUser.creditBalance,
          },
        })
      }
    })
    if (!completedTask) {
      await deleteGeneratedImageFilesForTasks([input.taskId])
    } else if (r2Plan && r2Plan.fallbackImages.length) {
      void enqueueR2UploadForImages({
        taskId: input.taskId,
        images: r2Plan.fallbackImages,
      }).catch((error: unknown) => {
        console.warn('[r2-upload] failed to enqueue fallback images', {
          taskId: input.taskId,
          error,
        })
      })
    }
  } catch (error) {
    const taskError = controller.signal.aborted
      ? createGenerationTimeoutError(input.generationTimeoutSeconds)
      : error
    console.error('[generation] async task failed', {
      taskId: input.taskId,
      error: taskError,
    })
    await deleteGeneratedImageFilesForTasks([input.taskId]).catch((cleanupError: unknown) => {
      console.error('[generation-files] failed to clean up failed task files', cleanupError)
    })
    await refundFailedGeneration({
      taskId: input.taskId,
      userId: input.userId,
      costCredits: input.costCredits,
      error: taskError,
    }).catch((refundError: unknown) => {
      console.error('[generation] failed to refund failed task', {
        taskId: input.taskId,
        refundError,
      })
    })
  } finally {
    clearTimeout(timeoutId)
    input.releaseTaskSlot()
  }
}

router.get('/:taskId/images/:imageIndex', requireUser, async (req, res, next) => {
  const user = resLocals(req).user!
  try {
    const taskId = typeof req.params.taskId === 'string' ? req.params.taskId : ''
    const imageIndex = Number(req.params.imageIndex)
    if (!Number.isInteger(imageIndex) || imageIndex < 0) {
      throw new HttpError(400, 'invalid_image_index', '图片序号无效')
    }

    const task = await prisma.generationTask.findFirst({
      where: { id: taskId, userId: user.id },
      select: { outputImages: true },
    })
    if (!task) throw new HttpError(404, 'task_not_found', '生成任务不存在或已被清理')
    const image = normalizeTaskImages(task.outputImages).find((item) => item.index === imageIndex)
    if (!image) throw new HttpError(404, 'generated_image_not_found', '生成图片不存在或已过期')

    const filePath = getGeneratedImageFilePath(taskId, imageIndex, image.mimeType)
    res.setHeader('Cache-Control', 'private, no-store')
    res.type(image.mimeType)
    res.sendFile(filePath, (error) => {
      if (error) {
        if (!res.headersSent) {
          next(new HttpError(404, 'generated_image_not_found', '生成图片不存在或已过期'))
        } else {
          next(error)
        }
      }
    })
  } catch (error) {
    next(error)
  }
})

router.get('/:taskId', requireUser, async (req, res, next) => {
  const user = resLocals(req).user!
  try {
    const taskId = typeof req.params.taskId === 'string' ? req.params.taskId : ''
    const task = await prisma.generationTask.findFirst({
      where: { id: taskId, userId: user.id },
      select: {
        id: true,
        userId: true,
        modelConfigId: true,
        status: true,
        error: true,
        outputImages: true,
        costCredits: true,
        params: true,
        user: { select: { id: true, email: true, role: true, creditBalance: true } },
        modelConfig: { select: { id: true, displayName: true } },
      },
    })
    if (!task) throw new HttpError(404, 'task_not_found', '生成任务不存在或已被清理')

    res.setHeader('Cache-Control', 'private, no-store')
    sendOk(res, await buildGenerationTaskResponse(task, {
      user: task.user,
      model: task.modelConfig,
    }))
  } catch (error) {
    next(error)
  }
})

router.post('/', requireUser, async (req, res, next) => {
  const user = resLocals(req).user!
  try {
    const input = generationSchema.parse(req.body)
    const existingTask = await prisma.generationTask.findUnique({
      where: {
        userId_clientRequestId: {
          userId: user.id,
          clientRequestId: input.clientRequestId,
        },
      },
    })
    if (existingTask) {
      sendOk(res, await buildGenerationTaskResponse(existingTask))
      return
    }

    const result = await createGenerationTaskInternal({
      user,
      modelConfigId: input.modelConfigId,
      prompt: input.prompt,
      params: {
        size: input.params.size,
        quality: input.params.quality,
        output_format: input.params.output_format,
        output_compression: input.params.output_compression ?? null,
        moderation: input.params.moderation,
        n: input.params.n,
      },
      clientRequestId: input.clientRequestId,
      inputImages: input.inputImages,
      editMask: input.editMask,
    })

    if (!result.started) {
      sendOk(res, await buildGenerationTaskResponse(result.task))
      return
    }

    const latestUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, role: true, creditBalance: true },
    })

    sendOk(res, {
      taskId: result.task.id,
      status: result.task.status,
      images: [],
      model: {
        id: result.model.id,
        displayName: result.model.displayName,
        costCredits: result.costCredits,
      },
      user: latestUser ? publicUser(latestUser) : null,
      responseMeta: {
        pending: true,
        generationTimeoutSeconds: result.generationTimeoutSeconds,
        appliedImageParams: {
          size: result.generationInput.params.size,
          quality: result.generationInput.params.quality,
          output_format: result.generationInput.params.output_format,
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

export interface CreateGenerationTaskInternalInput {
  user: RequestUser
  modelConfigId: string
  prompt: string
  params: {
    size: string
    quality: string
    output_format?: string
    output_compression?: number | null
    moderation?: string
    n: number
  }
  clientRequestId: string
  batchId?: string
  inputImages?: Array<{ id: string; dataUrl: string }>
  editMask?: {
    dataUrl: string
    sourceImageId?: string | null
    selection?: unknown
  } | null
}

export interface CreateGenerationTaskInternalResult {
  taskId: string
  task: GenerationTask
  model: GenerationModel
  costCredits: number
  generationTimeoutSeconds: number
  generationInput: PreparedGenerationInput
  /** false 表示同 clientRequestId 的任务已存在（幂等命中），不会重复扣费 */
  started: boolean
}

/**
 * 服务端内部直接创建并执行一张生成任务（供批量等模块复用，不走 HTTP）。
 * 抛出 HttpError：429 生成繁忙（调用方可稍后重试）、402 积分不足、400 参数/审核问题等。
 */
export async function createGenerationTaskInternal(
  input: CreateGenerationTaskInternalInput,
): Promise<CreateGenerationTaskInternalResult> {
  const parsed = generationSchema.parse({
    clientRequestId: input.clientRequestId,
    modelConfigId: input.modelConfigId,
    prompt: input.prompt,
    params: {
      size: input.params.size,
      quality: input.params.quality,
      output_format: input.params.output_format ?? 'png',
      output_compression: input.params.output_compression ?? null,
      moderation: input.params.moderation ?? 'auto',
      n: input.params.n,
    },
    inputImages: input.inputImages ?? [],
    editMask: input.editMask ?? null,
  })

  const existingTask = await prisma.generationTask.findUnique({
    where: {
      userId_clientRequestId: {
        userId: input.user.id,
        clientRequestId: parsed.clientRequestId,
      },
    },
  })
  if (existingTask) {
    return {
      taskId: existingTask.id,
      task: existingTask,
      model: (await prisma.modelConfig.findFirst({
        where: { id: existingTask.modelConfigId },
        include: {
          upstreamProvider: true,
          lowQualityUpstreamProvider: true,
          highQualityUpstreamProvider: true,
          xhighQualityUpstreamProvider: true,
          maxQualityUpstreamProvider: true,
        },
      })) as GenerationModel,
      costCredits: existingTask.costCredits,
      generationTimeoutSeconds: readStoredGenerationTimeoutSeconds(existingTask.params),
      generationInput: null as unknown as PreparedGenerationInput,
      started: false,
    }
  }

  const settings = await getPlatformSettings()
  if (!settings.generationEnabled) {
    throw new HttpError(503, 'generation_closed', settings.maintenanceMessage || '当前生成服务维护中，请稍后再试')
  }
  const model = await prisma.modelConfig.findFirst({
    where: { id: parsed.modelConfigId, enabled: true },
    include: {
      upstreamProvider: true,
      lowQualityUpstreamProvider: true,
      highQualityUpstreamProvider: true,
      xhighQualityUpstreamProvider: true,
      maxQualityUpstreamProvider: true,
    },
  })
  if (!model) throw new HttpError(404, 'model_not_found', '模型不可用或不存在')
  if (model.apiProtocol !== 'images' && model.apiProtocol !== 'gemini') {
    throw new HttpError(400, 'unsupported_protocol', '当前平台生成任务支持 OpenAI Images 与 Gemini 原生协议')
  }
  if (!isModelAspectRatioEnabled(model, parsed.params.size)) {
    const ratio = resolveKnownAspectRatio(parsed.params.size)
    throw new HttpError(400, 'model_aspect_ratio_disabled', `当前模型未开放 ${ratio} 宽高比`)
  }
  const effectiveQuality = resolveEffectiveQuality(model, parsed.params.quality, parsed.params.size)
  const maxInputImages = resolveMaxInputImages(model, effectiveQuality, resolveResolutionTier(parsed.params.size))
  if (parsed.inputImages.length > maxInputImages) {
    throw new HttpError(
      400,
      'too_many_input_images',
      `当前档位最多支持 ${maxInputImages} 张参考图，本次提交了 ${parsed.inputImages.length} 张`,
    )
  }
  await checkModerationRules(parsed.prompt)

  let releaseTaskSlot: (() => void) | null = reserveGenerationTaskSlot()
  if (!releaseTaskSlot) {
    throw new HttpError(429, 'generation_busy', '生成服务繁忙，请稍后重试')
  }

  try {
    const generationInput = prepareGenerationInput({
      ...parsed,
      params: {
        ...parsed.params,
        quality: effectiveQuality,
      },
    })
    const adminTaskMeta = {
      ...createAdminTaskMeta(generationInput),
      generationTimeoutSeconds: settings.generationTimeoutSeconds,
    }
    const requestedCount = clampImageCount(generationInput.params.n)
    const costCredits = resolveModelCostForSize(model, generationInput.params.size, generationInput.params.quality) * requestedCount
    let shouldStartGeneration = true
    let task: GenerationTask
    try {
      task = await prisma.$transaction(async (tx) => {
        const latestUser = await tx.user.findUnique({
          where: { id: input.user.id },
          select: { creditBalance: true },
        })
        if (!latestUser) throw new HttpError(401, 'unauthorized', '登录状态已失效')
        if (latestUser.creditBalance < costCredits) {
          throw new HttpError(402, 'insufficient_credits', '积分不足，请联系管理员补充积分')
        }

        const nextBalance = latestUser.creditBalance - costCredits
        await tx.user.update({
          where: { id: input.user.id },
          data: { creditBalance: nextBalance },
        })
        const createdTask = await tx.generationTask.create({
          data: {
            userId: input.user.id,
            clientRequestId: parsed.clientRequestId,
            modelConfigId: model.id,
            prompt: generationInput.prompt,
            params: toPrismaJsonValue({
              ...generationInput.params,
              _admin: adminTaskMeta,
            }),
            status: 'running',
            costCredits,
            ...(input.batchId ? { batchId: input.batchId } : {}),
          },
        })
        await tx.creditLedger.create({
          data: {
            userId: input.user.id,
            delta: -costCredits,
            reason: `生成消耗：${model.displayName}`,
            taskId: createdTask.id,
            balanceAfter: nextBalance,
          },
        })
        return createdTask
      })
    } catch (error) {
      const concurrentTask = await prisma.generationTask.findUnique({
        where: {
          userId_clientRequestId: {
            userId: input.user.id,
            clientRequestId: parsed.clientRequestId,
          },
        },
      })
      if (!concurrentTask) {
        throw error
      }
      task = concurrentTask
      shouldStartGeneration = false
    }

    if (!shouldStartGeneration) {
      releaseTaskSlot()
      releaseTaskSlot = null
      return {
        taskId: task.id,
        task,
        model,
        costCredits,
        generationTimeoutSeconds: settings.generationTimeoutSeconds,
        generationInput,
        started: false,
      }
    }

    const taskSlotRelease = releaseTaskSlot
    releaseTaskSlot = null
    setImmediate(() => {
      void runGenerationTask({
        taskId: task.id,
        userId: input.user.id,
        generationDeadlineAt: task.createdAt.getTime() + settings.generationTimeoutSeconds * 1000,
        generationInput,
        generationTimeoutSeconds: settings.generationTimeoutSeconds,
        model,
        costCredits,
        releaseTaskSlot: taskSlotRelease,
      })
    })

    return {
      taskId: task.id,
      task,
      model,
      costCredits,
      generationTimeoutSeconds: settings.generationTimeoutSeconds,
      generationInput,
      started: true,
    }
  } catch (error) {
    releaseTaskSlot?.()
    throw error
  }
}

export default router
