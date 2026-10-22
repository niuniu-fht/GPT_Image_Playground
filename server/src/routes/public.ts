import { Router } from 'express'
import { getSessionUser, requireUser, resLocals } from '../auth.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import { getPlatformSettings } from '../settings.js'

const router = Router()

function parseAnnouncementPlacement(value: unknown): 'home' | 'workspace' | 'square' | null {
  if (typeof value !== 'string') return null
  const placement = value.trim()
  return (['home', 'workspace', 'square'] as const).find((item) => item === placement) ?? null
}

router.get('/announcements', async (req, res, next) => {
  try {
    const now = new Date()
    const placement = parseAnnouncementPlacement(req.query.placement)
    const placements = placement ? ['global', placement] : ['global', 'home', 'workspace', 'square']
    const items = await prisma.announcement.findMany({
      where: {
        status: 'published',
        placement: { in: placements },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 20,
    })
    const user = await getSessionUser(req)
    const reads = user
      ? await prisma.announcementRead.findMany({
          where: { userId: user.id, announcementId: { in: items.map((item) => item.id) } },
          select: { announcementId: true, readAt: true },
        })
      : []
    const readAtById = new Map(reads.map((read) => [read.announcementId, read.readAt]))
    sendOk(res, {
      items: items.map((item) => ({ ...item, read: readAtById.has(item.id), readAt: readAtById.get(item.id) ?? null })),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/announcements/:id/read', requireUser, async (req, res, next) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) throw new HttpError(400, 'invalid_request', '公告 ID 无效')
    const user = resLocals(req).user!
    const announcement = await prisma.announcement.findUnique({ where: { id }, select: { id: true } })
    if (!announcement) throw new HttpError(404, 'not_found', '公告不存在或已下线')
    const read = await prisma.announcementRead.upsert({
      where: { userId_announcementId: { userId: user.id, announcementId: id } },
      create: { userId: user.id, announcementId: id },
      update: {},
    })
    sendOk(res, { read })
  } catch (error) {
    next(error)
  }
})

router.get('/landing', async (_req, res, next) => {
  try {
    const settings = await getPlatformSettings()
    sendOk(res, { landingHeroSlidesJson: settings.landingHeroSlidesJson })
  } catch (error) {
    next(error)
  }
})

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await getPlatformSettings()
    sendOk(res, {
      redeemDescription: settings.redeemDescription,
    })
  } catch (error) {
    next(error)
  }
})

export default router
