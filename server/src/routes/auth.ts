import bcrypt from 'bcryptjs'
import type { Request } from 'express'
import { Router } from 'express'
import { z } from 'zod'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import { getSessionUser } from '../auth.js'
import { getPlatformSettings } from '../settings.js'

const router = Router()

const credentialsSchema = z.object({
  email: z.string().email('请输入有效邮箱').transform((value) => value.toLowerCase()),
  password: z.string().min(8, '密码至少 8 位'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(8, '新密码至少 8 位').max(128, '新密码最多 128 位'),
})

function publicUser(user: { id: string; email: string; role: string; status?: string; creditBalance: number }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    creditBalance: user.creditBalance,
  }
}

async function writeLoginLog(
  req: Request,
  input: { email: string; userId?: string | null; success: boolean; reason: string },
) {
  await prisma.loginLog.create({
    data: {
      email: input.email,
      userId: input.userId ?? null,
      success: input.success,
      reason: input.reason,
      ip: req.ip,
      userAgent: req.get('user-agent') ?? null,
    },
  })
}

router.get('/me', async (req, res, next) => {
  try {
    const user = await getSessionUser(req)
    sendOk(res, { user: user ? publicUser(user) : null })
  } catch (error) {
    next(error)
  }
})

router.post('/register', async (req, res, next) => {
  try {
    const input = credentialsSchema.parse(req.body)
    const settings = await getPlatformSettings()
    if (!settings.registerEnabled) throw new HttpError(403, 'register_closed', '当前暂未开放注册')
    const existing = await prisma.user.findUnique({ where: { email: input.email } })
    if (existing) throw new HttpError(409, 'email_exists', '该邮箱已经注册，请直接登录')

    const bonusCredits = settings.registerBonusCredits
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, 12),
        creditBalance: bonusCredits,
        lastLoginAt: new Date(),
        loginCount: 1,
        ledgers: {
          create: {
            delta: bonusCredits,
            reason: '注册赠送积分',
            balanceAfter: bonusCredits,
          },
        },
      },
      select: { id: true, email: true, role: true, status: true, creditBalance: true },
    })
    req.session.userId = user.id
    await writeLoginLog(req, { email: user.email, userId: user.id, success: true, reason: 'register_success' })
    sendOk(res, { user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const input = credentialsSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { email: input.email } })
    if (!user) {
      await writeLoginLog(req, { email: input.email, success: false, reason: 'unknown_email' })
      throw new HttpError(401, 'invalid_credentials', '邮箱或密码不正确')
    }
    if (!(await bcrypt.compare(input.password, user.passwordHash))) {
      await writeLoginLog(req, { email: input.email, userId: user.id, success: false, reason: 'wrong_password' })
      throw new HttpError(401, 'invalid_credentials', '邮箱或密码不正确')
    }
    if (user.status === 'disabled') {
      await writeLoginLog(req, { email: input.email, userId: user.id, success: false, reason: 'account_disabled' })
      throw new HttpError(403, 'account_disabled', '账号已被禁用，请联系管理员')
    }
    const loggedInUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        loginCount: { increment: 1 },
      },
      select: { id: true, email: true, role: true, status: true, creditBalance: true },
    })
    req.session.userId = loggedInUser.id
    await writeLoginLog(req, { email: loggedInUser.email, userId: loggedInUser.id, success: true, reason: 'login_success' })
    sendOk(res, { user: publicUser(loggedInUser) })
  } catch (error) {
    next(error)
  }
})

router.post('/change-password', async (req, res, next) => {
  try {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) throw new HttpError(401, 'unauthorized', '请先登录后再继续')

    const input = changePasswordSchema.parse(req.body)
    if (input.currentPassword === input.newPassword) {
      throw new HttpError(400, 'same_password', '新密码不能和当前密码相同')
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, passwordHash: true },
    })
    if (!user) throw new HttpError(401, 'unauthorized', '请先登录后再继续')

    const passwordMatched = await bcrypt.compare(input.currentPassword, user.passwordHash)
    if (!passwordMatched) {
      throw new HttpError(400, 'invalid_current_password', '当前密码不正确')
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
    })
    sendOk(res)
  } catch (error) {
    next(error)
  }
})

router.post('/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) {
      next(error)
      return
    }
    res.clearCookie('gip.sid')
    sendOk(res)
  })
})

export default router
