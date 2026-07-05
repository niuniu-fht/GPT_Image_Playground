import type { ApiInputImage, ApiImageAsset, CallApiResult } from '../lib/api'
import { isRemoteImageUrl } from '../lib/imageUrl'
import { platformApi } from '../lib/platformApi'
import type { AppSettings, TaskRecord } from '../types'
import { getImageView } from './imageAssets'
import { useStore } from './state'

export type TaskApiOutputImageAsset =
  | ApiImageAsset
  | {
      remoteUrl: string
      mimeType: string
    }

interface TaskPlatformApiResult {
  images: TaskApiOutputImageAsset[]
  responseMeta?: CallApiResult['responseMeta']
}

const GENERATION_POLL_INTERVAL_MS = 1800
const GENERATION_POLL_TIMEOUT_MS = 1000 * 60 * 20

export interface TaskApiRequestHandlers {
  onFinalImages?: (images: TaskApiOutputImageAsset[]) => void | Promise<void>
  registerAbort?: (abort: () => void) => void
  throwIfAborted?: () => void
}

async function loadTaskInputImages(
  task: TaskRecord,
  throwIfAborted?: () => void,
) {
  const inputImages: ApiInputImage[] = []

  for (const imageId of task.inputImageIds) {
    throwIfAborted?.()
    const dataUrl = await getImageView(imageId).getRawDataUrl()
    throwIfAborted?.()
    if (!dataUrl) {
      continue
    }

    inputImages.push({
      id: imageId,
      dataUrl,
    })
  }

  return inputImages
}

async function loadTaskEditMaskDataUrl(
  task: TaskRecord,
  throwIfAborted?: () => void,
): Promise<string | undefined> {
  if (!task.editMaskImageId) {
    return undefined
  }

  throwIfAborted?.()
  const editMaskDataUrl = await getImageView(task.editMaskImageId).getRawDataUrl()
  throwIfAborted?.()
  if (!editMaskDataUrl) {
    throw new Error('局部编辑蒙版缺失，请重新选择编辑区域后再试')
  }

  return editMaskDataUrl
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function waitForGenerationResult(
  taskId: string,
  throwIfAborted?: () => void,
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < GENERATION_POLL_TIMEOUT_MS) {
    throwIfAborted?.()
    await sleep(GENERATION_POLL_INTERVAL_MS)
    throwIfAborted?.()

    const result = await platformApi.getGenerationTask(taskId)
    if (result.user) {
      useStore.getState().setCurrentUser(result.user)
    }

    if (result.status === 'done') {
      return result
    }
    if (result.status === 'error') {
      throw new Error(result.error || '生成失败，请稍后重试')
    }
  }

  throw new Error('生成等待超时，请稍后在作品记录中查看结果')
}

export async function callTaskImageApi(
  task: TaskRecord,
  _settings: AppSettings,
  handlers: TaskApiRequestHandlers = {},
): Promise<TaskPlatformApiResult> {
  const inputImages = await loadTaskInputImages(
    task,
    handlers.throwIfAborted,
  )
  const editMaskDataUrl = await loadTaskEditMaskDataUrl(task, handlers.throwIfAborted)
  handlers.throwIfAborted?.()

  const result = await platformApi.generate({
    modelConfigId: task.modelConfigId || '',
    prompt: task.prompt,
    params: task.params,
    inputImages: inputImages.map((image) => ({
      id: image.id || 'input',
      dataUrl: image.dataUrl,
    })),
    editMask: editMaskDataUrl
      ? {
          dataUrl: editMaskDataUrl,
          sourceImageId: task.editSourceImageId ?? null,
          selection: task.editSelection ?? null,
        }
      : null,
  })
  if (result.user) {
    useStore.getState().setCurrentUser(result.user)
  }

  const completedResult = result.status === 'running' || result.images.length === 0
    ? await waitForGenerationResult(result.taskId, handlers.throwIfAborted)
    : result

  const images: TaskApiOutputImageAsset[] = await Promise.all(
    completedResult.images.map(async (image) => {
      if (isRemoteImageUrl(image.dataUrl)) {
        return {
          remoteUrl: image.dataUrl,
          mimeType: image.mimeType || 'image/png',
        }
      }
      const response = await fetch(image.dataUrl)
      const blob = await response.blob()
      return {
        blob,
        mimeType: image.mimeType || blob.type || 'image/png',
      }
    }),
  )

  if (completedResult.user) {
    useStore.getState().setCurrentUser(completedResult.user)
  }
  await handlers.onFinalImages?.(images)

  return {
    images,
    responseMeta: (completedResult.responseMeta as CallApiResult['responseMeta']) ?? undefined,
  }
}
