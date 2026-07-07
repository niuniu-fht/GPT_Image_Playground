import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { requireUser, resLocals } from '../auth.js'
import { env } from '../env.js'
import { replaceGeneratedAssetsForTask } from '../generatedAssets.js'
import { HttpError, sendOk } from '../http.js'
import { isGptImage2Model, resolveModelCostForSize, supportsHighQualityPricing } from '../modelCost.js'
import { prisma } from '../prisma.js'
import { getPlatformSettings } from '../settings.js'
import { autoUploadGeneratedImagesToSquare } from '../squareAutoUpload.js'

const router = Router()
const MAX_UPSTREAM_IMAGE_COUNT = 10

const taskParamsSchema = z.object({
  size: z.string().default('auto'),
  quality: z.string().default('auto'),
  output_format: z.string().default('png'),
  output_compression: z.number().nullable().optional(),
  moderation: z.string().default('auto'),
  n: z.number().int().min(1).max(10).default(1),
})

const generationSchema = z.object({
  modelConfigId: z.string().min(1),
  prompt: z.string().min(1, '请输入提示词'),
  params: taskParamsSchema,
  inputImages: z.array(z.object({ id: z.string(), dataUrl: z.string() })).default([]),
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
type GenerationModel = Prisma.ModelConfigGetPayload<{ include: { upstreamProvider: true } }>
type GenerationUpstream = { model: string; baseUrl: string; apiKey: string }
type GeneratedImagePayload = { dataUrl: string; index?: number; mimeType: string }
type GenerationImageResult =
  | { index: number; status: 'done'; mimeType: string }
  | { error: string; httpStatus?: number; index: number; status: 'error' }
type StoredGenerationImageResult =
  | { dataUrl: string; index: number; mimeType: string; status: 'done' }
  | { error: string; index: number; status: 'error' }

const GENERIC_GENERATION_FAILURE_MESSAGE = '生成失败，请稍后重试'
const UPSTREAM_FALLBACK_RETRY_COUNT = 1

function publicUser(user: { id: string; email: string; role: string; creditBalance: number }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    creditBalance: user.creditBalance,
  }
}

function resolveGenerationUpstream(model: GenerationModel): GenerationUpstream {
  return model.upstreamProvider?.enabled
    ? {
        model: model.upstreamModel,
        baseUrl: model.upstreamProvider.baseUrl,
        apiKey: model.upstreamProvider.apiKey,
      }
    : {
        model: model.upstreamModel,
        baseUrl: env.openaiBaseUrl,
        apiKey: env.openaiApiKey,
      }
}

function normalizeTaskImages(outputImages: unknown): GeneratedImagePayload[] {
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

function getGenerationFailureMessage(error: unknown): string {
  if (error instanceof HttpError) {
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

function dataUrlToFile(dataUrl: string, filename: string): File {
  const match = /^data:([^;,]+)(?:;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) throw new HttpError(400, 'invalid_image', '参考图格式无效')
  const mimeType = match[1] || 'image/png'
  const body = match[2] || ''
  const bytes = dataUrl.includes(';base64,')
    ? Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body))
  return new File([bytes], filename, { type: mimeType })
}

async function remoteImageUrlToDataUrl(url: string, fallbackMimeType: string): Promise<GeneratedImagePayload> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new HttpError(response.status, 'upstream_image_download_failed', '上游图片下载失败，请稍后重试')
  }

  const arrayBuffer = await response.arrayBuffer()
  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || fallbackMimeType
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
  }
}

async function normalizeImageResponse(payload: unknown): Promise<GeneratedImagePayload[]> {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const data = Array.isArray(record.data) ? record.data : []
  const images = data.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const image = item as Record<string, unknown>
    if (typeof image.b64_json === 'string') {
      return [{ dataUrl: `data:image/png;base64,${image.b64_json}`, mimeType: 'image/png' }]
    }
    if (typeof image.url === 'string') {
      return [{ dataUrl: image.url, mimeType: 'image/png' }]
    }
    return []
  })

  return Promise.all(
    images.map((image) => (
      /^https?:\/\//i.test(image.dataUrl)
        ? remoteImageUrlToDataUrl(image.dataUrl, image.mimeType)
        : image
    )),
  )
}

async function checkModerationRules(prompt: string) {
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

function withImageCount(input: GenerationInput, n: number): GenerationInput {
  return {
    ...input,
    params: {
      ...input.params,
      n,
    },
  }
}

function resolveEffectiveQuality(model: GenerationModel, quality: string): string {
  if (!isGptImage2Model(model)) return 'medium'
  if (quality === 'low') return 'low'
  if (quality === 'high' && supportsHighQualityPricing(model)) return 'high'
  return 'medium'
}

async function callImagesApiOnce(
  input: GenerationInput,
  upstream: GenerationUpstream,
) {
  if (!upstream.apiKey) {
    throw new HttpError(500, 'missing_upstream_key', '服务端尚未配置 OPENAI_API_KEY')
  }

  const baseUrl = upstream.baseUrl.replace(/\/+$/, '')
  const headers = { Authorization: `Bearer ${upstream.apiKey}` }
  const hasInputImages = input.inputImages.length > 0

  if (hasInputImages) {
    const form = new FormData()
    form.set('model', upstream.model)
    form.set('prompt', input.prompt)
    form.set('size', input.params.size)
    form.set('quality', input.params.quality)
    form.set('n', String(input.params.n))
    input.inputImages.forEach((image, index) => {
      form.append('image[]', dataUrlToFile(image.dataUrl, `input-${index}.png`))
    })
    if (input.editMask?.dataUrl) {
      form.set('mask', dataUrlToFile(input.editMask.dataUrl, 'mask.png'))
    }

    const response = await fetch(`${baseUrl}/v1/images/edits`, {
      method: 'POST',
      headers,
      body: form,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
        ? (payload as { error: { message: string } }).error.message
        : '上游图像编辑请求失败'
      throw new HttpError(response.status, 'upstream_error', message)
    }
    return normalizeImageResponse(payload)
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
  if (typeof input.params.output_compression === 'number') {
    body.output_compression = input.params.output_compression
  }

  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof (payload as { error?: { message?: unknown } }).error?.message === 'string'
      ? (payload as { error: { message: string } }).error.message
      : '上游图像生成请求失败'
    throw new HttpError(response.status, 'upstream_error', message)
  }
  return normalizeImageResponse(payload)
}

async function callSingleImageApi(
  input: GenerationInput,
  upstream: GenerationUpstream,
): Promise<GeneratedImagePayload> {
  let lastError: unknown = null
  for (let attempt = 0; attempt <= UPSTREAM_FALLBACK_RETRY_COUNT; attempt += 1) {
    try {
      const images = await callImagesApiOnce(withImageCount(input, 1), upstream)
      const image = images[0]
      if (!image) {
        throw new HttpError(502, 'upstream_no_images', GENERIC_GENERATION_FAILURE_MESSAGE)
      }
      return image
    } catch (error) {
      lastError = error
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
  input: GenerationInput,
  upstream: GenerationUpstream,
) {
  const requestedCount = clampImageCount(input.params.n)
  const settled = await Promise.allSettled(
    Array.from({ length: requestedCount }, (_item, index) => (
      callSingleImageApi(input, upstream).then((image) => ({ image, index }))
    )),
  )
  const imageResults: GenerationImageResult[] = []
  const images: GeneratedImagePayload[] = []

  settled.forEach((result, fallbackIndex) => {
    const index = result.status === 'fulfilled' ? result.value.index : fallbackIndex
    if (result.status === 'fulfilled') {
      images.push({ ...result.value.image, index })
      imageResults.push({
        index,
        status: 'done',
        mimeType: result.value.image.mimeType,
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
    const latestUser = await tx.user.update({
      where: { id: input.userId },
      data: { creditBalance: { increment: input.costCredits } },
      select: { creditBalance: true },
    })
    await tx.creditLedger.create({
      data: {
        userId: input.userId,
        delta: input.costCredits,
        reason: '生成失败退回积分',
        taskId: input.taskId,
        balanceAfter: latestUser.creditBalance,
      },
    })
    await tx.generationTask.update({
      where: { id: input.taskId },
      data: {
        status: 'error',
        error: getGenerationFailureMessage(input.error),
        finishedAt: new Date(),
      },
    })
  })
}

async function runGenerationTask(input: {
  costCredits: number
  generationInput: GenerationInput
  model: GenerationModel
  taskId: string
  userId: string
}) {
  try {
    const generationResult = await callImagesApi(input.generationInput, resolveGenerationUpstream(input.model))
    const upstreamImages = generationResult.images
    let squareUploadError: string | null = null
    const squareUpload = await autoUploadGeneratedImagesToSquare({
      userId: input.userId,
      taskId: input.taskId,
      prompt: input.generationInput.prompt,
      params: input.generationInput.params,
      images: upstreamImages,
    }).catch((error: unknown) => {
      squareUploadError = error instanceof Error ? error.message : String(error)
      console.warn('[square] auto upload failed', squareUploadError)
      return null
    })
    const images = squareUpload?.assetUrls?.length
      ? upstreamImages.map((image, index): StoredGenerationImageResult => ({
          ...image,
          index: image.index ?? index,
          dataUrl: squareUpload.assetUrls?.[index] ?? image.dataUrl,
          status: 'done',
        }))
      : upstreamImages.map((image, index): StoredGenerationImageResult => ({
          ...image,
          index: image.index ?? index,
          status: 'done',
        }))
    const failedImages = generationResult.imageResults
      .filter((item): item is Extract<GenerationImageResult, { status: 'error' }> => item.status === 'error')
      .map((item): StoredGenerationImageResult => ({
        index: item.index,
        status: 'error',
        error: item.error,
      }))
    const outputImages = [...images, ...failedImages].sort((left, right) => left.index - right.index)
    const refundCredits = generationResult.requestedCount > 0 && failedImages.length > 0
      ? (input.costCredits / generationResult.requestedCount) * failedImages.length
      : 0
    const chargedCredits = input.costCredits - refundCredits

    await prisma.$transaction(async (tx) => {
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
      await tx.generationTask.update({
        where: { id: input.taskId },
        data: {
          status: 'done',
          costCredits: chargedCredits,
          error: squareUploadError,
          outputImages,
          finishedAt: new Date(),
        },
      })
      await replaceGeneratedAssetsForTask(tx, {
        taskId: input.taskId,
        userId: input.userId,
        uploadMode: squareUpload?.mode ?? null,
        assets: squareUpload?.assets,
      })
    })

    if (squareUploadError) {
      console.warn('[square] generated image upload completed with warning', squareUploadError)
    }
  } catch (error) {
    console.error('[generation] async task failed', {
      taskId: input.taskId,
      error,
    })
    await refundFailedGeneration({
      taskId: input.taskId,
      userId: input.userId,
      costCredits: input.costCredits,
      error,
    }).catch((refundError: unknown) => {
      console.error('[generation] failed to refund failed task', {
        taskId: input.taskId,
        refundError,
      })
    })
  }
}

router.get('/:taskId', requireUser, async (req, res, next) => {
  const user = resLocals(req).user!
  try {
    const taskId = typeof req.params.taskId === 'string' ? req.params.taskId : ''
    const task = await prisma.generationTask.findFirst({
      where: { id: taskId, userId: user.id },
    })
    if (!task) throw new HttpError(404, 'task_not_found', '生成任务不存在或已被清理')

    const [latestUser, model] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, role: true, creditBalance: true },
      }),
      prisma.modelConfig.findUnique({
        where: { id: task.modelConfigId },
        select: { id: true, displayName: true },
      }),
    ])

    sendOk(res, {
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
        squareUploadError: task.status === 'done' ? task.error : null,
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
    })
  } catch (error) {
    next(error)
  }
})

router.post('/', requireUser, async (req, res, next) => {
  const user = resLocals(req).user!

  try {
    const input = generationSchema.parse(req.body)
    const settings = await getPlatformSettings()
    if (!settings.generationEnabled) {
      throw new HttpError(503, 'generation_closed', settings.maintenanceMessage || '当前生成服务维护中，请稍后再试')
    }
    const model = await prisma.modelConfig.findFirst({
      where: { id: input.modelConfigId, enabled: true },
      include: { upstreamProvider: true },
    })
    if (!model) throw new HttpError(404, 'model_not_found', '模型不可用或不存在')
    if (model.apiProtocol !== 'images') {
      throw new HttpError(400, 'unsupported_protocol', '当前后端第一版仅支持 Images API 模型')
    }
    await checkModerationRules(input.prompt)

    const generationInput: GenerationInput = {
      ...input,
      params: {
        ...input.params,
        quality: resolveEffectiveQuality(model, input.params.quality),
      },
    }
    const requestedCount = clampImageCount(generationInput.params.n)
    const costCredits = resolveModelCostForSize(model, generationInput.params.size, generationInput.params.quality) * requestedCount
    const task = await prisma.$transaction(async (tx) => {
      const latestUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { creditBalance: true },
      })
      if (!latestUser) throw new HttpError(401, 'unauthorized', '登录状态已失效')
      if (latestUser.creditBalance < costCredits) {
        throw new HttpError(402, 'insufficient_credits', '积分不足，请联系管理员补充积分')
      }

      const nextBalance = latestUser.creditBalance - costCredits
      await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: nextBalance },
      })
      const createdTask = await tx.generationTask.create({
        data: {
          userId: user.id,
          modelConfigId: model.id,
          prompt: generationInput.prompt,
          params: generationInput.params,
          status: 'running',
          costCredits,
        },
      })
      await tx.creditLedger.create({
        data: {
          userId: user.id,
          delta: -costCredits,
          reason: `生成消耗：${model.displayName}`,
          taskId: createdTask.id,
          balanceAfter: nextBalance,
        },
      })
      return createdTask
    })

    const latestUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, role: true, creditBalance: true },
    })

    sendOk(res, {
      taskId: task.id,
      status: task.status,
      images: [],
      model: {
        id: model.id,
        displayName: model.displayName,
        costCredits,
      },
      user: latestUser ? publicUser(latestUser) : null,
      responseMeta: {
        pending: true,
        appliedImageParams: {
          size: generationInput.params.size,
          quality: generationInput.params.quality,
          output_format: generationInput.params.output_format,
        },
      },
    })

    setImmediate(() => {
      void runGenerationTask({
        taskId: task.id,
        userId: user.id,
        generationInput,
        model,
        costCredits,
      })
    })
  } catch (error) {
    next(error)
  }
})

export default router
