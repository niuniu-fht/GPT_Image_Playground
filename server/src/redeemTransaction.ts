import type { RedeemTransaction } from '@prisma/client'
import { HttpError } from './http.js'
import { prisma } from './prisma.js'
import type { PlatformSettings } from './settings.js'
import { consumeSub2ApiRedeemCode } from './sub2apiRedeem.js'

const ACTIVE_REDEEM_STATUSES = ['pending', 'consuming', 'remote_consumed', 'finalizing'] as const
const REMOTE_CLAIM_STALE_MS = 12_000

interface RedeemTransactionInput {
  code: string
  requestId: string
  settings: PlatformSettings
  user: { id: string; email: string }
}

interface RedeemResult {
  user: {
    id: string
    email: string
    role: string
    status: string
    creditBalance: number
  }
  redeemCode: {
    id: string
    code: string
    name: string
    credits: number
  }
  transaction: {
    id: string | null
    recovered: boolean
  }
}

function validateRedeemCode(
  redeemCode: {
    status: string
    startsAt: Date | null
    endsAt: Date | null
    usedCount: number
    maxRedemptions: number
  },
  now: Date,
) {
  if (redeemCode.status !== 'active') throw new HttpError(409, 'REDEEM_CODE_DISABLED', '兑换码已停用')
  if (redeemCode.startsAt && redeemCode.startsAt > now) throw new HttpError(409, 'REDEEM_CODE_NOT_STARTED', '兑换码尚未开始')
  if (redeemCode.endsAt && redeemCode.endsAt < now) throw new HttpError(409, 'REDEEM_CODE_EXPIRED', '兑换码已过期')
  if (redeemCode.usedCount >= redeemCode.maxRedemptions) throw new HttpError(409, 'REDEEM_CODE_USED_UP', '兑换码已领完')
}

async function buildCompletedResult(input: {
  transactionId: string | null
  redeemCodeId: string
  code: string
  name: string
  credits: number
  userId: string
  recovered?: boolean
}): Promise<RedeemResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, role: true, status: true, creditBalance: true },
  })
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在')
  return {
    user,
    redeemCode: {
      id: input.redeemCodeId,
      code: input.code,
      name: input.name,
      credits: input.credits,
    },
    transaction: {
      id: input.transactionId,
      recovered: Boolean(input.recovered),
    },
  }
}

async function resultFromCompletedTransaction(transactionId: string): Promise<RedeemResult | null> {
  const transaction = await prisma.redeemTransaction.findUnique({
    where: { id: transactionId },
    include: { redemption: true },
  })
  if (transaction?.status !== 'completed' || !transaction.redemption) return null
  return buildCompletedResult({
    transactionId: transaction.id,
    redeemCodeId: transaction.redeemCodeId,
    code: transaction.code,
    name: transaction.name,
    credits: transaction.redemption.credits,
    userId: transaction.userId,
  })
}

async function startOrResumeTransaction(input: RedeemTransactionInput) {
  const known = await prisma.redeemTransaction.findUnique({ where: { requestId: input.requestId } })
  if (known) {
    if (known.userId !== input.user.id || known.code !== input.code) {
      throw new HttpError(409, 'REDEEM_REQUEST_CONFLICT', '兑换请求标识已被其他兑换占用')
    }
    return { kind: 'attempt' as const, attempt: known }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const locatedCode = await tx.redeemCode.findUnique({ where: { code: input.code } })
      if (!locatedCode) throw new HttpError(404, 'REDEEM_CODE_NOT_FOUND', '兑换码不存在')

      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "RedeemCode" WHERE "id" = ${locatedCode.id} FOR UPDATE`
      const redeemCode = await tx.redeemCode.findUnique({ where: { id: locatedCode.id } })
      if (!redeemCode) throw new HttpError(404, 'REDEEM_CODE_NOT_FOUND', '兑换码不存在')

      const existingRedemptions = await tx.creditRedemption.findMany({
        where: { redeemCodeId: redeemCode.id, userId: input.user.id },
        orderBy: { createdAt: 'desc' },
        take: redeemCode.perUserLimit,
      })
      if (existingRedemptions.length >= redeemCode.perUserLimit) {
        const previous = existingRedemptions[0]
        return {
          kind: 'completed' as const,
          completed: {
            transactionId: previous.transactionId,
            redeemCodeId: redeemCode.id,
            code: redeemCode.code,
            name: redeemCode.name,
            credits: previous.credits,
            userId: input.user.id,
          },
        }
      }

      validateRedeemCode(redeemCode, new Date())
      const activeAttempt = await tx.redeemTransaction.findFirst({
        where: {
          redeemCodeId: redeemCode.id,
          userId: input.user.id,
          status: { in: [...ACTIVE_REDEEM_STATUSES] },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (activeAttempt) return { kind: 'attempt' as const, attempt: activeAttempt }

      const [activeForCode, activeForUser] = await Promise.all([
        tx.redeemTransaction.count({
          where: { redeemCodeId: redeemCode.id, status: { in: [...ACTIVE_REDEEM_STATUSES] } },
        }),
        tx.redeemTransaction.count({
          where: {
            redeemCodeId: redeemCode.id,
            userId: input.user.id,
            status: { in: [...ACTIVE_REDEEM_STATUSES] },
          },
        }),
      ])
      if (redeemCode.usedCount + activeForCode >= redeemCode.maxRedemptions) {
        throw new HttpError(409, 'REDEEM_CODE_USED_UP', '兑换码已领完')
      }
      if (existingRedemptions.length + activeForUser >= redeemCode.perUserLimit) {
        throw new HttpError(409, 'REDEEM_CODE_USER_LIMIT', '你已经兑换过这个兑换码')
      }

      const attempt = await tx.redeemTransaction.create({
        data: {
          requestId: input.requestId,
          redeemCodeId: redeemCode.id,
          userId: input.user.id,
          code: redeemCode.code,
          name: redeemCode.name,
          credits: redeemCode.credits,
        },
      })
      return { kind: 'attempt' as const, attempt }
    })
  } catch (error) {
    const racedAttempt = await prisma.redeemTransaction.findFirst({
      where: {
        userId: input.user.id,
        code: input.code,
        OR: [
          { requestId: input.requestId },
          { status: { in: [...ACTIVE_REDEEM_STATUSES] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
    if (racedAttempt) return { kind: 'attempt' as const, attempt: racedAttempt }
    throw error
  }
}

async function claimRemoteStep(attempt: RedeemTransaction) {
  if (attempt.status === 'remote_consumed') return attempt
  if (attempt.status === 'completed') return attempt
  if (attempt.status === 'finalizing') {
    throw new HttpError(409, 'REDEEM_IN_PROGRESS', '兑换正在完成入账，请稍后重试')
  }

  const staleBefore = new Date(Date.now() - REMOTE_CLAIM_STALE_MS)
  const claimed = await prisma.redeemTransaction.updateMany({
    where: {
      id: attempt.id,
      OR: [
        { status: 'pending' },
        { status: 'consuming', updatedAt: { lte: staleBefore } },
      ],
    },
    data: { status: 'consuming', lastError: '' },
  })
  if (claimed.count === 0) {
    const current = await prisma.redeemTransaction.findUnique({ where: { id: attempt.id } })
    if (current?.status === 'remote_consumed' || current?.status === 'completed') return current
    throw new HttpError(409, 'REDEEM_IN_PROGRESS', '兑换正在核销，请稍后重试')
  }
  return prisma.redeemTransaction.findUniqueOrThrow({ where: { id: attempt.id } })
}

async function finalizeTransaction(transactionId: string, recovered: boolean): Promise<RedeemResult> {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.redeemTransaction.updateMany({
      where: { id: transactionId, status: 'remote_consumed' },
      data: { status: 'finalizing' },
    })
    if (claimed.count === 0) {
      const current = await tx.redeemTransaction.findUnique({
        where: { id: transactionId },
        include: { redemption: true },
      })
      if (current?.status === 'completed' && current.redemption) {
        const user = await tx.user.findUnique({
          where: { id: current.userId },
          select: { id: true, email: true, role: true, status: true, creditBalance: true },
        })
        if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在')
        return { current, redemption: current.redemption, user }
      }
      throw new HttpError(409, 'REDEEM_IN_PROGRESS', '兑换正在完成入账，请稍后重试')
    }

    const attempt = await tx.redeemTransaction.findUnique({ where: { id: transactionId } })
    if (!attempt) throw new HttpError(404, 'REDEEM_TRANSACTION_NOT_FOUND', '兑换事务不存在')
    const user = await tx.user.update({
      where: { id: attempt.userId },
      data: { creditBalance: { increment: attempt.credits } },
      select: { id: true, email: true, role: true, status: true, creditBalance: true },
    })
    await tx.redeemCode.update({
      where: { id: attempt.redeemCodeId },
      data: { usedCount: { increment: 1 } },
    })
    const redemption = await tx.creditRedemption.create({
      data: {
        redeemCodeId: attempt.redeemCodeId,
        userId: attempt.userId,
        credits: attempt.credits,
        balanceAfter: user.creditBalance,
        transactionId: attempt.id,
      },
    })
    await tx.creditLedger.create({
      data: {
        userId: attempt.userId,
        delta: attempt.credits,
        reason: `兑换码：${attempt.name || attempt.code}`,
        balanceAfter: user.creditBalance,
      },
    })
    const current = await tx.redeemTransaction.update({
      where: { id: attempt.id },
      data: { status: 'completed', completedAt: new Date(), lastError: '' },
    })
    return { current, redemption, user }
  })

  return {
    user: result.user,
    redeemCode: {
      id: result.current.redeemCodeId,
      code: result.current.code,
      name: result.current.name,
      credits: result.redemption.credits,
    },
    transaction: { id: result.current.id, recovered },
  }
}

export async function redeemCreditsWithTransaction(input: RedeemTransactionInput): Promise<RedeemResult> {
  const prepared = await startOrResumeTransaction(input)
  if (prepared.kind === 'completed') return buildCompletedResult(prepared.completed)

  const alreadyCompleted = await resultFromCompletedTransaction(prepared.attempt.id)
  if (alreadyCompleted) return alreadyCompleted

  const attempt = await claimRemoteStep(prepared.attempt)
  if (attempt.status === 'completed') {
    const completed = await resultFromCompletedTransaction(attempt.id)
    if (completed) return completed
  }

  let recovered = false
  if (attempt.status !== 'remote_consumed') {
    try {
      const remote = await consumeSub2ApiRedeemCode({
        code: attempt.code,
        settings: input.settings,
        userId: attempt.userId,
        email: input.user.email,
        transactionId: attempt.id,
        attemptCreatedAt: attempt.createdAt,
      })
      recovered = remote.recovered
      const usedAt = remote.usedAt ? new Date(remote.usedAt) : null
      await prisma.redeemTransaction.update({
        where: { id: attempt.id },
        data: {
          status: 'remote_consumed',
          externalConsumed: remote.external,
          externalCodeId: remote.id,
          externalUserId: remote.usedBy,
          externalUsedAt: usedAt && Number.isFinite(usedAt.getTime()) ? usedAt : null,
          lastError: '',
        },
      })
    } catch (error) {
      await prisma.redeemTransaction.updateMany({
        where: { id: attempt.id, status: 'consuming' },
        data: { lastError: error instanceof Error ? error.message : String(error) },
      }).catch(() => undefined)
      throw error
    }
  }

  return finalizeTransaction(attempt.id, recovered)
}
