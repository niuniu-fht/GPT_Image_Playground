import type { Prisma } from '@prisma/client'
import { prisma } from '../prisma.js'
import { getPlatformSettings, isWithinTimeWindow } from '../settings.js'
import { getR2UploadRuntimeConfig, isAlreadyOnR2, needsR2Upload } from './config.js'
import { readImageSource, uploadToR2Hub } from './hub.js'

const TICK_INTERVAL_MS = 15_000
const MAX_ATTEMPTS = 8
const BATCH_PER_TICK = 10
const BACKOFF_BASE_MS = 30_000

interface R2UploadJob {
  taskId: string
  index: number
  dataUrl: string
  mimeType: string
  attempts: number
  nextAttemptAt: number
  lastError?: string
}

interface QueueState {
  jobs: Map<string, R2UploadJob>
  processing: boolean
  lastError?: string
  uploadedCount: number
  droppedCount: number
  startedAt: number
}

const state: QueueState = {
  jobs: new Map(),
  processing: false,
  uploadedCount: 0,
  droppedCount: 0,
  startedAt: Date.now(),
}

let tickTimer: ReturnType<typeof setInterval> | null = null

function jobKey(taskId: string, index: number): string {
  return `${taskId}:${index}`
}

export interface R2UploadImageInput {
  dataUrl: string
  index: number
  mimeType: string
}

/** 任务完成后调用：筛选需要上传 R2 的图片并入队。开关关闭时直接跳过。 */
export async function enqueueR2UploadForImages(input: {
  taskId: string
  images: R2UploadImageInput[]
}): Promise<number> {
  const candidates = input.images.filter((image) => needsR2Upload(image.dataUrl))
  if (!candidates.length) return 0

  const config = await getR2UploadRuntimeConfig()
  if (!config.enabled) return 0

  let added = 0
  for (const image of candidates) {
    const key = jobKey(input.taskId, image.index)
    if (state.jobs.has(key)) continue
    state.jobs.set(key, {
      taskId: input.taskId,
      index: image.index,
      dataUrl: image.dataUrl,
      mimeType: image.mimeType,
      attempts: 0,
      nextAttemptAt: Date.now(),
    })
    added += 1
  }

  if (added > 0) {
    console.info('[r2-upload] enqueued images', {
      taskId: input.taskId,
      added,
      queued: state.jobs.size,
    })
    void kickWorker()
  }
  return added
}

async function updateTaskWithR2Url(
  job: { taskId: string; index: number },
  r2Url: string,
): Promise<void> {
  const task = await prisma.generationTask.findUnique({
    where: { id: job.taskId },
    select: { outputImages: true },
  })
  if (!task) throw new Error('任务不存在，无法回写 R2 地址')

  const images = Array.isArray(task.outputImages) ? [...task.outputImages] : []
  const target = images.find((item) => (
    item && typeof item === 'object' && (item as Record<string, unknown>).index === job.index
  )) as Record<string, unknown> | undefined
  if (!target || target.status !== 'done') throw new Error('任务图片记录缺失或未完成')
  if (typeof target.dataUrl === 'string' && isAlreadyOnR2(target.dataUrl)) {
    // 已被回写为 R2 地址（幂等保护），无需重复更新
    return
  }
  target.dataUrl = r2Url

  await prisma.generationTask.update({
    where: { id: job.taskId },
    data: { outputImages: images as unknown as Prisma.InputJsonValue },
  })
}

/** 只负责读取源图并上传到 r2hub，不触碰任务记录（事务提交前后都可安全调用）。 */
async function uploadImageToHub(
  job: { taskId: string; index: number; dataUrl: string; mimeType: string },
  config: { hubUrl: string; hubApiKey: string },
): Promise<string> {
  const source = await readImageSource(job.dataUrl, job.mimeType, job.taskId, job.index)
  const uploaded = await uploadToR2Hub({ ...source, hubUrl: config.hubUrl, hubApiKey: config.hubApiKey })
  console.info('[r2-upload] uploaded image', {
    taskId: job.taskId,
    index: job.index,
    bucket: uploaded.bucket,
    url: uploaded.url,
    size: uploaded.size,
  })
  return uploaded.url
}

async function tick(): Promise<void> {
  if (state.processing) return
  const settings = await getPlatformSettings()
  if (!settings.r2UploadEnabled) return
  if (settings.r2UploadWindowEnabled && !isWithinTimeWindow(new Date(), settings.r2UploadWindowStart, settings.r2UploadWindowEnd)) {
    return
  }
  if (!settings.r2HubUrl || !settings.r2HubApiKey) return

  const hubConfig = { hubUrl: settings.r2HubUrl, hubApiKey: settings.r2HubApiKey }
  const now = Date.now()
  const due = Array.from(state.jobs.values())
    .filter((job) => job.nextAttemptAt <= now)
    .sort((left, right) => left.nextAttemptAt - right.nextAttemptAt)
    .slice(0, BATCH_PER_TICK)
  if (!due.length) return

  state.processing = true
  try {
    for (const job of due) {
      try {
        const r2Url = await uploadImageToHub(job, hubConfig)
        await updateTaskWithR2Url(job, r2Url)
        state.uploadedCount += 1
        state.jobs.delete(jobKey(job.taskId, job.index))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        job.attempts += 1
        job.lastError = message
        state.lastError = `${job.taskId}#${job.index}: ${message}`
        if (job.attempts >= MAX_ATTEMPTS) {
          state.jobs.delete(jobKey(job.taskId, job.index))
          state.droppedCount += 1
          console.warn('[r2-upload] dropped image after max attempts', {
            taskId: job.taskId,
            index: job.index,
            attempts: job.attempts,
            error: message,
          })
        } else {
          job.nextAttemptAt = Date.now() + BACKOFF_BASE_MS * 2 ** (job.attempts - 1)
          console.warn('[r2-upload] upload attempt failed, scheduled retry', {
            taskId: job.taskId,
            index: job.index,
            attempts: job.attempts,
            nextRetryInSeconds: Math.round((job.nextAttemptAt - Date.now()) / 1000),
            error: message,
          })
        }
      }
    }
  } finally {
    state.processing = false
  }
}

export function kickWorker(): void {
  void tick().catch((error: unknown) => {
    console.error('[r2-upload] worker tick failed', error)
  })
}

export interface R2UploadPlanResult {
  /** inline = 已同步上传并给出 R2 地址；queue = 走后台队列（窗口模式或开关关闭） */
  mode: 'inline' | 'queue'
  /** index -> R2 地址，仅 inline 模式成功的图片 */
  urls: Map<number, string>
  /** 提交后需要入队后台重试/补传的图片 */
  fallbackImages: R2UploadImageInput[]
  uploaded: number
}

/**
 * 生成完成时的上传决策：
 * - 立即模式（未开时间段窗口）：同步上传，返回 R2 地址让完成结果直接带 R2 链接；
 * - 窗口模式：不同步上传，全部图片在事务提交后入队，等窗口消费。
 */
export async function resolveR2UploadPlan(input: {
  taskId: string
  images: R2UploadImageInput[]
}): Promise<R2UploadPlanResult> {
  const candidates = input.images.filter((image) => needsR2Upload(image.dataUrl))
  const settings = await getPlatformSettings()
  if (!settings.r2UploadEnabled || !settings.r2HubUrl || !settings.r2HubApiKey) {
    return { mode: 'queue', urls: new Map(), fallbackImages: [], uploaded: 0 }
  }
  // 窗口模式且当前不在窗口内：排队等待窗口消费；在窗口内则与立即模式一致，同步上传
  if (settings.r2UploadWindowEnabled && !isWithinTimeWindow(new Date(), settings.r2UploadWindowStart, settings.r2UploadWindowEnd)) {
    return { mode: 'queue', urls: new Map(), fallbackImages: candidates, uploaded: 0 }
  }

  const hubConfig = { hubUrl: settings.r2HubUrl, hubApiKey: settings.r2HubApiKey }
  const urls = new Map<number, string>()
  const fallbackImages: R2UploadImageInput[] = []
  for (const image of candidates) {
    try {
      // inline 路径不回写任务记录：R2 地址随后随完成事务一起落库
      const r2Url = await uploadImageToHub(
        { taskId: input.taskId, index: image.index, dataUrl: image.dataUrl, mimeType: image.mimeType },
        hubConfig,
      )
      urls.set(image.index, r2Url)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[r2-upload] inline upload failed, fallback to queue', {
        taskId: input.taskId,
        index: image.index,
        error: message,
      })
      state.lastError = `${input.taskId}#${image.index}: ${message}`
      fallbackImages.push(image)
    }
  }
  return { mode: 'inline', urls, fallbackImages, uploaded: urls.size }
}

export function startR2UploadWorker(): () => void {
  if (tickTimer) {
    return () => undefined
  }
  tickTimer = setInterval(() => kickWorker(), TICK_INTERVAL_MS)
  tickTimer.unref?.()
  return () => {
    if (tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  }
}

/**
 * 容器重启会丢失内存队列。启动时回扫最近 hours 小时的已完成任务，
 * 把 outputImages 里还不是 R2 地址的图片重新入队（needsR2Upload 幂等过滤已上传的）。
 */
export async function restoreUnuploadedFromDatabase(hours = 6, limit = 1000): Promise<number> {
  const config = await getR2UploadRuntimeConfig()
  if (!config.enabled) return 0
  const tasks = await prisma.generationTask.findMany({
    where: {
      status: 'done',
      createdAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, outputImages: true },
  })
  let added = 0
  for (const task of tasks) {
    const images = Array.isArray(task.outputImages) ? task.outputImages : []
    const doneImages = images
      .filter((item): item is { dataUrl: string; index: number; mimeType: string; status: string } => (
        Boolean(item) && typeof item === 'object'
        && (item as Record<string, unknown>).status === 'done'
        && typeof (item as Record<string, unknown>).dataUrl === 'string'
      ))
      .map((item) => ({ dataUrl: item.dataUrl, index: item.index, mimeType: item.mimeType }))
    if (!doneImages.length) continue
    added += await enqueueR2UploadForImages({ taskId: task.id, images: doneImages })
  }
  if (added > 0) {
    console.info('[r2-upload] restored images into queue after restart', { added, scanned: tasks.length })
  }
  return added
}

export function getR2UploadQueueStats() {
  const jobs = Array.from(state.jobs.values())
  return {
    queueLength: jobs.length,
    retrying: jobs.filter((job) => job.attempts > 0).length,
    processing: state.processing,
    uploadedCount: state.uploadedCount,
    droppedCount: state.droppedCount,
    oldestQueuedAt: jobs.length ? Math.min(...jobs.map((job) => job.nextAttemptAt)) : null,
    lastError: state.lastError ?? null,
    uptimeSeconds: Math.round((Date.now() - state.startedAt) / 1000),
  }
}
