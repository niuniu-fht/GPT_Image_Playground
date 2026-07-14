import { getImageRecord } from '../lib/db'
import { platformApi } from '../lib/platformApi'
import type { TaskRecord } from '../types'
import { storeImage } from './imageAssets'

interface GeneratedImagePersistenceRetryItem {
  generationTaskId: string
  imageId: string
  imageIndex: number
  localTaskId: string
}

const RETRY_INTERVAL_MS = 60_000
const RETRY_BATCH_SIZE = 2

const retryQueue = new Map<string, GeneratedImagePersistenceRetryItem>()
let retryTimerId: number | null = null
let isProcessingRetries = false

function getRetryKey(item: Pick<GeneratedImagePersistenceRetryItem, 'generationTaskId' | 'imageId'>) {
  return `${item.generationTaskId}:${item.imageId}`
}

function normalizeRetryItem(
  item: GeneratedImagePersistenceRetryItem,
): GeneratedImagePersistenceRetryItem | null {
  const generationTaskId = item.generationTaskId.trim()
  const imageId = item.imageId.trim()
  const localTaskId = item.localTaskId.trim()
  if (!generationTaskId || !imageId || !localTaskId || !Number.isFinite(item.imageIndex)) {
    return null
  }

  return {
    generationTaskId,
    imageId,
    imageIndex: Math.max(0, Math.floor(item.imageIndex)),
    localTaskId,
  }
}

export function scheduleGeneratedImagePersistenceRetry(item: GeneratedImagePersistenceRetryItem) {
  const normalized = normalizeRetryItem(item)
  if (!normalized) {
    return
  }

  retryQueue.set(getRetryKey(normalized), normalized)
  startGeneratedImagePersistenceRetryWorker()
}

async function isImagePersisted(imageId: string): Promise<boolean> {
  const record = await getImageRecord(imageId).catch(() => undefined)
  return Boolean(record)
}

async function persistGeneratedImageFromServer(
  item: GeneratedImagePersistenceRetryItem,
): Promise<boolean> {
  if (await isImagePersisted(item.imageId)) {
    return true
  }

  const generationResult = await platformApi.getGenerationTask(item.generationTaskId)
  if (generationResult.status !== 'done') {
    return false
  }

  const image = generationResult.images[item.imageIndex]
  if (!image?.dataUrl) {
    return false
  }

  await storeImage(image.dataUrl, {
    id: item.imageId,
    source: 'generated',
    mimeType: image.mimeType || null,
  })
  return true
}

async function processGeneratedImagePersistenceRetries() {
  if (isProcessingRetries || retryQueue.size === 0) {
    return
  }

  isProcessingRetries = true
  const batch = Array.from(retryQueue.values()).slice(0, RETRY_BATCH_SIZE)

  try {
    for (const item of batch) {
      try {
        const persisted = await persistGeneratedImageFromServer(item)
        if (persisted) {
          retryQueue.delete(getRetryKey(item))
        }
      } catch (error) {
        console.warn('[generation] generated image persistence retry failed', {
          taskId: item.localTaskId,
          imageId: item.imageId,
          error,
        })
      }
    }
  } finally {
    isProcessingRetries = false
  }
}

function getTaskGenerationTaskId(task: TaskRecord): string | null {
  const generationTaskId = task.responseMeta?.generationTaskId
  return typeof generationTaskId === 'string' && generationTaskId.trim()
    ? generationTaskId.trim()
    : null
}

export async function seedGeneratedImagePersistenceRetriesFromTasks(tasks: TaskRecord[]) {
  const candidates = tasks
    .filter((task) => task.status === 'done' && task.outputImages.length > 0)
    .sort((a, b) => b.createdAt - a.createdAt)

  for (const task of candidates) {
    const generationTaskId = getTaskGenerationTaskId(task)
    if (!generationTaskId) {
      continue
    }

    for (const [imageIndex, imageId] of task.outputImages.entries()) {
      if (!imageId || await isImagePersisted(imageId)) {
        continue
      }

      scheduleGeneratedImagePersistenceRetry({
        localTaskId: task.id,
        generationTaskId,
        imageId,
        imageIndex,
      })
    }
  }
}

export function startGeneratedImagePersistenceRetryWorker() {
  if (retryTimerId !== null) {
    return
  }

  retryTimerId = window.setInterval(() => {
    void processGeneratedImagePersistenceRetries()
  }, RETRY_INTERVAL_MS)
}
