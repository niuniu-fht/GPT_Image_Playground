import type { ApiInputImage, ApiImageAsset, CallApiResult } from '../lib/api'
import { isRemoteImageUrl } from '../lib/imageUrl'
import {
  PlatformApiError,
  platformApi,
  type PlatformGenerationResult,
} from '../lib/platformApi'
import type { AppSettings, TaskImageResult, TaskRecord, TaskResponseMeta } from '../types'
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
const GENERATION_POLL_BUSY_INTERVAL_MS = 3200
const GENERATION_POLL_SATURATED_INTERVAL_MS = 5000
const GENERATION_POLL_HIDDEN_INTERVAL_MS = 8000
const GENERATION_RETRY_BASE_DELAY_MS = 2000
const GENERATION_RETRY_MAX_DELAY_MS = 30_000
const GENERATION_REQUEST_TIMEOUT_MS = 60_000
const ABORT_CHECK_INTERVAL_MS = 500
const DEFAULT_GENERATION_TIMEOUT_SECONDS = 300
const GENERATION_SUBMISSION_MAX_TRANSIENT_RETRIES = 1

export class GenerationSubmissionError extends Error {
  constructor(message = '网络异常，生图任务未提交，请恢复网络后重试') {
    super(message)
    this.name = 'GenerationSubmissionError'
  }
}

export class GenerationTaskTimeoutError extends Error {
  timeoutSeconds: number

  constructor(timeoutSeconds: number, message?: string) {
    super(message || `生成超过 ${timeoutSeconds} 秒，任务已停止`)
    this.name = 'GenerationTaskTimeoutError'
    this.timeoutSeconds = timeoutSeconds
  }
}

interface GenerationRequestRetryOptions {
  failWhenOffline?: boolean
  maxTransientRetries?: number
}

export interface TaskApiRequestHandlers {
  onTaskAccepted?: (
    generationTaskId: string,
    generationTimeoutSeconds: number,
  ) => void | Promise<void>
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

function countRunningGenerationTasks(): number {
  return (useStore.getState().tasks ?? []).reduce((count, task) => (
    task.status === 'running' && task.taskKind !== 'image' && task.deletedAt == null
      ? count + 1
      : count
  ), 0)
}

function taskPollJitter(taskId: string): number {
  let hash = 0
  for (let index = 0; index < taskId.length; index += 1) {
    hash = ((hash * 31) + taskId.charCodeAt(index)) | 0
  }
  return Math.abs(hash) % 700
}

export function resolveGenerationPollInterval(taskId: string): number {
  const runningCount = countRunningGenerationTasks()
  const baseInterval =
    typeof document !== 'undefined' && document.visibilityState === 'hidden'
      ? GENERATION_POLL_HIDDEN_INTERVAL_MS
      : runningCount >= 20
        ? GENERATION_POLL_SATURATED_INTERVAL_MS
        : runningCount >= 10
          ? GENERATION_POLL_BUSY_INTERVAL_MS
          : GENERATION_POLL_INTERVAL_MS
  return baseInterval + taskPollJitter(taskId)
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

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function normalizeGenerationTimeoutSeconds(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_GENERATION_TIMEOUT_SECONDS
  }
  return Math.min(1800, Math.max(30, Math.floor(value)))
}

function readGenerationTimeoutSeconds(
  responseMeta: unknown,
  fallback: number,
): number {
  if (!responseMeta || typeof responseMeta !== 'object' || Array.isArray(responseMeta)) {
    return normalizeGenerationTimeoutSeconds(fallback)
  }
  return normalizeGenerationTimeoutSeconds(
    (responseMeta as { generationTimeoutSeconds?: unknown }).generationTimeoutSeconds ?? fallback,
  )
}

function createGenerationRunGuard(
  createdAt: number,
  timeoutSeconds: number,
  throwIfAborted?: () => void,
): () => void {
  const normalizedTimeoutSeconds = normalizeGenerationTimeoutSeconds(timeoutSeconds)
  const deadline = createdAt + normalizedTimeoutSeconds * 1000

  return () => {
    throwIfAborted?.()
    if (Date.now() >= deadline) {
      throw new GenerationTaskTimeoutError(normalizedTimeoutSeconds)
    }
  }
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
  options: GenerationRequestRetryOptions = {},
): Promise<T> {
  let retryCount = 0

  while (true) {
    throwIfAborted?.()
    if (options.failWhenOffline && isBrowserOffline()) {
      throw new GenerationSubmissionError()
    }
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
    if (
      retryCount > (options.maxTransientRetries ?? Number.POSITIVE_INFINITY) ||
      (options.failWhenOffline && isBrowserOffline())
    ) {
      throw new GenerationSubmissionError('网络异常或生成服务暂时不可用，生图任务未提交')
    }
    await waitWithAbortChecks(getGenerationRetryDelay(retryCount), throwIfAborted)
  }
}

function syncGenerationUser(result: PlatformGenerationResult) {
  if (!result.user) return
  const snapshot = useStore.getState()
  const currentUser = snapshot.currentUser
  if (
    currentUser?.id === result.user.id &&
    currentUser.email === result.user.email &&
    currentUser.role === result.user.role &&
    currentUser.status === result.user.status &&
    currentUser.creditBalance === result.user.creditBalance
  ) return
  snapshot.setCurrentUser(result.user)
}

function resolveTerminalGenerationResult(
  result: PlatformGenerationResult,
): PlatformGenerationResult | null {
  if (result.images.length > 0) {
    return result
  }
  if (result.status === 'error') {
    if (result.error && /生成超过\s*\d+\s*秒/.test(result.error)) {
      throw new GenerationTaskTimeoutError(
        readGenerationTimeoutSeconds(result.responseMeta, DEFAULT_GENERATION_TIMEOUT_SECONDS),
        result.error,
      )
    }
    throw new Error(result.error || '生成失败，请稍后重试')
  }
  if (result.status === 'done') {
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
      await waitWithAbortChecks(resolveGenerationPollInterval(taskId), throwIfAborted)
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

interface ImageLoadError {
  error: string
  index: number
}

const GENERATED_IMAGE_FETCH_ATTEMPTS = 3
const GENERATED_IMAGE_FETCH_RETRY_DELAY_MS = 800

function waitForGeneratedImageRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, GENERATED_IMAGE_FETCH_RETRY_DELAY_MS * attempt)
  })
}

async function fetchGeneratedImageBlob(outputUrl: string): Promise<Blob> {
  let lastError: unknown

  for (let attempt = 1; attempt <= GENERATED_IMAGE_FETCH_ATTEMPTS; attempt += 1) {
    let response: Response | null = null
    try {
      response = await fetch(outputUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
    } catch (error) {
      lastError = error
    }

    if (response?.ok) {
      try {
        return await response.blob()
      } catch (error) {
        lastError = error
      }
    } else if (response) {
      const httpError = new Error(`图片读取失败：HTTP ${response.status}`)
      if (response.status < 500 && response.status !== 408 && response.status !== 429) {
        throw httpError
      }
      lastError = httpError
    }

    if (attempt < GENERATED_IMAGE_FETCH_ATTEMPTS) {
      await waitForGeneratedImageRetry(attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('图片读取失败，请稍后重试')
}

function mergeImageLoadErrorsIntoResponseMeta(
  responseMeta: TaskResponseMeta,
  imageLoadErrors: ImageLoadError[],
): TaskResponseMeta {
  if (imageLoadErrors.length === 0) {
    return responseMeta
  }

  const imageResultsByIndex = new Map<number, TaskImageResult>()
  for (const item of responseMeta.imageResults ?? []) {
    imageResultsByIndex.set(item.index, item)
  }
  for (const item of imageLoadErrors) {
    imageResultsByIndex.set(item.index, {
      index: item.index,
      status: 'error',
      error: item.error,
    })
  }

  return {
    ...responseMeta,
    imageResults: Array.from(imageResultsByIndex.values()).sort((left, right) => left.index - right.index),
  }
}

async function resolveGeneratedOutputImageAsset(
  completedResult: PlatformGenerationResult,
  image: PlatformGenerationResult['images'][number],
  fallbackIndex: number,
): Promise<TaskApiOutputImageAsset> {
  const outputUrl = image.dataUrl.trim()
  const outputIndex = typeof image.index === 'number' ? image.index : fallbackIndex
  const outputMeta = {
    generationTaskId: completedResult.taskId,
    outputIndex,
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

  const blob = await fetchGeneratedImageBlob(outputUrl)
  return {
    blob,
    sourceUrl: outputUrl,
    mimeType: image.mimeType || blob.type || 'image/png',
    ...outputMeta,
  }
}

export async function callTaskImageApi(
  task: TaskRecord,
  _settings: AppSettings,
  handlers: TaskApiRequestHandlers = {},
): Promise<TaskPlatformApiResult> {
  const persistedGenerationTaskId = task.generationTaskId?.trim()
  const persistedTimeoutSeconds = normalizeGenerationTimeoutSeconds(task.generationTimeoutSeconds)
  let completedResult: PlatformGenerationResult

  if (persistedGenerationTaskId) {
    const throwIfTaskStopped = createGenerationRunGuard(
      task.createdAt,
      persistedTimeoutSeconds,
      handlers.throwIfAborted,
    )
    completedResult = await waitForGenerationResult(
      persistedGenerationTaskId,
      throwIfTaskStopped,
      true,
    )
  } else {
    if (isBrowserOffline()) {
      throw new GenerationSubmissionError()
    }
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
      {
        failWhenOffline: true,
        maxTransientRetries: GENERATION_SUBMISSION_MAX_TRANSIENT_RETRIES,
      },
    )
    syncGenerationUser(result)
    const generationTimeoutSeconds = readGenerationTimeoutSeconds(
      result.responseMeta,
      persistedTimeoutSeconds,
    )
    await handlers.onTaskAccepted?.(result.taskId, generationTimeoutSeconds)
    const throwIfTaskStopped = createGenerationRunGuard(
      task.createdAt,
      generationTimeoutSeconds,
      handlers.throwIfAborted,
    )

    completedResult = resolveTerminalGenerationResult(result)
      ?? await waitForGenerationResult(result.taskId, throwIfTaskStopped)
  }

  const settledImages = await Promise.allSettled(
    completedResult.images.map((image, index) => resolveGeneratedOutputImageAsset(
      completedResult,
      image,
      index,
    )),
  )
  const images: TaskApiOutputImageAsset[] = []
  const imageLoadErrors: ImageLoadError[] = []
  settledImages.forEach((result, fallbackIndex) => {
    const sourceImage = completedResult.images[fallbackIndex]
    const outputIndex = typeof sourceImage?.index === 'number' ? sourceImage.index : fallbackIndex
    if (result.status === 'fulfilled') {
      images.push(result.value)
      return
    }
    imageLoadErrors.push({
      index: outputIndex,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
    })
  })
  if (images.length === 0 && imageLoadErrors.length > 0) {
    throw new Error(imageLoadErrors[0]?.error || '图片读取失败')
  }

  syncGenerationUser(completedResult)
  await handlers.onFinalImages?.(images)

  const responseMeta = mergeImageLoadErrorsIntoResponseMeta(
    mergeGenerationResponseMeta(completedResult.responseMeta, completedResult.taskId),
    imageLoadErrors,
  )

  return {
    images,
    responseMeta,
  }
}
