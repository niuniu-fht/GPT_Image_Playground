import type { AppSettings, TaskErrorDebugInfo, TaskRecord, TaskResponseMeta } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import {
  clearTaskAbortState,
  isTaskAbortRequested,
} from './taskAbort'
import type { TaskApiOutputImageAsset } from './taskApiRequest'
import {
  callTaskImageApi,
  GenerationSubmissionError,
  GenerationTaskTimeoutError,
} from './taskApiRequest'
import type { StoreApiError } from './contracts'
import { isRecord } from '../lib/guards'
import { platformApi } from '../lib/platformApi'
import { scheduleGeneratedImagePersistenceRetry } from './generatedImagePersistenceRetry'
import { evictImage, storeImage } from './imageAssets'
import { useStore } from './state'
import {
  abortTaskRun,
  appendTaskRunOutputs,
  discardUnsubmittedTaskRun,
  failTaskRun,
  succeedTaskRun,
} from './taskRun'
import { updateTaskInStore } from './taskStoreUtils'

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

const GENERATED_IMAGE_PERSIST_TIMEOUT_MS = 30_000

interface LocalPersistenceWarning {
  imageIndex: number
  imageUrl: string
  message: string
}

interface StoredGeneratedOutputImage {
  imageId: string
  localPersistenceWarning?: LocalPersistenceWarning
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

function getMimeExtension(mimeType: string | null | undefined): string {
  const subtype = mimeType?.split('/')[1]?.split(';')[0]?.trim().toLowerCase()
  if (!subtype) return 'png'
  if (subtype === 'jpeg') return 'jpg'
  if (subtype === 'svg+xml') return 'svg'
  return subtype.replace(/[^a-z0-9]/g, '') || 'png'
}

function toCopyableImageUrl(url: string): string {
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) {
    return url
  }

  try {
    return new URL(url, window.location.href).toString()
  } catch {
    return url
  }
}

function triggerBrowserDownloadByUrl(
  url: string,
  input: {
    filename: string
    revokeAfterMs?: number
  },
) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = input.filename
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)

  if (input.revokeAfterMs != null) {
    window.setTimeout(() => URL.revokeObjectURL(url), input.revokeAfterMs)
  }
}

function createGeneratedImageDownloadUrl(
  image: TaskApiOutputImageAsset,
): { copyableUrl: string; downloadUrl: string; revokeAfterMs?: number } {
  if ('remoteUrl' in image) {
    return {
      copyableUrl: toCopyableImageUrl(image.remoteUrl),
      downloadUrl: image.remoteUrl,
    }
  }
  if ('dataUrl' in image) {
    return {
      copyableUrl: image.dataUrl,
      downloadUrl: image.dataUrl,
    }
  }
  if (image.sourceUrl?.trim()) {
    return {
      copyableUrl: toCopyableImageUrl(image.sourceUrl),
      downloadUrl: image.sourceUrl,
    }
  }

  const objectUrl = URL.createObjectURL(image.blob)
  return {
    copyableUrl: objectUrl,
    downloadUrl: objectUrl,
    revokeAfterMs: 60_000,
  }
}

function handleLocalPersistenceFailure(
  image: TaskApiOutputImageAsset,
  error: unknown,
): LocalPersistenceWarning {
  const imageIndex = typeof image.outputIndex === 'number' ? image.outputIndex : 0
  const { copyableUrl, downloadUrl, revokeAfterMs } = createGeneratedImageDownloadUrl(image)
  const message = error instanceof Error ? error.message : String(error)
  triggerBrowserDownloadByUrl(downloadUrl, {
    filename: `generated-${Date.now()}-${imageIndex + 1}.${getMimeExtension(image.mimeType)}`,
    revokeAfterMs,
  })

  return {
    imageIndex,
    imageUrl: copyableUrl,
    message: `${message}；已触发浏览器下载。图片地址：${copyableUrl}`,
  }
}

function appendLocalPersistenceWarnings(
  responseMeta: TaskResponseMeta | null | undefined,
  warnings: LocalPersistenceWarning[],
): TaskResponseMeta | null {
  if (warnings.length === 0) {
    return responseMeta ?? null
  }

  return {
    ...(responseMeta ?? {}),
    localPersistenceWarnings: [
      ...(responseMeta?.localPersistenceWarnings ?? []),
      ...warnings,
    ],
  }
}

async function stageGeneratedImageReference(
  referenceUrl: string,
  preferredImageId?: string,
): Promise<StoredGeneratedOutputImage> {
  const imageId = await storeImage(referenceUrl, {
    source: 'generated',
    stageOnly: true,
    id: preferredImageId,
  })
  return {
    imageId,
    transient: true,
  }
}

async function storeGeneratedDataUrlImage(
  dataUrl: string,
  mimeType: string,
  preferredTransientImageId?: string,
  outputIndex?: number,
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
    const fallback = await stageGeneratedImageReference(dataUrl, preferredTransientImageId)
    return {
      ...fallback,
      localPersistenceWarning: handleLocalPersistenceFailure(
        { dataUrl, mimeType, outputIndex },
        error,
      ),
    }
  }
}

async function storeGeneratedOutputImage(
  image: TaskApiOutputImageAsset,
  preferredTransientImageId?: string,
): Promise<StoredGeneratedOutputImage> {
  if ('dataUrl' in image) {
    return storeGeneratedDataUrlImage(
      image.dataUrl,
      image.mimeType,
      preferredTransientImageId,
      image.outputIndex,
    )
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
        const fallback = await stageGeneratedImageReference(image.remoteUrl, preferredTransientImageId)
        return {
          ...fallback,
          localPersistenceWarning: handleLocalPersistenceFailure(image, fallbackError),
        }
      }
    }
  }

  try {
    const imageId = await persistGeneratedImage(image.blob, image.mimeType || image.blob.type || null)
    return {
      imageId,
      transient: false,
    }
  } catch (error) {
    console.warn('[generation] failed to persist generated blob locally; using session cache', error)
    const imageId = image.sourceUrl?.trim()
      ? (await stageGeneratedImageReference(image.sourceUrl, preferredTransientImageId)).imageId
      : await storeImage(image.blob, {
          id: preferredTransientImageId,
          source: 'generated',
          stageOnly: true,
        })
    return {
      imageId,
      localPersistenceWarning: handleLocalPersistenceFailure(image, error),
      transient: true,
    }
  }
}

function buildTransientGeneratedImageId(taskId: string, imageIndex: number): string {
  return `generated-transient-${taskId}-${imageIndex}`
}

const activeTaskExecutions = new Map<string, Promise<void>>()

async function executeTaskRun(taskId: string, requestSettings: AppSettings) {
  let task = useStore.getState().tasks.find((item) => item.id === taskId)
  if (!task) {
    return
  }

  if (!task.generationRequestId?.trim()) {
    const generationRequestId = task.id
    const persistence = updateTaskInStore(taskId, { generationRequestId })
    await persistence?.catch((error: unknown) => {
      console.warn('[generation] failed to persist generation request id; recovery can use local task id', error)
    })
    task = { ...task, generationRequestId }
  }

  const outputIds: string[] = []
  const localPersistenceWarnings: LocalPersistenceWarning[] = []
  let transientOutputCount = 0
  let taskAccepted = Boolean(task.generationTaskId)

  try {
    throwIfTaskAbortRequested(taskId)

    const appendOutputImages = async (images: TaskApiOutputImageAsset[]) => {
      if (!images.length) {
        return
      }

      for (const image of images) {
        throwIfTaskAbortRequested(taskId)
        const imageIndex = typeof image.outputIndex === 'number' ? image.outputIndex : outputIds.length
        const storedImage = await storeGeneratedOutputImage(
          image,
          buildTransientGeneratedImageId(taskId, imageIndex),
        )
        throwIfTaskAbortRequested(taskId)
        outputIds.push(storedImage.imageId)
        if (storedImage.localPersistenceWarning) {
          localPersistenceWarnings.push({
            ...storedImage.localPersistenceWarning,
            imageIndex,
          })
        }
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
      onTaskAccepted: async (generationTaskId, generationTimeoutSeconds) => {
        taskAccepted = true
        const currentTask = useStore.getState().tasks.find((item) => item.id === taskId)
        if (
          currentTask?.generationTaskId === generationTaskId &&
          currentTask.generationTimeoutSeconds === generationTimeoutSeconds
        ) {
          return
        }
        const persistence = updateTaskInStore(taskId, {
          generationTaskId,
          generationTimeoutSeconds,
        })
        await persistence?.catch((error: unknown) => {
          console.warn('[generation] failed to persist remote task id; idempotent request recovery remains available', error)
        })
      },
      onFinalImages: appendOutputImages,
      throwIfAborted: () => throwIfTaskAbortRequested(taskId),
    })

    throwIfTaskAbortRequested(taskId)
    if (outputIds.length < result.images.length) {
      await appendOutputImages(result.images.slice(outputIds.length))
    }

    throwIfTaskAbortRequested(taskId)
    const responseMeta = appendLocalPersistenceWarnings(
      result.responseMeta ?? null,
      localPersistenceWarnings,
    )
    succeedTaskRun(taskId, {
      outputImageIds: outputIds,
      responseMeta,
    })

    if (result.responseMeta?.squareUploadError) {
      console.warn('[square] generated image upload failed', result.responseMeta.squareUploadError)
      useStore.getState().showToast('生成完成，但图片云端同步失败，原图已保留；请稍后重试或联系管理员', 'error')
      return
    }

    if (localPersistenceWarnings.length > 0) {
      useStore.getState().showToast(
        `生成完成，但 ${localPersistenceWarnings.length} 张图片本地保存失败，已触发浏览器下载；详情中可复制图片地址`,
        'error',
      )
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

    if (!taskAccepted && error instanceof GenerationSubmissionError) {
      await discardUnsubmittedTaskRun(taskId)
      useStore.getState().showToast(error.message, 'error')
      return
    }

    failTaskRun(taskId, {
      outputImageIds: outputIds,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorDebug: buildTaskErrorDebugInfo(requestSettings, error),
    })
    if (error instanceof GenerationTaskTimeoutError) {
      useStore.getState().showToast(error.message, 'error')
    }
    useStore.getState().setDetailTaskId(taskId)
  } finally {
    clearTaskAbortState(taskId)
    for (const imageId of task.inputImageIds) {
      evictImage(imageId)
    }
  }
}

export function executeTask(taskId: string, requestSettings: AppSettings): Promise<void> {
  const activeExecution = activeTaskExecutions.get(taskId)
  if (activeExecution) {
    return activeExecution
  }

  let execution: Promise<void>
  execution = executeTaskRun(taskId, requestSettings).finally(() => {
    if (activeTaskExecutions.get(taskId) === execution) {
      activeTaskExecutions.delete(taskId)
    }
  })
  activeTaskExecutions.set(taskId, execution)
  return execution
}
