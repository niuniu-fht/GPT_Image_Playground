import { Router } from 'express'
import { z } from 'zod'
import { writeAudit } from '../audit.js'
import { requireAdmin } from '../auth.js'
import { HttpError, sendOk } from '../http.js'
import { prisma } from '../prisma.js'

const router = Router()

const modelSchema = z.object({
  name: z.string().min(1).max(80),
  displayName: z.string().min(1).max(80),
  description: z.string().min(1).max(160),
  icon: z.string().min(1).max(500000).default('sparkles'),
  costCredits: z.number().int().min(0).max(100000),
  costCredits2K: z.number().int().min(0).max(100000).default(0),
  costCredits4K: z.number().int().min(0).max(100000).default(0),
  lowQualityCostCredits: z.number().int().min(0).max(100000).default(0),
  lowQualityCostCredits2K: z.number().int().min(0).max(100000).default(0),
  lowQualityCostCredits4K: z.number().int().min(0).max(100000).default(0),
  highQualityEnabled: z.boolean().default(false),
  highQualityCostCredits: z.number().int().min(0).max(100000).default(0),
  highQualityCostCredits2K: z.number().int().min(0).max(100000).default(0),
  highQualityCostCredits4K: z.number().int().min(0).max(100000).default(0),
  upstreamModel: z.string().min(1).max(120),
  upstreamProviderId: z.string().nullable().optional(),
  apiProtocol: z.enum(['images', 'responses']).default('images'),
  enabled: z.boolean().default(true),
  isNew: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
})

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

const upstreamProviderModelSelect = {
  id: true,
  name: true,
  baseUrl: true,
  enabled: true,
  lastCheckedAt: true,
  lastHealthStatus: true,
  lastLatencyMs: true,
  lastHttpStatus: true,
  lastHealthMessage: true,
} as const

router.get('/models', async (_req, res, next) => {
  try {
    const models = await prisma.modelConfig.findMany({
      where: { enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { upstreamProvider: { select: upstreamProviderModelSelect } },
    })
    sendOk(res, { models })
  } catch (error) {
    next(error)
  }
})

router.get('/admin/models', requireAdmin, async (_req, res, next) => {
  try {
    const models = await prisma.modelConfig.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { upstreamProvider: { select: upstreamProviderModelSelect } },
    })
    sendOk(res, { models })
  } catch (error) {
    next(error)
  }
})

router.post('/admin/models', requireAdmin, async (req, res, next) => {
  try {
    const input = modelSchema.parse(req.body)
    const model = await prisma.modelConfig.create({ data: input })
    await writeAudit(req, 'model.create', model.id, input)
    sendOk(res, { model })
  } catch (error) {
    next(error)
  }
})

router.patch('/admin/models/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const input = modelSchema.partial().parse(req.body)
    const model = await prisma.modelConfig.update({
      where: { id },
      data: input,
    })
    await writeAudit(req, 'model.update', id, input)
    sendOk(res, { model })
  } catch (error) {
    next(error)
  }
})

router.delete('/admin/models/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = readParam(req.params.id)
    const tasks = await prisma.generationTask.count({ where: { modelConfigId: id } })
    if (tasks > 0) {
      await prisma.modelConfig.update({ where: { id }, data: { enabled: false } })
      await writeAudit(req, 'model.disable', id, { reason: 'model_has_tasks', tasks })
    } else {
      await prisma.modelConfig.delete({ where: { id } })
      await writeAudit(req, 'model.delete', id)
    }
    sendOk(res)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to')) {
      next(new HttpError(404, 'not_found', '模型不存在'))
      return
    }
    next(error)
  }
})

export default router
