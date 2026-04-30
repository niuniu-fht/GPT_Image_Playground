import { callImageApi } from '../lib/api'
import type { ApiImageAsset } from '../lib/api/types'
import * as imageDb from '../lib/db'
import {
  deleteImage,
  getAllImageRecords,
  getAllTasks,
  putTask,
  storeImage,
} from '../lib/db'
import { buildImageThumbnail } from '../lib/imagePreview'
import { normalizeImageSize } from '../lib/size'
import type { AppSettings, TaskErrorDebugInfo, TaskRecord } from '../types'
import {
  ALL_CATEGORY_FILTER,
  DEFAULT_PARAMS,
  DEFAULT_SETTINGS,
  FAVORITES_CATEGORY_FILTER,
  UNCATEGORIZED_CATEGORY_FILTER,
  UNKNOWN_TASK_PROVIDER_NAME,
  isTaskInRecycleBin,
} from '../types'
import {
  clearTaskAbortState,
  deleteCachedImage,
  ensureImageDataUrl,
  getTaskAborter,
  isTaskAbortRequested,
  registerTaskAborter,
  requestTaskAbort,
  setCachedImage,
  setCachedImageMetadata,
  startLegacyImageMigrationSweep,
} from './cache'
import { purgeTasksPermanently } from './collectionActions'
import type { StoreApiError } from './contracts'
import {
  ERROR_LOG_POLL_INTERVAL_MS,
  ERROR_LOG_RETENTION_MS,
  RECYCLE_BIN_POLL_INTERVAL_MS,
  RECYCLE_BIN_RETENTION_MS,
  genId,
} from './constants'
import {
  findCategoryById,
  findProviderById,
  getProviderSettings,
  getTaskReferencedImageIds,
  isRecord,
} from './domain'
import { useStore } from './state'
import { repairCategoryStateFromTasks, updateTaskInStore } from './taskStoreUtils'

let recycleBinJanitorId: number | null = null
let errorLogJanitorId: number | null = null

type StoreImageBlobFn = (
  blob: Blob,
  meta?: {
    source?: 'upload' | 'generated'
    mimeType?: string | null
    width?: number | null
    height?: number | null
    thumbnailBlob?: Blob | null
    thumbnailMimeType?: string | null
    thumbnailWidth?: number | null
    thumbnailHeight?: number | null
  },
) => Promise<string>

function getStoreImageBlob(): StoreImageBlobFn {
  const storeImageBlob = (imageDb as typeof imageDb & {
    storeImageBlob?: StoreImageBlobFn
  }).storeImageBlob

  if (typeof storeImageBlob !== 'function') {
    throw new Error('DB 层缺少 storeImageBlob(blob, meta) 实现，无法写入生成结果 Blob')
  }

  return storeImageBlob
}

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

function resolveErrorDebugCreatedAt(
  task: Pick<TaskRecord, 'createdAt' | 'finishedAt' | 'errorDebug'>,
): number {
  if (typeof task.errorDebug?.createdAt === 'number' && Number.isFinite(task.errorDebug.createdAt)) {
    return task.errorDebug.createdAt
  }
  if (typeof task.finishedAt === 'number' && Number.isFinite(task.finishedAt)) {
    return task.finishedAt
  }
  return task.createdAt
}

async function cleanupExpiredErrorDebugLogs(tasks: TaskRecord[]): Promise<TaskRecord[]> {
  const cutoff = Date.now() - ERROR_LOG_RETENTION_MS
  const expiredTaskIds = new Set(
    tasks
      .filter((task) => task.errorDebug && resolveErrorDebugCreatedAt(task) < cutoff)
      .map((task) => task.id),
  )

  if (!expiredTaskIds.size) {
    return tasks
  }

  const updatedTasks = tasks.map((task) =>
    expiredTaskIds.has(task.id)
      ? {
          ...task,
          errorDebug: null,
        }
      : task,
  )

  await Promise.all(
    updatedTasks
      .filter((task) => expiredTaskIds.has(task.id))
      .map((task) => putTask(task)),
  )

  return updatedTasks
}

function ensureErrorLogJanitorStarted() {
  if (errorLogJanitorId != null) {
    return
  }

  errorLogJanitorId = window.setInterval(() => {
    void (async () => {
      const { tasks, setTasks } = useStore.getState()
      const updatedTasks = await cleanupExpiredErrorDebugLogs(tasks)
      if (updatedTasks !== tasks) {
        setTasks(updatedTasks)
      }
    })()
  }, ERROR_LOG_POLL_INTERVAL_MS)
}

export async function initStore() {
  const tasks = await cleanupExpiredErrorDebugLogs(await getAllTasks())
  useStore.getState().setTasks(tasks)
  repairCategoryStateFromTasks(tasks)
  ensureErrorLogJanitorStarted()

  window.setTimeout(() => {
    void cleanupOrphanImages(tasks).finally(() => {
      startLegacyImageMigrationSweep()
    })
  }, 1000)
}

async function cleanupOrphanImages(tasks: TaskRecord[]) {
  const referencedIds = new Set<string>()
  for (const task of tasks) {
    for (const id of getTaskReferencedImageIds(task)) {
      referencedIds.add(id)
    }
  }

  const images = await getAllImageRecords()
  for (const image of images) {
    if (!referencedIds.has(image.id)) {
      await deleteImage(image.id)
    }
  }
}

async function prepareGeneratedImageStorage(blob: Blob) {
  try {
    return await buildImageThumbnail(blob)
  } catch (error) {
    console.error('生成结果图缩略图构建失败，将仅存原图。', error)
    return null
  }
}

export async function submitTask() {
  const {
    settings,
    providers,
    categories,
    activeProviderId,
    activeCategoryFilter,
    prompt,
    inputImages,
    params,
    tasks,
    setTasks,
    showToast,
  } = useStore.getState()

  if (!settings.apiKey) {
    showToast('请先在设置中配置 API Key', 'error')
    useStore.getState().setShowSettings(true)
    return
  }

  if (!prompt.trim() && !inputImages.length) {
    showToast('请输入提示词或添加参考图', 'error')
    return
  }

  const maskedInputs = inputImages.filter((image) => Boolean(image.maskDataUrl))
  if (maskedInputs.length > 1) {
    showToast('当前仅支持 1 张带蒙版的局部编辑参考图，请先清理多余蒙版后再提交', 'error')
    return
  }

  for (const image of inputImages) {
    await storeImage(image.dataUrl)
  }

  const maskedInput = maskedInputs[0]
  const editMaskImageId = maskedInput?.maskDataUrl
    ? await storeImage(maskedInput.maskDataUrl, 'upload')
    : null

  const normalizedParams = {
    ...params,
    size: normalizeImageSize(params.size) || DEFAULT_PARAMS.size,
  }
  if (normalizedParams.size !== params.size) {
    useStore.getState().setParams({ size: normalizedParams.size })
  }

  const taskId = genId()
  const selectedProvider = findProviderById(providers, activeProviderId)
  const selectedCategory =
    activeCategoryFilter !== ALL_CATEGORY_FILTER &&
    activeCategoryFilter !== FAVORITES_CATEGORY_FILTER &&
    activeCategoryFilter !== UNCATEGORIZED_CATEGORY_FILTER
      ? findCategoryById(categories, activeCategoryFilter)
      : undefined
  const requestSettings = selectedProvider ? getProviderSettings(selectedProvider) : settings

  const task: TaskRecord = {
    id: taskId,
    providerId: selectedProvider?.id ?? null,
    providerName: selectedProvider?.name?.trim() || UNKNOWN_TASK_PROVIDER_NAME,
    categoryId: selectedCategory?.id ?? null,
    categoryName: selectedCategory?.name ?? null,
    deletedAt: null,
    isFavorite: false,
    prompt: prompt.trim(),
    params: normalizedParams,
    inputImageIds: inputImages.map((image) => image.id),
    editMaskImageId,
    editSourceImageId: maskedInput?.sourceImageId ?? maskedInput?.id ?? null,
    editSelection: maskedInput?.editSelection ?? null,
    outputImages: [],
    responseMeta: null,
    errorDebug: null,
    isAborted: false,
    status: 'running',
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    elapsed: null,
  }

  const newTasks = [task, ...tasks]
  setTasks(newTasks)
  await putTask(task)
  void executeTask(taskId, requestSettings)
}

function cloneTaskForRetry(task: TaskRecord): TaskRecord {
  return {
    ...task,
    id: genId(),
    deletedAt: null,
    isFavorite: false,
    outputImages: [],
    responseMeta: null,
    errorDebug: null,
    isAborted: false,
    status: 'running',
    error: null,
    createdAt: Date.now(),
    finishedAt: null,
    elapsed: null,
  }
}

export async function retryTask(task: TaskRecord) {
  if (isTaskInRecycleBin(task)) {
    useStore.getState().showToast('回收站中的任务无法重试', 'error')
    return
  }

  const currentTask = useStore.getState().tasks.find((item) => item.id === task.id) ?? task
  if (currentTask.status === 'running') {
    useStore.getState().showToast('该任务正在进行中', 'info')
    return
  }

  if (currentTask.status !== 'error' && currentTask.status !== 'partial_error') {
    useStore.getState().showToast('当前任务不支持重试', 'info')
    return
  }

  if (currentTask.status === 'partial_error') {
    const retryTaskRecord = cloneTaskForRetry(currentTask)
    const { tasks, setTasks, showToast, setDetailTaskId } = useStore.getState()
    setTasks([retryTaskRecord, ...tasks])
    await putTask(retryTaskRecord)
    setDetailTaskId(retryTaskRecord.id)
    showToast('已新建重试任务', 'info')
    void executeTask(retryTaskRecord.id)
    return
  }

  const nextCreatedAt = Date.now()
  updateTaskInStore(currentTask.id, {
    status: 'running',
    isAborted: false,
    error: null,
    errorDebug: null,
    outputImages: [],
    responseMeta: null,
    finishedAt: null,
    elapsed: null,
    createdAt: nextCreatedAt,
  })
  useStore.getState().showToast('已开始重试', 'info')
  void executeTask(currentTask.id)
}

export async function abortTask(task: TaskRecord) {
  if (isTaskInRecycleBin(task)) {
    useStore.getState().showToast('回收站中的任务无法中止', 'error')
    return
  }

  const currentTask = useStore.getState().tasks.find((item) => item.id === task.id) ?? task
  if (currentTask.status !== 'running') {
    useStore.getState().showToast('该任务当前不在生成中', 'info')
    return
  }

  requestTaskAbort(currentTask.id)
  const abort = getTaskAborter(currentTask.id)
  if (abort) {
    abort()
  }
  useStore.getState().showToast('正在中止任务...', 'info')
}

function throwIfTaskAbortRequested(taskId: string) {
  if (!isTaskAbortRequested(taskId)) {
    return
  }

  const error = new Error('任务已中止')
  error.name = 'TaskAbortError'
  throw error
}

async function executeTask(taskId: string, requestSettings?: AppSettings) {
  const { settings, providers } = useStore.getState()
  const task = useStore.getState().tasks.find((item) => item.id === taskId)
  if (!task) {
    return
  }

  const taskProvider = findProviderById(providers, task.providerId)
  const providerSettings = requestSettings ?? (taskProvider ? getProviderSettings(taskProvider) : settings)
  const outputIds: string[] = []

  try {
    throwIfTaskAbortRequested(taskId)
    const storeImageBlob = getStoreImageBlob()

    const appendOutputImages = async (images: ApiImageAsset[]) => {
      if (!images.length) {
        return
      }

      for (const image of images) {
        throwIfTaskAbortRequested(taskId)
        const thumbnail = await prepareGeneratedImageStorage(image.blob)
        const imageId = await storeImageBlob(image.blob, {
          source: 'generated',
          mimeType: image.mimeType || image.blob.type || null,
          width: thumbnail?.width ?? null,
          height: thumbnail?.height ?? null,
          thumbnailBlob: thumbnail?.thumbnailBlob ?? null,
          thumbnailMimeType: thumbnail?.thumbnailMimeType ?? null,
          thumbnailWidth: thumbnail?.thumbnailWidth ?? null,
          thumbnailHeight: thumbnail?.thumbnailHeight ?? null,
        })
        setCachedImage(imageId, image.blob, 'original')
        if (thumbnail?.thumbnailBlob) {
          setCachedImage(imageId, thumbnail.thumbnailBlob, 'thumbnail')
        }
        if (thumbnail) {
          setCachedImageMetadata(imageId, {
            width: thumbnail.width,
            height: thumbnail.height,
          })
        }
        outputIds.push(imageId)
      }

      updateTaskInStore(taskId, {
        outputImages: [...outputIds],
      })
    }

    const inputDataUrls: string[] = []
    const loadedInputIds: string[] = []
    for (const imageId of task.inputImageIds) {
      throwIfTaskAbortRequested(taskId)
      const dataUrl = await ensureImageDataUrl(imageId)
      if (!dataUrl) {
        continue
      }

      inputDataUrls.push(dataUrl)
      loadedInputIds.push(imageId)
    }

    throwIfTaskAbortRequested(taskId)
    const editMaskDataUrl = task.editMaskImageId
      ? await ensureImageDataUrl(task.editMaskImageId)
      : undefined
    if (task.editMaskImageId && !editMaskDataUrl) {
      throw new Error('局部编辑蒙版缺失，请重新选择编辑区域后再试')
    }

    const editSourceImageIndex =
      task.editSourceImageId != null ? loadedInputIds.indexOf(task.editSourceImageId) : -1

    const result = await callImageApi({
      settings: providerSettings,
      prompt: task.prompt,
      params: task.params,
      inputImageDataUrls: inputDataUrls,
      editMaskDataUrl,
      editSelection: task.editSelection ?? null,
      editSourceImageIndex: editSourceImageIndex >= 0 ? editSourceImageIndex : undefined,
      onFinalImages: appendOutputImages,
      registerAbort: (abort) => {
        registerTaskAborter(taskId, abort)
      },
    })

    if (outputIds.length < result.images.length) {
      await appendOutputImages(result.images.slice(outputIds.length))
    }

    updateTaskInStore(taskId, {
      outputImages: [...outputIds],
      responseMeta: result.responseMeta ?? null,
      isAborted: false,
      error: null,
      errorDebug: null,
      status: 'done',
      finishedAt: Date.now(),
      elapsed: Date.now() - task.createdAt,
    })

    useStore.getState().showToast(`生成完成，共 ${outputIds.length} 张图片`, 'success')
  } catch (error) {
    const wasUserAborted =
      isTaskAbortRequested(taskId) ||
      (error instanceof Error && (error.name === 'TaskAbortError' || error.message === '任务已中止'))
    const hasPartialOutputs = outputIds.length > 0

    if (wasUserAborted) {
      updateTaskInStore(taskId, {
        status: hasPartialOutputs ? 'partial_error' : 'error',
        isAborted: true,
        error: '任务已中止',
        errorDebug: null,
        finishedAt: Date.now(),
        elapsed: Date.now() - task.createdAt,
      })
      return
    }

    updateTaskInStore(taskId, {
      status: hasPartialOutputs ? 'partial_error' : 'error',
      isAborted: false,
      error: error instanceof Error ? error.message : String(error),
      errorDebug: buildTaskErrorDebugInfo(providerSettings, error),
      finishedAt: Date.now(),
      elapsed: Date.now() - task.createdAt,
    })
    useStore.getState().setDetailTaskId(taskId)
  } finally {
    clearTaskAbortState(taskId)
    for (const imageId of task.inputImageIds) {
      deleteCachedImage(imageId)
    }
  }
}

export async function cleanupExpiredRecycleBinTasks() {
  const tasks = await getAllTasks()
  const cutoff = Date.now() - RECYCLE_BIN_RETENTION_MS
  const expiredTasks = tasks.filter(
    (task) => isTaskInRecycleBin(task) && (task.deletedAt ?? 0) <= cutoff,
  )

  if (!expiredTasks.length) {
    return 0
  }

  return purgeTasksPermanently(expiredTasks, { silent: true, taskUniverse: tasks })
}

export function startRecycleBinJanitor() {
  if (recycleBinJanitorId != null) {
    return () => {
      if (recycleBinJanitorId != null) {
        window.clearInterval(recycleBinJanitorId)
        recycleBinJanitorId = null
      }
    }
  }

  void cleanupExpiredRecycleBinTasks()
  recycleBinJanitorId = window.setInterval(() => {
    void cleanupExpiredRecycleBinTasks()
  }, RECYCLE_BIN_POLL_INTERVAL_MS)

  return () => {
    if (recycleBinJanitorId != null) {
      window.clearInterval(recycleBinJanitorId)
      recycleBinJanitorId = null
    }
  }
}
