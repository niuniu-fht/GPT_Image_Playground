import { Router } from 'express'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import { requireUser, resLocals } from '../auth.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'

const router = Router()

function createOrderNo() {
  const date = new Date()
  const stamp = date.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `CO${stamp}${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

router.get('/ledger', requireUser, async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const items = await prisma.creditLedger.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 80,
    })
    sendOk(res, { items })
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
})

router.post('/redeem', requireUser, async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const input = redeemSchema.parse(req.body)
    const code = input.code.trim().toUpperCase()
    const now = new Date()

    const result = await prisma.$transaction(async (tx) => {
      const redeemCode = await tx.redeemCode.findUnique({ where: { code } })
      if (!redeemCode) throw new HttpError(404, 'REDEEM_CODE_NOT_FOUND', '兑换码不存在')
      if (redeemCode.status !== 'active') throw new HttpError(409, 'REDEEM_CODE_DISABLED', '兑换码已停用')
      if (redeemCode.startsAt && redeemCode.startsAt > now) throw new HttpError(409, 'REDEEM_CODE_NOT_STARTED', '兑换码尚未开始')
      if (redeemCode.endsAt && redeemCode.endsAt < now) throw new HttpError(409, 'REDEEM_CODE_EXPIRED', '兑换码已过期')
      if (redeemCode.usedCount >= redeemCode.maxRedemptions) throw new HttpError(409, 'REDEEM_CODE_USED_UP', '兑换码已领完')

      const userUsedCount = await tx.creditRedemption.count({
        where: { redeemCodeId: redeemCode.id, userId: user.id },
      })
      if (userUsedCount >= redeemCode.perUserLimit) {
        throw new HttpError(409, 'REDEEM_CODE_USER_LIMIT', '你已经兑换过这个兑换码')
      }

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { creditBalance: { increment: redeemCode.credits } },
        select: { id: true, email: true, role: true, status: true, creditBalance: true },
      })
      await tx.redeemCode.update({
        where: { id: redeemCode.id },
        data: { usedCount: { increment: 1 } },
      })
      await tx.creditRedemption.create({
        data: {
          redeemCodeId: redeemCode.id,
          userId: user.id,
          credits: redeemCode.credits,
          balanceAfter: updatedUser.creditBalance,
        },
      })
      await tx.creditLedger.create({
        data: {
          userId: user.id,
          delta: redeemCode.credits,
          reason: `兑换码：${redeemCode.name || redeemCode.code}`,
          balanceAfter: updatedUser.creditBalance,
        },
      })
      return {
        user: updatedUser,
        redeemCode: {
          id: redeemCode.id,
          code: redeemCode.code,
          name: redeemCode.name,
          credits: redeemCode.credits,
        },
      }
    })

    await writeAudit(req, 'credit.redeem', result.redeemCode.id, {
      code: result.redeemCode.code,
      credits: result.redeemCode.credits,
    })
    sendOk(res, result)
  } catch (error) {
    next(error)
  }
})

export default router
