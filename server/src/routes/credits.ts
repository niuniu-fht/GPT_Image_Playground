import { Router } from 'express'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import { requireUser, resLocals } from '../auth.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import { redeemCreditsWithTransaction } from '../redeemTransaction.js'
import { getPlatformSettings } from '../settings.js'

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
