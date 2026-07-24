import type { Prisma } from '@prisma/client'
import { Router } from 'express'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import { requireUser, resLocals } from '../auth.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import { redeemCreditsWithTransaction } from '../redeemTransaction.js'
import { getPlatformSettings } from '../settings.js'

const router = Router()

const ledgerQuerySchema = z.object({
  type: z.enum(['all', 'redeem', 'consume', 'refund']).default('all'),
  q: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
})

function refundLedgerWhere(): Prisma.CreditLedgerWhereInput {
  return {
    delta: { gt: 0 },
    OR: [
      { reason: { contains: '退回' } },
      { reason: { contains: '退款' } },
      { reason: { contains: '返还' } },
    ],
  }
}

function ledgerTypeWhere(type: z.infer<typeof ledgerQuerySchema>['type']): Prisma.CreditLedgerWhereInput {
  if (type === 'redeem') return { reason: { startsWith: '兑换码：' } }
  if (type === 'consume') return { delta: { lt: 0 } }
  if (type === 'refund') return refundLedgerWhere()
  return {}
}

function createPromptPreview(prompt: string): string {
  return Array.from(prompt.trim()).slice(0, 20).join('')
}

function createOrderNo() {
  const date = new Date()
  const stamp = date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `CO${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

router.get('/ledger', requireUser, async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const query = ledgerQuerySchema.parse(req.query)
    const matchingTasks = query.q
      ? await prisma.generationTask.findMany({
          where: {
            userId: user.id,
            prompt: { contains: query.q, mode: 'insensitive' },
          },
          select: { id: true },
        })
      : null
    const where: Prisma.CreditLedgerWhereInput = {
      userId: user.id,
      AND: [
        ledgerTypeWhere(query.type),
        ...(matchingTasks ? [{ taskId: { in: matchingTasks.map((task) => task.id) } }] : []),
      ],
    }
    const [items, total, recordCount, income, expense, redeemed, refunded] = await Promise.all([
      prisma.creditLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.creditLedger.count({ where }),
      prisma.creditLedger.count({ where: { userId: user.id } }),
      prisma.creditLedger.aggregate({ where: { userId: user.id, delta: { gt: 0 } }, _sum: { delta: true } }),
      prisma.creditLedger.aggregate({ where: { userId: user.id, delta: { lt: 0 } }, _sum: { delta: true } }),
      prisma.creditLedger.aggregate({
        where: { userId: user.id, reason: { startsWith: '兑换码：' }, delta: { gt: 0 } },
        _sum: { delta: true },
      }),
      prisma.creditLedger.aggregate({
        where: { userId: user.id, ...refundLedgerWhere() },
        _sum: { delta: true },
      }),
    ])
    const taskPrompts = items.some((item) => item.taskId)
      ? await prisma.generationTask.findMany({
          where: {
            userId: user.id,
            id: { in: items.flatMap((item) => item.taskId ? [item.taskId] : []) },
          },
          select: { id: true, prompt: true },
        })
      : []
    const promptByTaskId = new Map(
      taskPrompts.map((task) => [task.id, createPromptPreview(task.prompt)]),
    )
    sendOk(res, {
      items: items.map((item) => ({
        ...item,
        promptPreview: item.taskId ? promptByTaskId.get(item.taskId) ?? null : null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: {
        currentBalance: user.creditBalance,
        recordCount,
        totalIncome: income._sum.delta ?? 0,
        totalSpent: Math.abs(expense._sum.delta ?? 0),
        totalRedeemed: redeemed._sum.delta ?? 0,
        totalRefunded: refunded._sum.delta ?? 0,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/packages', async (_req, res, next) => {
  try {
    const items = await prisma.creditPackage.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
    sendOk(res, { items })
  } catch (error) {
    next(error)
  }
})

router.get('/orders', requireUser, async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const items = await prisma.creditOrder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    sendOk(res, { items })
  } catch (error) {
    next(error)
  }
})

const createOrderSchema = z.object({
  packageId: z.string().min(1),
  userNote: z.string().max(500).default(''),
})

router.post('/orders', requireUser, async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const input = createOrderSchema.parse(req.body)
    const pack = await prisma.creditPackage.findUnique({ where: { id: input.packageId } })
    if (!pack || !pack.enabled) throw new HttpError(404, 'PACKAGE_NOT_FOUND', '套餐不存在或已下架')
    const order = await prisma.creditOrder.create({
      data: {
        orderNo: createOrderNo(),
        userId: user.id,
        creditPackageId: pack.id,
        packageName: pack.name,
        credits: pack.credits,
        bonusCredits: pack.bonusCredits,
        totalCredits: pack.credits + pack.bonusCredits,
        priceCents: pack.priceCents,
        currency: pack.currency,
        paymentMethod: 'manual',
        userNote: input.userNote,
      },
    })
    await writeAudit(req, 'credit-order.create', order.id, {
      orderNo: order.orderNo,
      packageId: pack.id,
      totalCredits: order.totalCredits,
      priceCents: order.priceCents,
    })
    sendOk(res, { order })
  } catch (error) {
    next(error)
  }
})

const redeemSchema = z.object({
  code: z.string().min(3).max(80),
  requestId: z.string().min(8).max(160).optional(),
})

router.post('/redeem', requireUser, async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const input = redeemSchema.parse(req.body)
    const code = input.code.trim().toUpperCase()
    const settings = await getPlatformSettings()
    const result = await redeemCreditsWithTransaction({
      code,
      requestId: input.requestId?.trim() || `legacy:${user.id}:${code}`,
      settings,
      user: { id: user.id, email: user.email },
    })

    await writeAudit(req, 'credit.redeem', result.redeemCode.id, {
      code: result.redeemCode.code,
      credits: result.redeemCode.credits,
      transactionId: result.transaction.id,
      recovered: result.transaction.recovered,
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
})

export default router
