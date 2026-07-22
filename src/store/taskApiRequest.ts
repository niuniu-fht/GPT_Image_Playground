import type { ApiInputImage, ApiImageAsset, CallApiResult } from '../lib/api'
import { isRemoteImageUrl } from '../lib/imageUrl'
import {
  PlatformApiError,
  platformApi,
  type PlatformGenerationResult,
} from '../lib/platformApi'
import type { AppSettings, TaskRecord, TaskResponseMeta } from '../types'
import { getImageView } from './imageAssets'
import { useStore } from './state'

interface TaskApiOutputImageMeta {
  generationTaskId?: string
  outputIndex?: number
}

export type TaskApiOutputImageAsset =
  | (ApiImageAsset & TaskApiOutputImageMeta)
  | ({
      remoteUrl: string
      mimeType: string
    } & TaskApiOutputImageMeta)
  | ({
      dataUrl: string
      mimeType: string
    } & TaskApiOutputImageMeta)

interface TaskPlatformApiResult {
  images: TaskApiOutputImageAsset[]
  responseMeta?: CallApiResult['responseMeta']
}

const GENERATION_POLL_INTERVAL_MS = 1800
const GENERATION_RETRY_BASE_DELAY_MS = 2000
const GENERATION_RETRY_MAX_DELAY_MS = 30_000
const GENERATION_REQUEST_TIMEOUT_MS = 60_000
const ABORT_CHECK_INTERVAL_MS = 500

export interface TaskApiRequestHandlers {
  onTaskAccepted?: (generationTaskId: string) => void | Promise<void>
  onFinalImages?: (images: TaskApiOutputImageAsset[]) => void | Promise<void>
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
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms))
}

async function waitWithAbortChecks(
  ms: number,
  throwIfAborted?: () => void,
): Promise<void> {
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    throwIfAborted?.()
    await sleep(Math.min(ABORT_CHECK_INTERVAL_MS, deadline - Date.now()))
  }
  throwIfAborted?.()
}

async function waitUntilOnline(throwIfAborted?: () => void): Promise<void> {
  while (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throwIfAborted?.()
    await sleep(ABORT_CHECK_INTERVAL_MS)
  }
}

export function isRetryableGenerationRequestError(error: unknown): boolean {
  if (!(error instanceof PlatformApiError)) {
    return false
  }
  if (error.code === 'generation_closed') {
    return false
  }

  return (
    error.status === 0 ||
    (error.status >= 200 && error.status < 300) ||
    error.status === 408 ||
    error.status === 425 ||
    error.status === 429 ||
    error.status >= 500
  )
}

function isGenerationAuthenticationError(error: unknown): boolean {
  return error instanceof PlatformApiError && error.status === 401
}

async function waitForGenerationAuthentication(
  throwIfAborted?: () => void,
): Promise<void> {
  const snapshot = useStore.getState()
  snapshot.setCurrentUser(null)
  snapshot.openAuthModal('login')

  while (!useStore.getState().currentUser) {
    await waitWithAbortChecks(ABORT_CHECK_INTERVAL_MS, throwIfAborted)
  }
}

function getGenerationRetryDelay(retryCount: number): number {
  const exponentialDelay = GENERATION_RETRY_BASE_DELAY_MS * (2 ** Math.max(0, retryCount - 1))
  return Math.min(exponentialDelay, GENERATION_RETRY_MAX_DELAY_MS)
}

async function runGenerationRequestWithRetry<T>(
  request: (signal: AbortSignal) => Promise<T>,
  throwIfAborted?: () => void,
): Promise<T> {
  let retryCount = 0

  while (true) {
    throwIfAborted?.()
    await waitUntilOnline(throwIfAborted)

    const controller = new AbortController()
    let abortError: unknown = null
    const timeoutId = globalThis.setTimeout(() => {
      controller.abort()
    }, GENERATION_REQUEST_TIMEOUT_MS)
    const abortCheckId = throwIfAborted
      ? globalThis.setInterval(() => {
          try {
            throwIfAborted()
          } catch (error) {
            abortError = error
            controller.abort()
          }
        }, ABORT_CHECK_INTERVAL_MS)
      : null

    let requestError: unknown = null
    try {
      return await request(controller.signal)
    } catch (error) {
      requestError = abortError ?? error
    } finally {
      globalThis.clearTimeout(timeoutId)
      if (abortCheckId != null) {
        globalThis.clearInterval(abortCheckId)
      }
    }

    if (abortError) {
      throw requestError
    }
    if (isGenerationAuthenticationError(requestError)) {
      retryCount = 0
      await waitForGenerationAuthentication(throwIfAborted)
      continue
    }
    if (!isRetryableGenerationRequestError(requestError)) {
      throw requestError
    }

    retryCount += 1
    await waitWithAbortChecks(getGenerationRetryDelay(retryCount), throwIfAborted)
  }
}

function syncGenerationUser(result: PlatformGenerationResult) {
  if (result.user) {
    useStore.getState().setCurrentUser(result.user)
  }
}

function resolveTerminalGenerationResult(
  result: PlatformGenerationResult,
): PlatformGenerationResult | null {
  if (result.status === 'error') {
    throw new Error(result.error || '生成失败，请稍后重试')
  }
  if (result.status === 'done' || result.images.length > 0) {
    return result
  }
  return null
}

async function waitForGenerationResult(
  taskId: string,
  throwIfAborted?: () => void,
  pollImmediately = false,
): Promise<PlatformGenerationResult> {
  let shouldWait = !pollImmediately

  while (true) {
    if (shouldWait) {
      await waitWithAbortChecks(GENERATION_POLL_INTERVAL_MS, throwIfAborted)
    }
    shouldWait = true

    const result = await runGenerationRequestWithRetry(
      (signal) => platformApi.getGenerationTask(taskId, signal),
      throwIfAborted,
    )
    syncGenerationUser(result)

    const terminalResult = resolveTerminalGenerationResult(result)
    if (terminalResult) {
      return terminalResult
    }
  }
}

function mergeGenerationResponseMeta(
  responseMeta: unknown,
  generationTaskId: string,
): TaskResponseMeta {
  const baseMeta = responseMeta && typeof responseMeta === 'object' && !Array.isArray(responseMeta)
    ? responseMeta as TaskResponseMeta
    : {}

  return {
    ...baseMeta,
    generationTaskId,
  }
}

export async function callTaskImageApi(
  task: TaskRecord,
  _settings: AppSettings,
  handlers: TaskApiRequestHandlers = {},
): Promise<TaskPlatformApiResult> {
  const persistedGenerationTaskId = task.generationTaskId?.trim()
  let completedResult: PlatformGenerationResult

  if (persistedGenerationTaskId) {
    completedResult = await waitForGenerationResult(
      persistedGenerationTaskId,
      handlers.throwIfAborted,
      true,
    )
  } else {
    const inputImages = await loadTaskInputImages(task, handlers.throwIfAborted)
    const editMaskDataUrl = await loadTaskEditMaskDataUrl(task, handlers.throwIfAborted)
    handlers.throwIfAborted?.()

    const result = await runGenerationRequestWithRetry(
      (signal) => platformApi.generate({
        clientRequestId: task.generationRequestId?.trim() || task.id,
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
      }, signal),
      handlers.throwIfAborted,
    )
    syncGenerationUser(result)
    await handlers.onTaskAccepted?.(result.taskId)

    completedResult = resolveTerminalGenerationResult(result)
      ?? await waitForGenerationResult(result.taskId, handlers.throwIfAborted)
  }

  const images: TaskApiOutputImageAsset[] = await Promise.all(
    completedResult.images.map(async (image, index) => {
      const outputUrl = image.dataUrl.trim()
      const outputMeta = {
        generationTaskId: completedResult.taskId,
        outputIndex: index,
      }
      if (isRemoteImageUrl(outputUrl)) {
        return {
          remoteUrl: outputUrl,
          mimeType: image.mimeType || 'image/png',
          ...outputMeta,
        }
      }
      if (/^data:[^,]+,.+/i.test(outputUrl)) {
        return {
          dataUrl: outputUrl,
          mimeType: image.mimeType || outputUrl.match(/^data:([^;,]+)/i)?.[1] || 'image/png',
          ...outputMeta,
        }
      }

      const response = await fetch(outputUrl)
      if (!response.ok) {
        throw new Error(`图片读取失败：HTTP ${response.status}`)
      }
      const blob = await response.blob()
      return {
        blob,
        mimeType: image.mimeType || blob.type || 'image/png',
        ...outputMeta,
      }
    }),
  )

  if (completedResult.user) {
    useStore.getState().setCurrentUser(completedResult.user)
  }
  await handlers.onFinalImages?.(images)

  return {
    images,
    responseMeta: mergeGenerationResponseMeta(completedResult.responseMeta, completedResult.taskId),
  }
}
