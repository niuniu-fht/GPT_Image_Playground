import type { Request, Response } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { requireUser, resLocals } from '../auth.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import { getPlatformSettings } from '../settings.js'

const router = Router()

const CHAT_TIMEOUT_MS = 120_000
const MAX_HISTORY_MESSAGES = 30
const MAX_IMAGES_PER_REQUEST = 3
const MAX_IMAGE_DATA_URL_LENGTH = 6 * 1024 * 1024
const MAX_TEXT_CHARS_PER_MESSAGE = 16_000

const contentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().max(MAX_TEXT_CHARS_PER_MESSAGE) }),
  z.object({
    type: z.literal('image_url'),
    image_url: z.object({ url: z.string().max(MAX_IMAGE_DATA_URL_LENGTH) }),
  }),
])

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.union([z.string().max(MAX_TEXT_CHARS_PER_MESSAGE), z.array(contentPartSchema).max(4)]),
      }),
    )
    .min(1)
    .max(MAX_HISTORY_MESSAGES),
})

type UpstreamContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type UpstreamChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | UpstreamContentPart[]
}

/** 每用户滑动窗口限流（内存实现，单进程足够）。 */
const rateLimitWindows = new Map<string, number[]>()

function isRateLimited(userId: string, limitPerMinute: number): boolean {
  if (limitPerMinute <= 0) return false
  const now = Date.now()
  const windowStart = now - 60_000
  const timestamps = (rateLimitWindows.get(userId) ?? []).filter((ts) => ts > windowStart)
  if (timestamps.length >= limitPerMinute) {
    rateLimitWindows.set(userId, timestamps)
    return true
  }
  timestamps.push(now)
  rateLimitWindows.set(userId, timestamps)
  return false
}

/** 解析上游 OpenAI 兼容 chat completions 地址：容忍带 /v1 或完整路径的 baseUrl。 */
export function buildChatCompletionsEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed
  const withoutVersion = trimmed.replace(/\/v1$/i, '')
  return `${withoutVersion}/v1/chat/completions`
}

async function resolveChatUpstream() {
  const settings = await getPlatformSettings()
  const providers = await prisma.upstreamProvider.findMany({
    where: { enabled: true },
    orderBy: { priority: 'asc' },
  })
  const configured = settings.chatProviderId
    ? providers.find((provider) => provider.id === settings.chatProviderId)
    : undefined
  const provider = configured ?? providers[0]
  if (!provider) {
    throw new HttpError(503, 'chat_unavailable', '对话功能未配置上游服务，请联系管理员')
  }
  return {
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    model: settings.chatModel.trim(),
  }
}

function normalizeHistoryMessages(
  messages: Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  systemPrompt: string,
): UpstreamChatMessage[] {
  const history: UpstreamChatMessage[] = messages.map((message) => {
    if (typeof message.content === 'string') {
      return { role: message.role, content: message.content }
    }
    const parts: UpstreamContentPart[] = []
    let imageCount = 0
    for (const part of message.content) {
      if (part.type === 'text' && typeof part.text === 'string') {
        parts.push({ type: 'text', text: part.text })
      } else if (
        part.type === 'image_url' &&
        typeof part.image_url?.url === 'string' &&
        imageCount < MAX_IMAGES_PER_REQUEST
      ) {
        imageCount += 1
        parts.push({ type: 'image_url', image_url: { url: part.image_url.url } })
      }
    }
    return { role: message.role, content: parts.length > 0 ? parts : '' }
  })
  if (systemPrompt.trim()) {
    return [{ role: 'system', content: systemPrompt.trim() }, ...history]
  }
  return history
}

/** 公开状态：前台用于展示功能入口是否可用（不暴露模型与上游信息）。 */
router.get('/status', async (_req: Request, res: Response, next) => {
  try {
    const settings = await getPlatformSettings()
    sendOk(res, {
      enabled: settings.chatEnabled,
      costCredits: settings.chatCostCredits,
      freePromotion: settings.chatFreePromotionEnabled,
    })
  } catch (error) {
    next(error)
  }
})

/** 扣除 AI 对话积分；余额不足抛 402。返回扣费后的余额。 */
async function chargeChatCredits(userId: string, cost: number): Promise<number> {
  if (cost <= 0) return 0
  return prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    })
    if (!currentUser || currentUser.creditBalance < cost) {
      throw new HttpError(402, 'insufficient_credits', `积分不足，AI 提示词每次需要 ${cost} 积分`)
    }
    const updated = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: cost } },
      select: { creditBalance: true },
    })
    await tx.creditLedger.create({
      data: { userId, delta: -cost, reason: 'AI 对话消耗', balanceAfter: updated.creditBalance },
    })
    return updated.creditBalance
  })
}

/** AI 对话失败退回积分（与生成失败退回同一套流水语义）。 */
async function refundChatCredits(userId: string, cost: number): Promise<void> {
  if (cost <= 0) return
  await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: cost } },
      select: { creditBalance: true },
    })
    await tx.creditLedger.create({
      data: { userId, delta: cost, reason: 'AI 对话失败退回积分', balanceAfter: updated.creditBalance },
    })
  })
}

router.post('/completions', requireUser, async (req: Request, res: Response, next) => {
  const controller = new AbortController()
  let clientDisconnected = false
  req.on('close', () => {
    clientDisconnected = true
    controller.abort()
  })

  try {
    const settings = await getPlatformSettings()
    if (!settings.chatEnabled) {
      throw new HttpError(403, 'chat_disabled', '对话功能暂未开放，请联系管理员')
    }
    const user = resLocals(req).user
    if (!user) {
      throw new HttpError(401, 'unauthorized', '请先登录后再继续')
    }
    if (isRateLimited(user.id, settings.chatMaxRequestsPerMinute)) {
      throw new HttpError(429, 'chat_rate_limited', '对话太快啦，请稍等一分钟再试')
    }

    const parsed = chatRequestSchema.parse(req.body)
    const upstream = await resolveChatUpstream()
    if (!upstream.model) {
      throw new HttpError(503, 'chat_model_missing', '对话模型未配置，请联系管理员')
    }

    // 先扣费再调用上游；限时免费期间不扣积分；上游失败/流中断自动退回（用户主动停止不退）
    const chatCost = settings.chatFreePromotionEnabled ? 0 : settings.chatCostCredits
    await chargeChatCredits(user.id, chatCost)

    const upstreamMessages = normalizeHistoryMessages(parsed.messages, settings.chatSystemPrompt)
    const timeoutTimer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

    let upstreamResponse: globalThis.Response
    try {
      upstreamResponse = await fetch(buildChatCompletionsEndpoint(upstream.baseUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${upstream.apiKey}`,
        },
        body: JSON.stringify({
          model: upstream.model,
          messages: upstreamMessages,
          stream: true,
          temperature: 0.7,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      clearTimeout(timeoutTimer)
      if (clientDisconnected) return
      await refundChatCredits(user.id, chatCost).catch((refundError: unknown) => {
        console.error('[chat] refund failed', refundError)
      })
      throw new HttpError(502, 'chat_upstream_unreachable', '对话服务暂时不可用，请稍后重试')
    }

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      clearTimeout(timeoutTimer)
      if (clientDisconnected) return
      const detail = await upstreamResponse.text().catch(() => '')
      console.error('[chat] upstream error', upstreamResponse.status, detail.slice(0, 500))
      await refundChatCredits(user.id, chatCost).catch((refundError: unknown) => {
        console.error('[chat] refund failed', refundError)
      })
      throw new HttpError(502, 'chat_upstream_error', '对话服务返回错误，请稍后重试')
    }

    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    res.write(': connected\n\n')

    const reader = upstreamResponse.body.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done || clientDisconnected) break
        res.write(value)
        if (typeof (res as { flush?: unknown }).flush === 'function') {
          ;(res as unknown as { flush: () => void }).flush()
        }
      }
    } catch (error) {
      if (!clientDisconnected) {
        console.error('[chat] upstream stream error', error)
        await refundChatCredits(user.id, chatCost).catch((refundError: unknown) => {
          console.error('[chat] refund failed', refundError)
        })
        res.write(`data: ${JSON.stringify({ __error: '对话流中断，本次积分已退回' })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
      }
    } finally {
      clearTimeout(timeoutTimer)
      reader.releaseLock()
    }

    if (!clientDisconnected && !res.writableEnded) {
      // 上游偶尔漏发 [DONE]，补一个，前端据此收尾（重复的 [DONE] 对解析无害）
      res.write('data: [DONE]\n\n')
      res.end()
    }
  } catch (error) {
    next(error)
  }
})

export default router
