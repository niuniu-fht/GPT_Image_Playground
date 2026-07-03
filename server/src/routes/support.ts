import { Router } from 'express'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import { requireUser, resLocals } from '../auth.js'
import { sendOk } from '../http.js'
import { prisma } from '../prisma.js'

const router = Router()

const ticketCreateSchema = z.object({
  category: z.enum(['general', 'generation', 'billing', 'square', 'account']).default('general'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  title: z.string().min(2).max(120),
  content: z.string().min(5).max(3000),
  contact: z.string().max(120).default(''),
  relatedTaskId: z.string().max(80).optional().nullable(),
  relatedOrderNo: z.string().max(80).optional().nullable(),
})

router.use(requireUser)

router.get('/tickets', async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const items = await prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    sendOk(res, { items })
  } catch (error) {
    next(error)
  }
})

router.post('/tickets', async (req, res, next) => {
  try {
    const user = resLocals(req).user!
    const input = ticketCreateSchema.parse(req.body)
    const ticket = await prisma.supportTicket.create({
      data: {
        ...input,
        relatedTaskId: input.relatedTaskId || null,
        relatedOrderNo: input.relatedOrderNo || null,
        userId: user.id,
      },
    })
    await writeAudit(req, 'support-ticket.create', ticket.id, {
      category: ticket.category,
      priority: ticket.priority,
      title: ticket.title,
    })
    sendOk(res, { ticket })
  } catch (error) {
    next(error)
  }
})

export default router
