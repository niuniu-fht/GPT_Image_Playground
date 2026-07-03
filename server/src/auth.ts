import type { NextFunction, Request, Response } from 'express'
import { prisma } from './prisma.js'
import { HttpError } from './http.js'

export type RequestUser = {
  id: string
  email: string
  role: 'user' | 'admin'
  status: 'active' | 'disabled'
  creditBalance: number
}

export async function getSessionUser(req: Request): Promise<RequestUser | null> {
  const userId = req.session.userId
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, status: true, creditBalance: true },
  })
  if (user?.status === 'disabled') return null
  return user
}

export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await getSessionUser(req)
    if (!user) throw new HttpError(401, 'unauthorized', '请先登录后再继续')
    resLocals(req).user = user
    next()
  } catch (error) {
    next(error)
  }
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await getSessionUser(req)
    if (!user) throw new HttpError(401, 'unauthorized', '请先登录后再继续')
    if (user.role !== 'admin') throw new HttpError(403, 'forbidden', '当前账号没有管理员权限')
    resLocals(req).user = user
    next()
  } catch (error) {
    next(error)
  }
}

export function resLocals(req: Request): { user?: RequestUser } {
  return req as Request & { user?: RequestUser }
}
