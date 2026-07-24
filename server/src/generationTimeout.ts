import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import {
  defaultPlatformSettings,
  normalizeGenerationTimeoutSeconds,
} from './settings.js'

const GENERATION_TIMEOUT_SWEEP_INTERVAL_MS = 15_000
const GENERATION_TIMEOUT_SWEEP_BATCH_SIZE = 100

let sweepTimer: ReturnType<typeof setInterval> | null = null
let sweepRunning = false

export function getGenerationTimeoutMessage(timeoutSeconds: number): string {
  return `生成超过 ${timeoutSeconds} 秒，任务已终止，积分已退回`
}

export function readStoredGenerationTimeoutSeconds(params: Prisma.JsonValue): number {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return defaultPlatformSettings.generationTimeoutSeconds
  }
  const admin = (params as Record<string, unknown>)._admin
  if (!admin || typeof admin !== 'object' || Array.isArray(admin)) {
    return defaultPlatformSettings.generationTimeoutSeconds
  }
  const value = (admin as Record<string, unknown>).generationTimeoutSeconds
  return normalizeGenerationTimeoutSeconds(
    typeof value === 'number' ? value : defaultPlatformSettings.generationTimeoutSeconds,
  )
}

async function expireGenerationTask(input: {
  costCredits: number
  taskId: string
  timeoutSeconds: number
  userId: string
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const expired = await tx.generationTask.updateMany({
      where: {
        id: input.taskId,
        userId: input.userId,
        status: 'running',
      },
      data: {
        status: 'error',
        error: getGenerationTimeoutMessage(input.timeoutSeconds),
        finishedAt: new Date(),
      },
    })
    if (expired.count === 0) {
      return false
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
        reason: '生成超时退回积分',
        taskId: input.taskId,
        balanceAfter: latestUser.creditBalance,
      },
    })
    return true
  })
}

export async function reconcileExpiredGenerationTasks(now = Date.now()): Promise<number> {
  if (sweepRunning) {
    return 0
  }

  sweepRunning = true
  try {
    const candidates = await prisma.generationTask.findMany({
      where: {
        status: 'running',
        createdAt: {
          lte: new Date(now - 30_000),
        },
      },
      orderBy: { createdAt: 'asc' },
      take: GENERATION_TIMEOUT_SWEEP_BATCH_SIZE,
      select: {
        id: true,
        userId: true,
        costCredits: true,
        createdAt: true,
        params: true,
      },
    })

    let expiredCount = 0
    for (const task of candidates) {
      const timeoutSeconds = readStoredGenerationTimeoutSeconds(task.params)
      if (task.createdAt.getTime() + timeoutSeconds * 1000 > now) {
        continue
      }
      const expired = await expireGenerationTask({
        taskId: task.id,
        userId: task.userId,
        costCredits: task.costCredits,
        timeoutSeconds,
      })
      if (expired) {
        expiredCount += 1
      }
    }
    return expiredCount
  } finally {
    sweepRunning = false
  }
}

export function startGenerationTimeoutSweep() {
  if (sweepTimer) {
    return
  }

  void reconcileExpiredGenerationTasks().catch((error: unknown) => {
    console.error('[generation] initial timeout sweep failed', error)
  })
  sweepTimer = setInterval(() => {
    void reconcileExpiredGenerationTasks().catch((error: unknown) => {
      console.error('[generation] timeout sweep failed', error)
    })
  }, GENERATION_TIMEOUT_SWEEP_INTERVAL_MS)
  sweepTimer.unref?.()
}
