import { Router } from 'express'
import { z } from 'zod'
import { requireUser, resLocals } from '../auth.js'
import { env } from '../env.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import { getPlatformSettings } from '../settings.js'

const router = Router()

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

function normalizeImageResponse(payload: unknown): Array<{ dataUrl: string; mimeType: string }> {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}
  const data = Array.isArray(record.data) ? record.data : []
  return data.flatMap((item) => {
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

async function callImagesApi(
  input: z.infer<typeof generationSchema>,
  upstream: { model: string; baseUrl: string; apiKey: string },
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
      const message = (payload as any)?.error?.message || '上游图像编辑请求失败'
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
    const message = (payload as any)?.error?.message || '上游图像生成请求失败'
    throw new HttpError(response.status, 'upstream_error', message)
  }
  return normalizeImageResponse(payload)
}

router.post('/', requireUser, async (req, res, next) => {
  const user = resLocals(req).user!
  let taskId: string | null = null
  let costCredits = 0

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

    costCredits = model.costCredits
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
          prompt: input.prompt,
          params: input.params,
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
    taskId = task.id

    const upstream = model.upstreamProvider?.enabled
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
    const images = await callImagesApi(input, upstream)
    const finished = await prisma.$transaction(async (tx) => {
      await tx.generationTask.update({
        where: { id: task.id },
        data: {
          status: 'done',
          outputImages: images,
          finishedAt: new Date(),
        },
      })
      return tx.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, role: true, creditBalance: true },
      })
    })

    sendOk(res, {
      taskId: task.id,
      images,
      model: {
        id: model.id,
        displayName: model.displayName,
        costCredits: model.costCredits,
      },
      user: finished,
      responseMeta: {
        appliedImageParams: {
          size: input.params.size,
          quality: input.params.quality,
          output_format: input.params.output_format,
        },
      },
    })
  } catch (error) {
    if (taskId && costCredits > 0) {
      const failedTaskId = taskId
      await prisma.$transaction(async (tx) => {
        const latestUser = await tx.user.update({
          where: { id: user.id },
          data: { creditBalance: { increment: costCredits } },
          select: { creditBalance: true },
        })
        await tx.creditLedger.create({
          data: {
            userId: user.id,
            delta: costCredits,
            reason: '生成失败退回积分',
            taskId: failedTaskId,
            balanceAfter: latestUser.creditBalance,
          },
        })
        await tx.generationTask.update({
          where: { id: failedTaskId },
          data: {
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
            finishedAt: new Date(),
          },
        })
      })
    }
    next(error)
  }
})

export default router
