import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import {
  adminGenerationTaskSelect,
  toAdminGenerationTask,
  toAdminGenerationTasks,
} from '../adminGenerationTasks.js'
import { requireAdmin, resLocals } from '../auth.js'
import { cleanupGeneratedAssetsForTasks } from '../generatedAssetCleanup.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import { getPlatformSettings, toAdminPlatformSettingsView, upsertPlatformSettings } from '../settings.js'
import { consumeSub2ApiRedeemCode } from '../sub2apiRedeem.js'

const router = Router()
router.use(requireAdmin)

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function readPagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page) || 1, 1)
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 100)
  return { page, pageSize, skip: (page - 1) * pageSize }
}

function maskProvider(provider: { apiKey: string }) {
  const visible = provider.apiKey ? `${provider.apiKey.slice(0, 4)}...${provider.apiKey.slice(-4)}` : ''
  return { ...provider, apiKey: visible }
}

function getUpstreamErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: unknown } }).error
    if (typeof error?.message === 'string') return error.message
  }
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return fallback
}

interface UpstreamModelOption {
  id: string
  ownedBy?: string
  created?: number
}

function readUpstreamModelOptions(payload: unknown): UpstreamModelOption[] {
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) {
    return []
  }
  return (payload as { data: unknown[] }).data
    .map((item): UpstreamModelOption | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as { id?: unknown; owned_by?: unknown; created?: unknown }
      if (typeof record.id !== 'string' || !record.id.trim()) return null
      return {
        id: record.id,
        ownedBy: typeof record.owned_by === 'string' ? record.owned_by : undefined,
        created: typeof record.created === 'number' ? record.created : undefined,
      }
    })
    .filter((item): item is UpstreamModelOption => item !== null)
}

async function fetchUpstreamModels(provider: { baseUrl: string; apiKey: string; timeoutSeconds: number }) {
  if (!provider.apiKey) {
    throw new HttpError(400, 'missing_api_key', '渠道尚未配置 API Key，无法拉取模型列表')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.min(provider.timeoutSeconds, 20) * 1000)
  try {
    const baseUrl = provider.baseUrl.replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    const payload = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      throw new HttpError(response.status, 'upstream_models_failed', getUpstreamErrorMessage(payload, `渠道返回 HTTP ${response.status}`))
    }
    return readUpstreamModelOptions(payload)
  } catch (error) {
    if (error instanceof HttpError) throw error
    const isAbort = error instanceof Error && error.name === 'AbortError'
    throw new HttpError(502, 'upstream_models_failed', isAbort ? '拉取模型列表超时，请检查渠道网络或超时时间' : error instanceof Error ? error.message : '拉取模型列表失败')
  } finally {
    clearTimeout(timeout)
  }
}

async function testUpstreamProvider(provider: { baseUrl: string; apiKey: string; timeoutSeconds: number }) {
  if (!provider.apiKey) {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      message: '渠道尚未配置 API Key',
    }
  }

  const startedAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.min(provider.timeoutSeconds, 15) * 1000)
  try {
    const baseUrl = provider.baseUrl.replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    const payload = (await response.json().catch(() => null)) as unknown
    const models = readUpstreamModelOptions(payload).length || undefined
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      modelCount: models,
      message: response.ok ? '连接成功，渠道可访问模型列表' : getUpstreamErrorMessage(payload, `渠道返回 HTTP ${response.status}`),
    }
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError'
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      message: isAbort ? '连接超时，请检查 Base URL、网络或渠道状态' : error instanceof Error ? error.message : '渠道连接失败',
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function testAndUpdateUpstreamProvider(provider: { id: string; baseUrl: string; apiKey: string; timeoutSeconds: number }) {
  const result = await testUpstreamProvider(provider)
  await prisma.upstreamProvider.update({
    where: { id: provider.id },
    data: {
      lastCheckedAt: new Date(result.checkedAt),
      lastHealthStatus: result.ok ? 'healthy' : 'error',
      lastLatencyMs: result.latencyMs,
      lastHttpStatus: result.status || null,
      lastHealthMessage: result.message,
    },
  })
  return result
}

router.get('/overview', async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7)
    const dayStarts = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (6 - index))
      return date
    })
    const dayEnds = dayStarts.map((date, index) => {
      const end = new Date(date)
      end.setDate(end.getDate() + 1)
      return index === dayStarts.length - 1 ? new Date() : end
    })

    const yesterday = new Date(Date.now() - 1000 * 60 * 60 * 24)

    const [
      users,
      disabledUsers,
      models,
      providers,
      runningTasks,
      totalTasks,
      failedTasks,
      failedTasks24h,
      pendingOrders,
      openTickets,
      riskyUsers,
      unhealthyProviders,
      activeModerationRules,
      creditAgg,
      creditIncomeAgg,
      recentTasks,
      recentUsers,
      recentPendingOrders,
      recentOpenTickets,
      recentUnhealthyProviders,
      modelUsage,
      providerSummaries,
    ] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { status: 'disabled' } }),
        prisma.modelConfig.count({ where: { enabled: true } }),
        prisma.upstreamProvider.count({ where: { enabled: true } }),
        prisma.generationTask.count({ where: { status: 'running' } }),
        prisma.generationTask.count({ where: { createdAt: { gte: since } } }),
        prisma.generationTask.count({ where: { createdAt: { gte: since }, status: 'error' } }),
        prisma.generationTask.count({ where: { createdAt: { gte: yesterday }, status: 'error' } }),
        prisma.creditOrder.count({ where: { status: 'pending' } }),
        prisma.supportTicket.count({ where: { status: { in: ['open', 'in_progress'] } } }),
        prisma.user.count({ where: { OR: [{ status: 'disabled' }, { segment: 'risk' }] } }),
        prisma.upstreamProvider.count({ where: { OR: [{ enabled: false }, { lastHealthStatus: 'error' }] } }),
        prisma.moderationRule.count({ where: { enabled: true } }),
        prisma.creditLedger.aggregate({ where: { createdAt: { gte: since }, delta: { lt: 0 } }, _sum: { delta: true } }),
        prisma.creditLedger.aggregate({ where: { createdAt: { gte: since }, delta: { gt: 0 } }, _sum: { delta: true } }),
        prisma.generationTask.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: adminGenerationTaskSelect,
        }),
        prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            segment: true,
            adminNote: true,
            creditBalance: true,
            lastLoginAt: true,
            loginCount: true,
            createdAt: true,
            _count: { select: { tasks: true, ledgers: true } },
          },
        }),
        prisma.creditOrder.findMany({
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { user: { select: { email: true, status: true, segment: true } } },
        }),
        prisma.supportTicket.findMany({
          where: { status: { in: ['open', 'in_progress'] } },
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          take: 5,
          include: { user: { select: { email: true, status: true, segment: true } } },
        }),
        prisma.upstreamProvider.findMany({
          where: { OR: [{ enabled: false }, { lastHealthStatus: 'error' }] },
          orderBy: [{ enabled: 'asc' }, { updatedAt: 'desc' }],
          take: 5,
          select: {
            id: true,
            name: true,
            baseUrl: true,
            enabled: true,
            priority: true,
            timeoutSeconds: true,
            lastCheckedAt: true,
            lastHealthStatus: true,
            lastLatencyMs: true,
            lastHttpStatus: true,
            lastHealthMessage: true,
          },
        }),
        prisma.generationTask.groupBy({
          by: ['modelConfigId'],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
          _sum: { costCredits: true },
          orderBy: { _count: { modelConfigId: 'desc' } },
          take: 6,
        }),
        prisma.upstreamProvider.findMany({
          orderBy: [{ enabled: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
          take: 6,
          select: {
            id: true,
            name: true,
            baseUrl: true,
            enabled: true,
            priority: true,
            timeoutSeconds: true,
            _count: { select: { models: true } },
          },
        }),
      ])

    const [trend, modelConfigs] = await Promise.all([
      Promise.all(dayStarts.map(async (start, index) => {
        const end = dayEnds[index]
        const [newUsers, tasks, failed, creditsSpent, creditsIncome] = await Promise.all([
          prisma.user.count({ where: { createdAt: { gte: start, lt: end } } }),
          prisma.generationTask.count({ where: { createdAt: { gte: start, lt: end } } }),
          prisma.generationTask.count({ where: { createdAt: { gte: start, lt: end }, status: 'error' } }),
          prisma.creditLedger.aggregate({ where: { createdAt: { gte: start, lt: end }, delta: { lt: 0 } }, _sum: { delta: true } }),
          prisma.creditLedger.aggregate({ where: { createdAt: { gte: start, lt: end }, delta: { gt: 0 } }, _sum: { delta: true } }),
        ])
        return {
          date: start.toISOString().slice(0, 10),
          newUsers,
          tasks,
          failedTasks: failed,
          creditsSpent: Math.abs(creditsSpent._sum.delta ?? 0),
          creditsIncome: creditsIncome._sum.delta ?? 0,
        }
      })),
      prisma.modelConfig.findMany({
        where: { id: { in: modelUsage.map((item) => item.modelConfigId) } },
        select: { id: true, displayName: true, name: true, enabled: true },
      }),
    ])
    const modelMap = new Map(modelConfigs.map((model) => [model.id, model]))

    sendOk(res, {
      stats: {
        users,
        disabledUsers,
        enabledModels: models,
        enabledProviders: providers,
        runningTasks,
        tasks7d: totalTasks,
        failedTasks7d: failedTasks,
        creditsConsumed7d: Math.abs(creditAgg._sum.delta ?? 0),
        creditsIncome7d: creditIncomeAgg._sum.delta ?? 0,
      },
      workbench: {
        pendingOrders,
        openTickets,
        failedTasks24h,
        riskyUsers,
        unhealthyProviders,
        activeModerationRules,
        recentPendingOrders,
        recentOpenTickets,
        recentUnhealthyProviders,
      },
      trend,
      modelUsage: modelUsage.map((item) => ({
        modelConfigId: item.modelConfigId,
        displayName: modelMap.get(item.modelConfigId)?.displayName ?? '未知模型',
        name: modelMap.get(item.modelConfigId)?.name ?? item.modelConfigId,
        enabled: modelMap.get(item.modelConfigId)?.enabled ?? false,
        tasks: item._count._all,
        credits: item._sum.costCredits ?? 0,
      })),
      providerSummaries,
      recentUsers,
      recentTasks: toAdminGenerationTasks(recentTasks),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/reports/usage', async (req, res, next) => {
  try {
    const rawFrom = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : null
    const rawTo = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : null
    const to = rawTo && !Number.isNaN(rawTo.getTime()) ? rawTo : new Date()
    const from = rawFrom && !Number.isNaN(rawFrom.getTime()) ? rawFrom : new Date(to.getTime() - 1000 * 60 * 60 * 24 * 29)
    const dayStarts: Date[] = []
    const cursor = new Date(from)
    cursor.setHours(0, 0, 0, 0)
    while (cursor <= to && dayStarts.length < 62) {
      dayStarts.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    const rangeWhere = { createdAt: { gte: from, lte: to } }

    const [
      totalTasks,
      doneTasks,
      errorTasks,
      runningTasks,
      creditAgg,
      modelUsage,
      userUsage,
      models,
      trend,
    ] = await Promise.all([
      prisma.generationTask.count({ where: rangeWhere }),
      prisma.generationTask.count({ where: { ...rangeWhere, status: 'done' } }),
      prisma.generationTask.count({ where: { ...rangeWhere, status: 'error' } }),
      prisma.generationTask.count({ where: { ...rangeWhere, status: 'running' } }),
      prisma.generationTask.aggregate({ where: rangeWhere, _sum: { costCredits: true } }),
      prisma.generationTask.groupBy({
        by: ['modelConfigId'],
        where: rangeWhere,
        _count: { _all: true },
        _sum: { costCredits: true },
      }),
      prisma.generationTask.groupBy({
        by: ['userId'],
        where: rangeWhere,
        _count: { _all: true },
        _sum: { costCredits: true },
      }),
      prisma.modelConfig.findMany({
        include: {
          upstreamProvider: {
            select: {
              id: true,
              name: true,
              baseUrl: true,
              enabled: true,
              lastHealthStatus: true,
            },
          },
        },
      }),
      Promise.all(dayStarts.map(async (start) => {
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        const dayWhere = { createdAt: { gte: start, lt: end > to ? to : end } }
        const [tasks, done, error, running, credits] = await Promise.all([
          prisma.generationTask.count({ where: dayWhere }),
          prisma.generationTask.count({ where: { ...dayWhere, status: 'done' } }),
          prisma.generationTask.count({ where: { ...dayWhere, status: 'error' } }),
          prisma.generationTask.count({ where: { ...dayWhere, status: 'running' } }),
          prisma.generationTask.aggregate({ where: dayWhere, _sum: { costCredits: true } }),
        ])
        return {
          date: start.toISOString().slice(0, 10),
          tasks,
          done,
          error,
          running,
          credits: credits._sum.costCredits ?? 0,
        }
      })),
    ])

    const modelMap = new Map(models.map((model) => [model.id, model]))
    const users = await prisma.user.findMany({
      where: { id: { in: userUsage.map((item) => item.userId) } },
      select: { id: true, email: true, segment: true, status: true },
    })
    const userMap = new Map(users.map((user) => [user.id, user]))
    const providerUsageMap = new Map<string, {
      providerId: string | null
      name: string
      baseUrl: string
      enabled: boolean
      health: string
      tasks: number
      credits: number
      models: number
    }>()

    for (const item of modelUsage) {
      const model = modelMap.get(item.modelConfigId)
      const provider = model?.upstreamProvider
      const providerId = provider?.id ?? null
      const key = providerId ?? 'default'
      const current = providerUsageMap.get(key) ?? {
        providerId,
        name: provider?.name ?? '默认环境变量上游',
        baseUrl: provider?.baseUrl ?? 'OPENAI_BASE_URL / OPENAI_API_KEY',
        enabled: provider?.enabled ?? true,
        health: provider?.lastHealthStatus ?? 'unknown',
        tasks: 0,
        credits: 0,
        models: 0,
      }
      current.tasks += item._count._all
      current.credits += item._sum.costCredits ?? 0
      current.models += 1
      providerUsageMap.set(key, current)
    }

    sendOk(res, {
      range: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalTasks,
        doneTasks,
        errorTasks,
        runningTasks,
        successRate: totalTasks ? Math.round((doneTasks / totalTasks) * 1000) / 10 : 0,
        errorRate: totalTasks ? Math.round((errorTasks / totalTasks) * 1000) / 10 : 0,
        credits: creditAgg._sum.costCredits ?? 0,
        activeUsers: userUsage.length,
      },
      trend,
      modelUsage: [...modelUsage].sort((a, b) => b._count._all - a._count._all).slice(0, 20).map((item) => {
        const model = modelMap.get(item.modelConfigId)
        return {
          modelConfigId: item.modelConfigId,
          displayName: model?.displayName ?? '未知模型',
          name: model?.name ?? item.modelConfigId,
          upstreamModel: model?.upstreamModel ?? '',
          upstreamProviderName: model?.upstreamProvider?.name ?? '默认环境变量上游',
          enabled: model?.enabled ?? false,
          tasks: item._count._all,
          credits: item._sum.costCredits ?? 0,
        }
      }),
      providerUsage: Array.from(providerUsageMap.values()).sort((a, b) => b.tasks - a.tasks),
      userUsage: [...userUsage].sort((a, b) => b._count._all - a._count._all).slice(0, 20).map((item) => {
        const user = userMap.get(item.userId)
        return {
          userId: item.userId,
          email: user?.email ?? item.userId,
          segment: user?.segment ?? 'normal',
          status: user?.status ?? 'active',
          tasks: item._count._all,
          credits: item._sum.costCredits ?? 0,
        }
      }),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/users', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const role = typeof req.query.role === 'string' ? req.query.role.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : ''
    const segment = typeof req.query.segment === 'string' ? req.query.segment.trim() : ''
    const where = {
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { segment: { contains: q, mode: 'insensitive' as const } },
              { adminNote: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(role && role !== 'all' ? { role: role as 'user' | 'admin' } : {}),
      ...(status && status !== 'all' ? { status: status as 'active' | 'disabled' } : {}),
      ...(segment && segment !== 'all' ? { segment: segment as 'normal' | 'vip' | 'trial' | 'risk' } : {}),
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          segment: true,
          adminNote: true,
          creditBalance: true,
          lastLoginAt: true,
          loginCount: true,
          createdAt: true,
          _count: { select: { tasks: true, ledgers: true } },
        },
      }),
      prisma.user.count({ where }),
    ])
    sendOk(res, { items, total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

const userBatchStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  status: z.enum(['active', 'disabled']),
})

router.post('/users/batch/status', async (req, res, next) => {
  try {
    const input = userBatchStatusSchema.parse(req.body)
    const result = await prisma.user.updateMany({
      where: { id: { in: input.ids } },
      data: { status: input.status },
    })
    await writeAudit(req, 'user.batch.status', 'users', { ...input, affected: result.count })
    sendOk(res, { affected: result.count })
  } catch (error) {
    next(error)
  }
})

const userBatchCreditsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  delta: z.number().int().refine((value) => value !== 0, '积分变动不能为 0'),
  reason: z.string().min(1).max(120),
})

router.post('/users/batch/credits', async (req, res, next) => {
  try {
    const input = userBatchCreditsSchema.parse(req.body)
    const result = await prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: input.ids } },
        select: { id: true },
      })
      const updated = []
      for (const user of users) {
        const nextUser = await tx.user.update({
          where: { id: user.id },
          data: { creditBalance: { increment: input.delta } },
          select: { id: true, creditBalance: true },
        })
        await tx.creditLedger.create({
          data: {
            userId: user.id,
            delta: input.delta,
            reason: `管理员批量调整：${input.reason}`,
            balanceAfter: nextUser.creditBalance,
          },
        })
        updated.push(nextUser)
      }
      return updated
    })
    await writeAudit(req, 'user.batch.credit.adjust', 'users', {
      ids: input.ids,
      delta: input.delta,
      reason: input.reason,
      affected: result.length,
    })
    sendOk(res, { affected: result.length })
  } catch (error) {
    next(error)
  }
})

router.get('/users/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        segment: true,
        adminNote: true,
        creditBalance: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { tasks: true, ledgers: true } },
      },
    })
    if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在')

    const [tasks, ledgers, loginLogs, creditOrders, supportTickets, auditLogs] = await Promise.all([
      prisma.generationTask.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: adminGenerationTaskSelect,
      }),
      prisma.creditLedger.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.loginLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.creditOrder.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.supportTicket.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.auditLog.findMany({
        where: { target: id, action: { startsWith: 'user.' } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ])
    const auditActorIds = Array.from(new Set(auditLogs.map((item) => item.actorId).filter((actorId): actorId is string => Boolean(actorId))))
    const auditActors = auditActorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: auditActorIds } },
          select: { id: true, email: true, role: true, status: true },
        })
      : []
    const auditActorMap = new Map(auditActors.map((actor) => [actor.id, actor]))

    sendOk(res, {
      user,
      tasks: toAdminGenerationTasks(tasks),
      ledgers,
      loginLogs,
      creditOrders,
      supportTickets,
      auditLogs: auditLogs.map((item) => ({
        ...item,
        actor: item.actorId ? auditActorMap.get(item.actorId) ?? null : null,
      })),
    })
  } catch (error) {
    next(error)
  }
})

const userPatchSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  segment: z.enum(['normal', 'vip', 'trial', 'risk']).optional(),
  adminNote: z.string().max(500).optional(),
})

router.patch('/users/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = userPatchSchema.parse(req.body)
    const user = await prisma.user.update({ where: { id }, data: input })
    await writeAudit(req, 'user.update', id, input)
    sendOk(res, { user })
  } catch (error) {
    next(error)
  }
})

const userPasswordResetSchema = z.object({
  password: z.string().min(8, '密码至少 8 位').max(128, '密码最多 128 位'),
})

router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = userPasswordResetSchema.parse(req.body)
    const user = await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(input.password, 12) },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        segment: true,
        adminNote: true,
        creditBalance: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        _count: { select: { tasks: true, ledgers: true } },
      },
    })
    await writeAudit(req, 'user.password.reset', id, { email: user.email })
    sendOk(res, { user })
  } catch (error) {
    next(error)
  }
})

const creditAdjustSchema = z.object({
  delta: z.number().int().refine((value) => value !== 0, '积分变动不能为 0'),
  reason: z.string().min(1).max(120),
})

const redeemCodeSchema = z.object({
  code: z.string().min(3).max(80).regex(/^[A-Za-z0-9_-]+$/, '兑换码只能包含字母、数字、下划线和短横线'),
  name: z.string().min(1).max(80),
  credits: z.number().int().min(1).max(100000),
  maxRedemptions: z.number().int().min(1).max(100000).default(1),
  perUserLimit: z.number().int().min(1).max(100).default(1),
  status: z.enum(['active', 'disabled']).default('active'),
  startsAt: z.preprocess((value) => value === '' ? null : value, z.coerce.date().nullable()).optional(),
  endsAt: z.preprocess((value) => value === '' ? null : value, z.coerce.date().nullable()).optional(),
  note: z.string().max(500).default(''),
})

const redeemCodeBatchSchema = redeemCodeSchema.omit({ code: true }).extend({
  prefix: z.string().max(24).regex(/^[A-Za-z0-9_-]*$/, '前缀只能包含字母、数字、下划线和短横线').default(''),
  count: z.number().int().min(1).max(500).default(20),
  codeLength: z.number().int().min(8).max(32).default(12),
})

const redeemCodeManualBatchSchema = redeemCodeSchema.omit({ code: true }).extend({
  codes: z.array(
    z.string().min(3).max(80).regex(/^[A-Za-z0-9_-]+$/, '兑换码只能包含字母、数字、下划线和短横线'),
  ).min(1).max(500),
})

const creditPackageSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  credits: z.number().int().min(1).max(1000000),
  bonusCredits: z.number().int().min(0).max(1000000).default(0),
  priceCents: z.number().int().min(0).max(100000000),
  currency: z.string().min(1).max(12).default('CNY'),
  badge: z.string().max(40).default(''),
  enabled: z.boolean().default(true),
  sortOrder: z.number().int().default(100),
})

const orderPatchSchema = z.object({
  status: z.enum(['paid', 'cancelled']),
  adminNote: z.string().max(500).default(''),
})

const supportTicketPatchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  adminReply: z.string().max(3000).optional(),
  adminNote: z.string().max(1000).optional(),
})

const moderationRuleBaseSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['keyword', 'regex']).default('keyword'),
  pattern: z.string().min(1).max(500),
  action: z.enum(['block']).default('block'),
  message: z.string().min(1).max(300).default('提示词包含平台暂不支持的内容，请调整后重试'),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(100),
  note: z.string().max(500).default(''),
})

function validateModerationRegex(input: { type?: 'keyword' | 'regex'; pattern?: string }, ctx: z.RefinementCtx) {
  if (input.type !== 'regex') return
  if (!input.pattern) return
  try {
    new RegExp(input.pattern, 'i')
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['pattern'],
      message: '正则表达式无效，请检查括号、转义和量词',
    })
  }
}

const moderationRuleSchema = moderationRuleBaseSchema.superRefine(validateModerationRegex)
const moderationRulePatchSchema = moderationRuleBaseSchema.partial().superRefine(validateModerationRegex)

function normalizeRedeemCodeInput(input: z.infer<typeof redeemCodeSchema>) {
  return {
    ...input,
    code: input.code.trim().toUpperCase(),
  }
}

function normalizeManualRedeemCodes(codes: string[]) {
  const normalizedCodes = codes.map((code) => code.trim().toUpperCase()).filter(Boolean)
  const uniqueCodes = new Set(normalizedCodes)
  if (uniqueCodes.size !== normalizedCodes.length) {
    throw new HttpError(409, 'REDEEM_CODE_DUPLICATED_IN_BATCH', '批量兑换码中存在重复项，请检查后重试')
  }
  return [...uniqueCodes]
}

const redeemCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function createReadableRedeemCode(prefix: string, length: number) {
  const bytes = randomBytes(length)
  const body = Array.from(bytes, (byte) => redeemCodeAlphabet[byte % redeemCodeAlphabet.length]).join('')
  return `${prefix}${body}`.toUpperCase()
}

const taskBatchDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
})

router.post('/users/:id/credits', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = creditAdjustSchema.parse(req.body)
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { creditBalance: { increment: input.delta } },
      })
      await tx.creditLedger.create({
        data: {
          userId: id,
          delta: input.delta,
          reason: `管理员调整：${input.reason}`,
          balanceAfter: updated.creditBalance,
        },
      })
      return updated
    })
    await writeAudit(req, 'user.credit.adjust', id, input)
    sendOk(res, { user })
  } catch (error) {
    next(error)
  }
})

router.get('/tasks', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined
    const modelConfigId = typeof req.query.modelConfigId === 'string' && req.query.modelConfigId !== 'all' ? req.query.modelConfigId : undefined
    const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : null
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : null
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const createdAt = {
      ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
      ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
    }
    const where = {
      ...(status ? { status: status as 'running' | 'done' | 'error' } : {}),
      ...(modelConfigId ? { modelConfigId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: 'insensitive' as const } },
              { prompt: { contains: q, mode: 'insensitive' as const } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
              { modelConfig: { displayName: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }
    const [items, total] = await Promise.all([
      prisma.generationTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: adminGenerationTaskSelect,
      }),
      prisma.generationTask.count({ where }),
    ])
    sendOk(res, { items: toAdminGenerationTasks(items), total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.get('/tasks/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const task = await prisma.generationTask.findUnique({
      where: { id },
      select: adminGenerationTaskSelect,
    })
    if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', '生成任务不存在')
    sendOk(res, { task: toAdminGenerationTask(task) })
  } catch (error) {
    next(error)
  }
})

router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const task = await prisma.generationTask.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!task) throw new HttpError(404, 'TASK_NOT_FOUND', '生成任务不存在')
    if (task.status === 'running') throw new HttpError(409, 'TASK_RUNNING', '运行中的任务不能清理')

    const cleanup = await cleanupGeneratedAssetsForTasks([id])
    await prisma.generationTask.delete({ where: { id } })
    await writeAudit(req, 'task.delete', id, { status: task.status, cleanup })
    sendOk(res, { deleted: true, cleanup })
  } catch (error) {
    next(error)
  }
})

router.post('/tasks/batch/delete', async (req, res, next) => {
  try {
    const input = taskBatchDeleteSchema.parse(req.body)
    const tasks = await prisma.generationTask.findMany({
      where: { id: { in: input.ids } },
      select: { id: true, status: true },
    })
    const runningIds = tasks.filter((task) => task.status === 'running').map((task) => task.id)
    if (runningIds.length) {
      throw new HttpError(409, 'TASK_RUNNING', `有 ${runningIds.length} 个任务仍在运行，不能清理`)
    }

    const targetIds = tasks.map((task) => task.id)
    const cleanup = await cleanupGeneratedAssetsForTasks(targetIds)
    const result = await prisma.generationTask.deleteMany({
      where: { id: { in: targetIds } },
    })
    await writeAudit(req, 'task.batch.delete', 'tasks', {
      requested: input.ids.length,
      affected: result.count,
      ids: targetIds,
      cleanup,
    })
    sendOk(res, { affected: result.count, cleanup })
  } catch (error) {
    next(error)
  }
})

router.get('/credits/ledger', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const type = typeof req.query.type === 'string' ? req.query.type : 'all'
    const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : null
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : null
    const createdAt = {
      ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
      ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
    }
    const where = {
      ...(type === 'income' ? { delta: { gt: 0 } } : {}),
      ...(type === 'expense' ? { delta: { lt: 0 } } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: 'insensitive' as const } },
              { reason: { contains: q, mode: 'insensitive' as const } },
              { taskId: { contains: q, mode: 'insensitive' as const } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }
    const [items, total] = await Promise.all([
      prisma.creditLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { user: { select: { email: true } } },
      }),
      prisma.creditLedger.count({ where }),
    ])
    sendOk(res, { items, total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.get('/redeem-codes', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : ''
    const where = {
      ...(status && status !== 'all' ? { status } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' as const } },
              { name: { contains: q, mode: 'insensitive' as const } },
              { note: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }
    const [items, total] = await Promise.all([
      prisma.redeemCode.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          _count: { select: { redemptions: true } },
          redemptions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { user: { select: { email: true } } },
          },
        },
      }),
      prisma.redeemCode.count({ where }),
    ])
    sendOk(res, { items, total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.get('/credit-packages', async (_req, res, next) => {
  try {
    const items = await prisma.creditPackage.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { orders: true } } },
    })
    sendOk(res, { items })
  } catch (error) {
    next(error)
  }
})

router.post('/credit-packages', async (req, res, next) => {
  try {
    const input = creditPackageSchema.parse(req.body)
    const creditPackage = await prisma.creditPackage.create({ data: input })
    await writeAudit(req, 'credit-package.create', creditPackage.id, input)
    sendOk(res, { creditPackage })
  } catch (error) {
    next(error)
  }
})

router.patch('/credit-packages/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = creditPackageSchema.partial().parse(req.body)
    const creditPackage = await prisma.creditPackage.update({ where: { id }, data: input })
    await writeAudit(req, 'credit-package.update', id, input)
    sendOk(res, { creditPackage })
  } catch (error) {
    next(error)
  }
})

router.delete('/credit-packages/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const orders = await prisma.creditOrder.count({ where: { creditPackageId: id } })
    if (orders > 0) {
      const creditPackage = await prisma.creditPackage.update({ where: { id }, data: { enabled: false } })
      await writeAudit(req, 'credit-package.disable', id, { reason: 'package_has_orders', orders })
      sendOk(res, { creditPackage, disabled: true })
      return
    }
    await prisma.creditPackage.delete({ where: { id } })
    await writeAudit(req, 'credit-package.delete', id)
    sendOk(res)
  } catch (error) {
    next(error)
  }
})

router.get('/credit-orders', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : ''
    const where = {
      ...(status && status !== 'all' ? { status } : {}),
      ...(q
        ? {
            OR: [
              { orderNo: { contains: q, mode: 'insensitive' as const } },
              { packageName: { contains: q, mode: 'insensitive' as const } },
              { userNote: { contains: q, mode: 'insensitive' as const } },
              { adminNote: { contains: q, mode: 'insensitive' as const } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }
    const [items, total] = await Promise.all([
      prisma.creditOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { user: { select: { email: true, status: true, segment: true } } },
      }),
      prisma.creditOrder.count({ where }),
    ])
    sendOk(res, { items, total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.patch('/credit-orders/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = orderPatchSchema.parse(req.body)
    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.creditOrder.findUnique({ where: { id } })
      if (!current) throw new HttpError(404, 'ORDER_NOT_FOUND', '订单不存在')
      if (current.status !== 'pending') throw new HttpError(409, 'ORDER_NOT_PENDING', '只有待确认订单可以处理')
      if (input.status === 'cancelled') {
        return tx.creditOrder.update({
          where: { id },
          data: { status: 'cancelled', adminNote: input.adminNote, cancelledAt: new Date() },
          include: { user: { select: { email: true, status: true, segment: true } } },
        })
      }

      const user = await tx.user.update({
        where: { id: current.userId },
        data: { creditBalance: { increment: current.totalCredits } },
        select: { creditBalance: true },
      })
      await tx.creditLedger.create({
        data: {
          userId: current.userId,
          delta: current.totalCredits,
          reason: `订单充值：${current.packageName}（${current.orderNo}）`,
          balanceAfter: user.creditBalance,
        },
      })
      return tx.creditOrder.update({
        where: { id },
        data: { status: 'paid', adminNote: input.adminNote, paidAt: new Date() },
        include: { user: { select: { email: true, status: true, segment: true } } },
      })
    })
    await writeAudit(req, `credit-order.${input.status}`, id, {
      orderNo: order.orderNo,
      totalCredits: order.totalCredits,
      priceCents: order.priceCents,
      adminNote: input.adminNote,
    })
    sendOk(res, { order })
  } catch (error) {
    next(error)
  }
})

router.get('/support-tickets', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : ''
    const priority = typeof req.query.priority === 'string' ? req.query.priority.trim() : ''
    const where = {
      ...(status && status !== 'all' ? { status } : {}),
      ...(priority && priority !== 'all' ? { priority } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { content: { contains: q, mode: 'insensitive' as const } },
              { contact: { contains: q, mode: 'insensitive' as const } },
              { relatedTaskId: { contains: q, mode: 'insensitive' as const } },
              { relatedOrderNo: { contains: q, mode: 'insensitive' as const } },
              { user: { email: { contains: q, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    }
    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
        include: { user: { select: { email: true, status: true, segment: true } } },
      }),
      prisma.supportTicket.count({ where }),
    ])
    sendOk(res, { items, total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.patch('/support-tickets/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = supportTicketPatchSchema.parse(req.body)
    const data = {
      ...input,
      ...(input.adminReply !== undefined ? { repliedAt: new Date() } : {}),
      ...(input.status === 'resolved' || input.status === 'closed' ? { closedAt: new Date() } : {}),
      ...(input.status === 'open' || input.status === 'in_progress' ? { closedAt: null } : {}),
    }
    const ticket = await prisma.supportTicket.update({
      where: { id },
      data,
      include: { user: { select: { email: true, status: true, segment: true } } },
    })
    await writeAudit(req, 'support-ticket.update', id, input)
    sendOk(res, { ticket })
  } catch (error) {
    next(error)
  }
})

router.get('/moderation-rules', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const enabled = typeof req.query.enabled === 'string' ? req.query.enabled.trim() : ''
    const where = {
      ...(enabled === 'true' ? { enabled: true } : {}),
      ...(enabled === 'false' ? { enabled: false } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { pattern: { contains: q, mode: 'insensitive' as const } },
              { note: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }
    const [items, total] = await Promise.all([
      prisma.moderationRule.findMany({
        where,
        orderBy: [{ enabled: 'desc' }, { priority: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.moderationRule.count({ where }),
    ])
    sendOk(res, { items, total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.post('/moderation-rules', async (req, res, next) => {
  try {
    const input = moderationRuleSchema.parse(req.body)
    const rule = await prisma.moderationRule.create({ data: input })
    await writeAudit(req, 'moderation-rule.create', rule.id, input)
    sendOk(res, { rule })
  } catch (error) {
    next(error)
  }
})

router.patch('/moderation-rules/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = moderationRulePatchSchema.parse(req.body)
    const rule = await prisma.moderationRule.update({ where: { id }, data: input })
    await writeAudit(req, 'moderation-rule.update', id, input)
    sendOk(res, { rule })
  } catch (error) {
    next(error)
  }
})

router.delete('/moderation-rules/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    await prisma.moderationRule.delete({ where: { id } })
    await writeAudit(req, 'moderation-rule.delete', id)
    sendOk(res)
  } catch (error) {
    next(error)
  }
})

router.post('/redeem-codes', async (req, res, next) => {
  try {
    const input = normalizeRedeemCodeInput(redeemCodeSchema.parse(req.body))
    const redeemCode = await prisma.redeemCode.create({ data: input })
    await writeAudit(req, 'redeem-code.create', redeemCode.id, {
      code: redeemCode.code,
      name: redeemCode.name,
      credits: redeemCode.credits,
      maxRedemptions: redeemCode.maxRedemptions,
    })
    sendOk(res, { redeemCode })
  } catch (error) {
    next(error)
  }
})

router.post('/redeem-codes/batch', async (req, res, next) => {
  try {
    const input = redeemCodeBatchSchema.parse(req.body)
    const prefix = input.prefix.trim().toUpperCase()
    const requested = input.count
    const codes = new Set<string>()
    let attempts = 0

    while (codes.size < requested && attempts < requested * 20) {
      attempts += 1
      codes.add(createReadableRedeemCode(prefix, input.codeLength))
    }

    if (codes.size < requested) {
      throw new HttpError(409, 'REDEEM_CODE_GENERATION_FAILED', '兑换码生成失败，请换一个前缀或增加随机位数')
    }

    const existing = await prisma.redeemCode.findMany({
      where: { code: { in: [...codes] } },
      select: { code: true },
    })
    for (const item of existing) codes.delete(item.code)

    while (codes.size < requested && attempts < requested * 40) {
      attempts += 1
      const code = createReadableRedeemCode(prefix, input.codeLength)
      if (!existing.some((item) => item.code === code)) codes.add(code)
    }

    if (codes.size < requested) {
      throw new HttpError(409, 'REDEEM_CODE_COLLISION', '兑换码与已有记录冲突，请换一个前缀或增加随机位数')
    }

    const baseData = {
      name: input.name,
      credits: input.credits,
      maxRedemptions: input.maxRedemptions,
      perUserLimit: input.perUserLimit,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      note: input.note,
    }
    await prisma.redeemCode.createMany({
      data: [...codes].map((code) => ({ ...baseData, code })),
    })

    const redeemCodes = await prisma.redeemCode.findMany({
      where: { code: { in: [...codes] } },
      orderBy: { createdAt: 'desc' },
    })
    await writeAudit(req, 'redeem-code.batch-create', 'redeem-codes', {
      count: redeemCodes.length,
      prefix,
      name: input.name,
      credits: input.credits,
      maxRedemptions: input.maxRedemptions,
    })
    sendOk(res, { redeemCodes, codes: redeemCodes.map((item) => item.code) })
  } catch (error) {
    next(error)
  }
})

router.post('/redeem-codes/import', async (req, res, next) => {
  try {
    const input = redeemCodeManualBatchSchema.parse(req.body)
    const codes = normalizeManualRedeemCodes(input.codes)
    const existing = await prisma.redeemCode.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    })
    if (existing.length > 0) {
      throw new HttpError(
        409,
        'REDEEM_CODE_ALREADY_EXISTS',
        `以下兑换码已存在：${existing.map((item) => item.code).slice(0, 10).join('、')}${existing.length > 10 ? '…' : ''}`,
      )
    }

    const baseData = {
      name: input.name,
      credits: input.credits,
      maxRedemptions: input.maxRedemptions,
      perUserLimit: input.perUserLimit,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      note: input.note,
    }
    await prisma.redeemCode.createMany({
      data: codes.map((code) => ({ ...baseData, code })),
    })

    const redeemCodes = await prisma.redeemCode.findMany({
      where: { code: { in: codes } },
      orderBy: { createdAt: 'desc' },
    })
    await writeAudit(req, 'redeem-code.batch-import', 'redeem-codes', {
      count: redeemCodes.length,
      name: input.name,
      credits: input.credits,
      maxRedemptions: input.maxRedemptions,
    })
    sendOk(res, { redeemCodes, codes: redeemCodes.map((item) => item.code) })
  } catch (error) {
    next(error)
  }
})

router.patch('/redeem-codes/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const partial = redeemCodeSchema.partial().parse(req.body)
    const input = {
      ...partial,
      ...(partial.code ? { code: partial.code.trim().toUpperCase() } : {}),
    }
    const redeemCode = await prisma.redeemCode.update({ where: { id }, data: input })
    await writeAudit(req, 'redeem-code.update', id, input)
    sendOk(res, { redeemCode })
  } catch (error) {
    next(error)
  }
})

router.delete('/redeem-codes/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const used = await prisma.creditRedemption.count({ where: { redeemCodeId: id } })
    if (used > 0) {
      const redeemCode = await prisma.redeemCode.update({ where: { id }, data: { status: 'disabled' } })
      await writeAudit(req, 'redeem-code.disable', id, { reason: 'already_used', used })
      sendOk(res, { redeemCode, disabled: true })
      return
    }
    await prisma.redeemCode.delete({ where: { id } })
    await writeAudit(req, 'redeem-code.delete', id)
    sendOk(res)
  } catch (error) {
    next(error)
  }
})

router.get('/audit-logs', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : ''
    const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : null
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : null
    const createdAt = {
      ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
      ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
    }
    const matchedActors = q
      ? await prisma.user.findMany({
          where: { email: { contains: q, mode: 'insensitive' as const } },
          select: { id: true },
          take: 100,
        })
      : []
    const matchedActorIds = matchedActors.map((user) => user.id)
    const where = {
      ...(q ? {
        OR: [
          { action: { contains: q, mode: 'insensitive' as const } },
          { target: { contains: q, mode: 'insensitive' as const } },
          { actorId: { contains: q, mode: 'insensitive' as const } },
          ...(matchedActorIds.length ? [{ actorId: { in: matchedActorIds } }] : []),
          { ip: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(action && action !== 'all' ? { action: { startsWith: action, mode: 'insensitive' as const } } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    }
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.auditLog.count({ where }),
    ])
    const actorIds = Array.from(new Set(items.map((item) => item.actorId).filter((id): id is string => Boolean(id))))
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true, role: true, status: true },
        })
      : []
    const actorMap = new Map(actors.map((actor) => [actor.id, actor]))
    sendOk(res, {
      items: items.map((item) => ({
        ...item,
        actor: item.actorId ? actorMap.get(item.actorId) ?? null : null,
      })),
      total,
      page,
      pageSize,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/login-logs', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const success = typeof req.query.success === 'string' ? req.query.success.trim() : ''
    const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : null
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : null
    const createdAt = {
      ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
      ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
    }
    const where = {
      ...(q ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { reason: { contains: q, mode: 'insensitive' as const } },
          { ip: { contains: q, mode: 'insensitive' as const } },
          { userAgent: { contains: q, mode: 'insensitive' as const } },
        ],
      } : {}),
      ...(success === 'success' ? { success: true } : {}),
      ...(success === 'failed' ? { success: false } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    }
    const [items, total] = await Promise.all([
      prisma.loginLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              status: true,
              segment: true,
              creditBalance: true,
              loginCount: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.loginLog.count({ where }),
    ])
    sendOk(res, { items, total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await getPlatformSettings()
    sendOk(res, { settings: toAdminPlatformSettingsView(settings) })
  } catch (error) {
    next(error)
  }
})

const settingsSchema = z.object({
  registerEnabled: z.boolean().optional(),
  generationEnabled: z.boolean().optional(),
  registerBonusCredits: z.number().int().min(0).max(100000).optional(),
  maintenanceMessage: z.string().max(500).optional(),
  redeemDescription: z.string().max(1000).optional(),
  landingHeroSlidesJson: z.string().max(30000).optional(),
  sub2apiRedeemEnabled: z.boolean().optional(),
  sub2apiRedeemBaseUrl: z.string().url().optional().or(z.literal('')),
  sub2apiRedeemToken: z.string().max(4000).optional(),
})

const sub2apiRedeemTestSchema = z.object({
  code: z.string().min(3).max(80),
})

router.patch('/settings', async (req, res, next) => {
  try {
    const parsed = settingsSchema.parse(req.body)
    const { sub2apiRedeemToken, ...input } = parsed
    const updateInput = {
      ...input,
      ...(typeof sub2apiRedeemToken === 'string' && sub2apiRedeemToken.trim()
        ? { sub2apiRedeemToken: sub2apiRedeemToken.trim() }
        : {}),
    }
    const settings = await upsertPlatformSettings(updateInput)
    await writeAudit(req, 'platform.settings.update', 'platform', {
      ...input,
      ...(typeof sub2apiRedeemToken === 'string' && sub2apiRedeemToken.trim()
        ? { sub2apiRedeemToken: '***configured***' }
        : {}),
    })
    sendOk(res, { settings: toAdminPlatformSettingsView(settings) })
  } catch (error) {
    next(error)
  }
})

router.post('/settings/sub2api-redeem/test', async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const input = sub2apiRedeemTestSchema.parse(req.body)
    const settings = await getPlatformSettings()
    if (!settings.sub2apiRedeemEnabled || !settings.sub2apiRedeemBaseUrl.trim()) {
      throw new HttpError(400, 'SUB2API_REDEEM_NOT_CONFIGURED', '请先启用并配置 sub2api 地址前缀')
    }

    const code = input.code.trim()
    const result = await consumeSub2ApiRedeemCode({
      code,
      settings,
      userId: user.id,
      email: user.email,
    })
    await writeAudit(req, 'platform.sub2api-redeem.test', 'platform', {
      code,
    })
    sendOk(res, {
      ok: true,
      result,
      message: 'sub2api 兑换码校验成功，已标记为已使用',
    })
  } catch (error) {
    next(error)
  }
})

const providerSchema = z.object({
  name: z.string().min(1).max(80),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1).max(4000),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(100),
  timeoutSeconds: z.number().int().min(30).max(3600).default(900),
  notes: z.string().max(500).default(''),
})

router.get('/upstreams', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status : 'all'
    const health = typeof req.query.health === 'string' ? req.query.health : 'all'
    const where = {
      ...(q ? { OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { baseUrl: { contains: q, mode: 'insensitive' as const } },
        { notes: { contains: q, mode: 'insensitive' as const } },
        { models: { some: { OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { displayName: { contains: q, mode: 'insensitive' as const } },
        ] } } },
      ] } : {}),
      ...(status === 'enabled' ? { enabled: true } : {}),
      ...(status === 'disabled' ? { enabled: false } : {}),
      ...(health !== 'all' ? { lastHealthStatus: health } : {}),
    }
    const [providers, total] = await Promise.all([
      prisma.upstreamProvider.findMany({
        where,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          _count: { select: { models: true } },
          models: {
            orderBy: [{ enabled: 'desc' }, { sortOrder: 'asc' }],
            take: 8,
            select: {
              id: true,
              displayName: true,
              name: true,
              enabled: true,
              costCredits: true,
              costCredits2K: true,
              costCredits4K: true,
              lowQualityEnabled: true,
              lowQualityCostCredits: true,
              lowQualityCostCredits2K: true,
              lowQualityCostCredits4K: true,
              mediumQualityEnabled: true,
              highQualityEnabled: true,
              highQualityCostCredits: true,
              highQualityCostCredits2K: true,
              highQualityCostCredits4K: true,
            },
          },
        },
      }),
      prisma.upstreamProvider.count({ where }),
    ])
    sendOk(res, { items: providers.map(maskProvider), total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.post('/upstreams', async (req, res, next) => {
  try {
    const input = providerSchema.parse(req.body)
    const provider = await prisma.upstreamProvider.create({ data: input })
    await writeAudit(req, 'upstream.create', provider.id, { ...input, apiKey: '[REDACTED]' })
    sendOk(res, { provider: maskProvider(provider) })
  } catch (error) {
    next(error)
  }
})

router.patch('/upstreams/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const partialSchema = providerSchema.partial().extend({
      apiKey: z.string().max(4000).optional(),
    })
    const input = partialSchema.parse(req.body)
    const data = { ...input }
    if (!data.apiKey) delete data.apiKey
    const provider = await prisma.upstreamProvider.update({ where: { id }, data })
    await writeAudit(req, 'upstream.update', id, { ...data, apiKey: data.apiKey ? '[REDACTED]' : undefined })
    sendOk(res, { provider: maskProvider(provider) })
  } catch (error) {
    next(error)
  }
})

const upstreamBatchTestSchema = z.object({
  ids: z.array(z.string().min(1)).max(50).optional(),
})

router.post('/upstreams/batch/test', async (req, res, next) => {
  try {
    const input = upstreamBatchTestSchema.parse(req.body ?? {})
    const providers = await prisma.upstreamProvider.findMany({
      where: input.ids?.length ? { id: { in: input.ids } } : undefined,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    })
    const results = []
    for (const provider of providers) {
      const result = await testAndUpdateUpstreamProvider(provider)
      results.push({
        providerId: provider.id,
        providerName: provider.name,
        ok: result.ok,
        status: result.status,
        latencyMs: result.latencyMs,
        checkedAt: result.checkedAt,
        modelCount: result.modelCount,
        message: result.message,
      })
    }
    await writeAudit(req, 'upstream.batch.test', 'upstreams', {
      requested: input.ids?.length ?? 'all',
      affected: results.length,
      healthy: results.filter((item) => item.ok).length,
      error: results.filter((item) => !item.ok).length,
    })
    sendOk(res, { results })
  } catch (error) {
    next(error)
  }
})

router.post('/upstreams/:id/test', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const provider = await prisma.upstreamProvider.findUnique({ where: { id } })
    if (!provider) throw new HttpError(404, 'UPSTREAM_NOT_FOUND', '上游渠道不存在')

    const result = await testAndUpdateUpstreamProvider(provider)
    await writeAudit(req, 'upstream.test', id, {
      ok: result.ok,
      status: result.status,
      latencyMs: result.latencyMs,
      message: result.message,
    })
    sendOk(res, { result })
  } catch (error) {
    next(error)
  }
})

router.get('/upstreams/:id/models', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const provider = await prisma.upstreamProvider.findUnique({ where: { id } })
    if (!provider) throw new HttpError(404, 'UPSTREAM_NOT_FOUND', '上游渠道不存在')
    const startedAt = Date.now()
    const models = await fetchUpstreamModels(provider)
    await writeAudit(req, 'upstream.models.list', id, { modelCount: models.length })
    sendOk(res, {
      models,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    })
  } catch (error) {
    next(error)
  }
})

router.delete('/upstreams/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const models = await prisma.modelConfig.count({ where: { upstreamProviderId: id } })
    if (models > 0) {
      await prisma.upstreamProvider.update({ where: { id }, data: { enabled: false } })
      await writeAudit(req, 'upstream.disable', id, { reason: 'provider_has_bound_models', models })
    } else {
      await prisma.upstreamProvider.delete({ where: { id } })
      await writeAudit(req, 'upstream.delete', id)
    }
    sendOk(res)
  } catch (error) {
    next(error)
  }
})

const announcementSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(2000),
  level: z.enum(['info', 'success', 'warning', 'critical']).default('info'),
  placement: z.enum(['global', 'home', 'workspace', 'square']).default('global'),
  actionLabel: z.string().max(40).default(''),
  actionUrl: z.string().max(500).default(''),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  pinned: z.boolean().default(false),
  startsAt: z.preprocess((value) => value === '' ? null : value, z.coerce.date().nullable()).optional(),
  endsAt: z.preprocess((value) => value === '' ? null : value, z.coerce.date().nullable()).optional(),
})

router.get('/announcements', async (req, res, next) => {
  try {
    const { page, pageSize, skip } = readPagination(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status : 'all'
    const placement = typeof req.query.placement === 'string' ? req.query.placement : 'all'
    const level = typeof req.query.level === 'string' ? req.query.level : 'all'
    const where = {
      ...(q ? { OR: [
        { title: { contains: q, mode: 'insensitive' as const } },
        { content: { contains: q, mode: 'insensitive' as const } },
        { actionLabel: { contains: q, mode: 'insensitive' as const } },
      ] } : {}),
      ...(status !== 'all' ? { status: status as 'draft' | 'published' | 'archived' } : {}),
      ...(placement !== 'all' ? { placement } : {}),
      ...(level !== 'all' ? { level } : {}),
    }
    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        where,
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.announcement.count({ where }),
    ])
    sendOk(res, { items, total, page, pageSize })
  } catch (error) {
    next(error)
  }
})

router.post('/announcements', async (req, res, next) => {
  try {
    const input = announcementSchema.parse(req.body)
    const announcement = await prisma.announcement.create({ data: input })
    await writeAudit(req, 'announcement.create', announcement.id, input)
    sendOk(res, { announcement })
  } catch (error) {
    next(error)
  }
})

router.patch('/announcements/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = announcementSchema.partial().parse(req.body)
    const announcement = await prisma.announcement.update({ where: { id }, data: input })
    await writeAudit(req, 'announcement.update', id, input)
    sendOk(res, { announcement })
  } catch (error) {
    next(error)
  }
})

router.delete('/announcements/:id', async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    await prisma.announcement.delete({ where: { id } })
    await writeAudit(req, 'announcement.delete', id)
    sendOk(res)
  } catch (error) {
    next(error)
  }
})

export default router
