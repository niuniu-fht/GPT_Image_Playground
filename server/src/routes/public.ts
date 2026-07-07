import { Router } from 'express'
import { sendOk } from '../http.js'
import { prisma } from '../prisma.js'
import { getPlatformSettings } from '../settings.js'

const router = Router()

router.get('/announcements', async (req, res, next) => {
  try {
    const now = new Date()
    const placement = typeof req.query.placement === 'string' ? req.query.placement.trim() : ''
    const placements = placement && ['home', 'workspace', 'square'].includes(placement)
      ? ['global', placement]
      : ['global', 'home', 'workspace', 'square']
    const items = await prisma.announcement.findMany({
      where: {
        status: 'published',
        placement: { in: placements },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      take: 3,
    })
    sendOk(res, { items })
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
