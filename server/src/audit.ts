import type { Request } from 'express'
import { resLocals } from './auth.js'
import { prisma } from './prisma.js'

export async function writeAudit(req: Request, action: string, target: string, detail?: unknown) {
  const user = resLocals(req).user
  await prisma.auditLog.create({
    data: {
      actorId: user?.id ?? null,
      action,
      target,
      detail: detail === undefined ? undefined : (detail as object),
      ip: req.ip,
    },
  })
}
