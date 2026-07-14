import type { AppSettings, TaskErrorDebugInfo, TaskRecord } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import {
  clearTaskAbortState,
  isTaskAbortRequested,
  registerTaskAborter,
} from './taskAbort'
import type { TaskApiOutputImageAsset } from './taskApiRequest'
import { callTaskImageApi } from './taskApiRequest'
import type { StoreApiError } from './contracts'
import { isRecord } from '../lib/guards'
import { platformApi } from '../lib/platformApi'
import { scheduleGeneratedImagePersistenceRetry } from './generatedImagePersistenceRetry'
import { evictImage, storeImage } from './imageAssets'
import { useStore } from './state'
import {
  abortTaskRun,
  appendTaskRunOutputs,
  failTaskRun,
  succeedTaskRun,
} from './taskRun'

function readLocalDebugFromErrorDetails(details: unknown): TaskErrorDebugInfo | null {
  if (!isRecord(details)) {
    return null
  }

  return isRecord(details.localDebug) ? (details.localDebug as TaskErrorDebugInfo) : null
}

function buildTaskErrorDebugInfo(
  requestSettings: AppSettings,
  error: unknown,
): TaskErrorDebugInfo {
  const apiError = (error instanceof Error ? error : new Error(String(error))) as StoreApiError
  const localDebug = readLocalDebugFromErrorDetails(apiError.details)
  if (localDebug) {
    return localDebug
  }

  const debugInfo: TaskErrorDebugInfo = {
    createdAt: Date.now(),
    requestId: apiError.requestId || null,
    status: typeof apiError.status === 'number' ? apiError.status : null,
    requestMode: requestSettings.requestMode || DEFAULT_SETTINGS.requestMode,
    apiProtocol: requestSettings.apiProtocol || DEFAULT_SETTINGS.apiProtocol,
    baseUrl: requestSettings.baseUrl,
    model: requestSettings.model,
    responsesImageModel: requestSettings.responsesImageModel || null,
    responsesTransport: requestSettings.responsesTransport || null,
    responsesImageInputMode: requestSettings.responsesImageInputMode || null,
    responsesPromptRevisionMode: requestSettings.responsesPromptRevisionMode || null,
  }

  if (apiError.details !== undefined) {
    debugInfo.details = apiError.details
  }

  return debugInfo
}

function throwIfTaskAbortRequested(taskId: string) {
  if (!isTaskAbortRequested(taskId)) {
    return
  }

  const error = new Error('任务已中止')
  error.name = 'TaskAbortError'
  throw error
}

const GENERATED_IMAGE_PERSIST_TIMEOUT_MS = 12_000

interface StoredGeneratedOutputImage {
  imageId: string
  transient: boolean
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof window.setTimeout> | undefined

  return new Promise<T>((resolve, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)

    promise
      .then(resolve, reject)
      .finally(() => {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId)
        }
      })
  })
}

function persistGeneratedImage(
  image: Blob | string,
  mimeType: string | null,
): Promise<string> {
  return withTimeout(
    storeImage(image, {
      source: 'generated',
      mimeType,
    }),
    GENERATED_IMAGE_PERSIST_TIMEOUT_MS,
    '图片已生成，但保存到浏览器本地数据库超时',
  )
}

async function stageGeneratedImageReference(
  referenceUrl: string,
): Promise<StoredGeneratedOutputImage> {
  const imageId = await storeImage(referenceUrl, {
    source: 'generated',
    stageOnly: true,
  })
  return {
    imageId,
    transient: true,
  }
}

async function storeGeneratedDataUrlImage(
  dataUrl: string,
  mimeType: string,
): Promise<StoredGeneratedOutputImage> {
  try {
    const imageId = await withTimeout(
      (async () => {
        const response = await fetch(dataUrl)
        if (!response.ok) {
          throw new Error(`图片读取失败：HTTP ${response.status}`)
        }
        const blob = await response.blob()
        return storeImage(blob, {
          source: 'generated',
          mimeType: blob.type || mimeType || null,
        })
      })(),
      GENERATED_IMAGE_PERSIST_TIMEOUT_MS,
      '图片已生成，但保存到浏览器本地数据库超时',
    )

    return {
      imageId,
      transient: false,
    }
  } catch (error) {
    console.warn('[generation] failed to persist generated data url locally; using session cache', error)
    return stageGeneratedImageReference(dataUrl)
  }
}

async function storeGeneratedOutputImage(
  image: TaskApiOutputImageAsset,
): Promise<StoredGeneratedOutputImage> {
  if ('dataUrl' in image) {
    return storeGeneratedDataUrlImage(image.dataUrl, image.mimeType)
  }

  if ('remoteUrl' in image) {
    try {
      const blob = await platformApi.fetchRemoteImage({ url: image.remoteUrl })
      const imageId = await persistGeneratedImage(blob, blob.type || image.mimeType || null)
      return {
        imageId,
        transient: false,
      }
    } catch (error) {
      console.warn('[generation] failed to cache remote image locally', error)
      try {
        const imageId = await persistGeneratedImage(image.remoteUrl, image.mimeType || null)
        return {
          imageId,
          transient: false,
        }
      } catch (fallbackError) {
        console.warn(
          '[generation] failed to persist remote image reference locally; using session cache',
          fallbackError,
        )
        return stageGeneratedImageReference(image.remoteUrl)
      }
    }
  }

  const imageId = await persistGeneratedImage(image.blob, image.mimeType || image.blob.type || null)
  return {
    imageId,
    transient: false,
  }
}

export async function executeTask(taskId: string, requestSettings: AppSettings) {
  const task = useStore.getState().tasks.find((item) => item.id === taskId)
  if (!task) {
    return
  }

  const outputIds: string[] = []
  let transientOutputCount = 0

  try {
    throwIfTaskAbortRequested(taskId)

    const appendOutputImages = async (images: TaskApiOutputImageAsset[]) => {
      if (!images.length) {
        return
      }

      for (const image of images) {
        throwIfTaskAbortRequested(taskId)
        const imageIndex = typeof image.outputIndex === 'number' ? image.outputIndex : outputIds.length
        const storedImage = await storeGeneratedOutputImage(image)
        throwIfTaskAbortRequested(taskId)
        outputIds.push(storedImage.imageId)
        if (storedImage.transient) {
          transientOutputCount += 1
          if (image.generationTaskId) {
            scheduleGeneratedImagePersistenceRetry({
              localTaskId: taskId,
              generationTaskId: image.generationTaskId,
              imageId: storedImage.imageId,
              imageIndex,
            })
          }
        }
      }

      appendTaskRunOutputs(taskId, outputIds)
    }

    throwIfTaskAbortRequested(taskId)
    const result = await callTaskImageApi(task, requestSettings, {
      onFinalImages: appendOutputImages,
      registerAbort: (abort) => {
        registerTaskAborter(taskId, abort)
      },
      throwIfAborted: () => throwIfTaskAbortRequested(taskId),
    })

    throwIfTaskAbortRequested(taskId)
    if (outputIds.length < result.images.length) {
      await appendOutputImages(result.images.slice(outputIds.length))
    }

    throwIfTaskAbortRequested(taskId)
    succeedTaskRun(taskId, {
      outputImageIds: outputIds,
      responseMeta: result.responseMeta ?? null,
    })

    if (result.responseMeta?.squareUploadError) {
      console.warn('[square] generated image upload failed', result.responseMeta.squareUploadError)
      useStore.getState().showToast('生成完成，但图片云端同步失败，原图已保留；请稍后重试或联系管理员', 'error')
      return
    }

    const imageResults = result.responseMeta?.imageResults ?? []
    const failedImageCount = imageResults.filter((item) => item.status === 'error').length
    if (failedImageCount > 0) {
      useStore.getState().showToast(`已生成 ${outputIds.length} 张，${failedImageCount} 张未成功，失败积分已退回`, 'info')
      return
    }

    if (transientOutputCount > 0) {
      useStore.getState().showToast(
        `生成完成，${transientOutputCount} 张图片已先显示，正在后台保存到浏览器`,
        'info',
      )
      return
    }

    useStore.getState().showToast(`生成完成，共 ${outputIds.length} 张图片`, 'success')
  } catch (error) {
    const wasUserAborted =
      isTaskAbortRequested(taskId) ||
      (error instanceof Error && (error.name === 'TaskAbortError' || error.message === '任务已中止'))
    if (wasUserAborted) {
      abortTaskRun(taskId, outputIds)
      return
    }

    failTaskRun(taskId, {
      outputImageIds: outputIds,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorDebug: buildTaskErrorDebugInfo(requestSettings, error),
    })
    useStore.getState().setDetailTaskId(taskId)
  } finally {
    clearTaskAbortState(taskId)
    for (const imageId of task.inputImageIds) {
      evictImage(imageId)
    }
  }
}
